import { Client, Collection, GatewayIntentBits, Partials, Routes, REST } from "discord.js";
import mongoose from "mongoose";
import { globSync } from "glob";
import { pathToFileURL } from "node:url";
import Interaction from "./Interaction.js";
import Event from "./Event.js";
import Logger from "../utils/Logger.js";
import TtlCache from "../utils/TtlCache.js";
import connectDatabase from "../database/connect.js";
import guildsData from "../models/Guilds.js";

const db = mongoose.connection;
const COMMAND_PATTERN = "src/commands/**/*.js";
const EVENT_PATTERN = "src/events/**/*.js";
const GUILD_CACHE_MAX_ENTRIES = 1000;
const GUILD_CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * @typedef {object} GuildConfig
 * @property {string}   _id               Discord guild (server) snowflake.
 * @property {string[]} modRoles          Role IDs granting ticket staff access.
 * @property {?string}  logsChannel       Channel ID receiving ticket audit logs.
 * @property {?string}  transcriptChannel Channel ID receiving saved transcripts.
 * @property {?string}  ticketsParent     Text channel ID hosting ticket threads.
 * @property {Date}     createdAt
 * @property {Date}     updatedAt
 */

/**
 * Application client: owns the Discord gateway connection, the command and
 * event registries, and the guild-configuration cache.
 *
 * Commands and events are discovered from disk by convention rather than a
 * manual index, so adding a file under `src/commands` or `src/events` is
 * sufficient to register it.
 *
 * @extends {Client}
 */
export default class Bot extends Client {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.MessageContent,
            ],
            partials: [Partials.Message, Partials.Reaction],
            allowedMentions: {
                parse: ["roles", "users"],
                repliedUser: false,
            },
        });

        this.events = new Collection();
        this.logger = Logger;
        this.interactions = new Collection();
        this.registeredApplicationCommands = new Set();

        this.database = {};
        this.guildsData = guildsData;
        this.database.guilds = new TtlCache({
            max: GUILD_CACHE_MAX_ENTRIES,
            ttl: GUILD_CACHE_TTL_MS,
        });

        db.on("connected", async () =>
            this.logger.log(`[DB] MongoDB connected (latency: ${Math.round(await this.databasePing())}ms)`, {
                color: "green",
                tag: "Database",
            })
        );
        /*
         * A disconnect is also emitted during an intentional shutdown, so this
         * is a warning rather than an error — otherwise every clean Ctrl+C ends
         * with a red database failure in the console.
         */
        db.on("disconnected", () => this.logger.warn("[DB] MongoDB disconnected", {
            tag: "Database",
        }));
        db.on("error", (error) =>
            this.logger.error(
                `[DB] MongoDB error\n${error.stack ? `${error}\n\n${error.stack}` : error}`,
                {
                    color: "red",
                    tag: "Error",
                }
            )
        );
        db.on("reconnected", async () =>
            this.logger.log(`[DB] MongoDB reconnected (latency: ${Math.round(await this.databasePing())}ms)`, {
                color: "green",
                tag: "Database",
            })
        );
    }

    /**
     * Resolves a guild's configuration, creating a default document if absent.
     *
     * The upsert is atomic so concurrent interactions for a guild the bot has
     * not seen before cannot race into a duplicate-key error. The returned
     * value is a **plain object read from cache** and must never be mutated in
     * place — in-process mutation would diverge from the database and, under
     * sharding, silently clobber another process's write. Persist changes with
     * {@link Bot#updateGuild} instead.
     *
     * @param   {{ _id: string }} query   Guild lookup, keyed by guild snowflake.
     * @param   {unknown}        [_check] Legacy positional flag, no longer read.
     * @returns {Promise<GuildConfig>}    The cached or freshly upserted config.
     */
    async getGuild({ _id: guildId }, _check) {
        const cached = this.database.guilds.get(guildId);
        if (cached) {
            return cached;
        }

        const guildData = await this.guildsData.findOneAndUpdate(
            { _id: guildId },
            { $setOnInsert: { _id: guildId } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, runValidators: true }
        ).lean();

        this.database.guilds.set(guildId, guildData);

        return guildData;
    }

    /**
     * Applies an atomic update operator to a guild config and refreshes the
     * cache with the authoritative post-write document.
     *
     * Callers pass Mongo operators (`$set`, `$pull`, `$addToSet`) rather than a
     * mutated document, which keeps writes idempotent and safe against the
     * stale reads a cached config can produce.
     *
     * @param   {string} guildId          Guild snowflake.
     * @param   {object} update           Mongo update document, e.g. `{ $set: { logsChannel: id } }`.
     * @returns {Promise<GuildConfig>}    The document as it exists after the write.
     */
    async updateGuild(guildId, update) {
        const guildData = await this.guildsData.findOneAndUpdate(
            { _id: guildId },
            update,
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, runValidators: true }
        ).lean();

        this.database.guilds.set(guildId, guildData);

        return guildData;
    }

    /**
     * Evicts a guild from the configuration cache.
     *
     * Required after the guild document is deleted, or whenever it is written
     * by something other than {@link Bot#updateGuild}, to prevent serving a
     * config that no longer reflects the database.
     *
     * @param   {string}  guildId Guild snowflake.
     * @returns {boolean}         `true` when an entry was actually removed.
     */
    forgetGuild(guildId) {
        return this.database.guilds.delete(guildId);
    }

    /**
     * Opens the MongoDB connection and registers graceful-shutdown handlers.
     *
     * The client is passed through so shutdown can tear down the gateway before
     * closing the database.
     *
     * @returns {Promise<import("mongoose").Connection>}
     * @throws  {Error} When the `MONGO` environment variable is missing.
     */
    async loadDatabase() {
        return connectDatabase(process.env.MONGO, this);
    }

    /**
     * @returns {string[]} Absolute paths of every command module on disk.
     */
    getCommandFiles() {
        return globSync(COMMAND_PATTERN, {
            cwd: process.cwd(),
            absolute: true,
            nodir: true,
            windowsPathsNoEscape: true,
        });
    }

    /**
     * @returns {string[]} Absolute paths of every event module on disk.
     */
    getEventFiles() {
        return globSync(EVENT_PATTERN, {
            cwd: process.cwd(),
            absolute: true,
            nodir: true,
            windowsPathsNoEscape: true,
        });
    }

    /**
     * Imports every command module and registers each one by name.
     *
     * Modules whose default export does not extend {@link Interaction} are
     * skipped, so shared helpers may live alongside commands without being
     * mistaken for one.
     *
     * @returns {Promise<void>}
     */
    async loadCommands() {
        const commandFiles = this.getCommandFiles();
        this.logger.log(`[LOAD] Commands: found ${commandFiles.length} files`, { tag: "Startup" });

        this.interactions.clear();

        for (const filepath of commandFiles) {
            const imported = await import(pathToFileURL(filepath).href);
            const File = imported.default;

            if (!File || !(File.prototype instanceof Interaction)) {
                continue;
            }

            const interaction = new File();
            interaction.client = this;
            this.interactions.set(interaction.name, interaction);
        }

        this.logger.log(`[LOAD] Commands: registered ${this.interactions.size} interactions`, {
            tag: "Startup",
        });
    }

    /**
     * Measures MongoDB round-trip latency with a `ping` admin command.
     *
     * @returns {Promise<number>} Latency in milliseconds.
     */
    async databasePing() {
        const cNano = process.hrtime();
        await db.db.command({ ping: 1 });
        const time = process.hrtime(cNano);
        return (time[0] * 1e9 + time[1]) * 1e-6;
    }

    /**
     * Publishes the loaded commands to Discord as guild application commands.
     *
     * Guilds already present in `registeredApplicationCommands` are skipped so
     * repeat calls (for example on `guildCreate`) stay cheap. Registration is
     * isolated per guild: one server that has not granted the
     * `applications.commands` scope logs an error rather than aborting startup
     * for every other server.
     *
     * @param   {string} [guildId] Register a single guild; omit for all cached guilds.
     * @returns {Promise<void>}
     */
    async registerApplicationCommands(guildId) {
        const guildIds = typeof guildId === "string"
            ? [guildId]
            : [...this.guilds.cache.keys()];

        const data = [...this.interactions.values()].map((interaction) => ({
            name: interaction.name,
            description: interaction.description,
            type: interaction.type,
            options: interaction.options,
        }));

        const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

        for (const id of guildIds) {
            if (this.registeredApplicationCommands.has(id)) {
                continue;
            }

            /*
             * A single guild that denies applications.commands must not abort
             * startup for every other guild — log it and carry on.
             */
            try {
                await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, id), {
                    body: data,
                });
                this.registeredApplicationCommands.add(id);
            } catch (error) {
                this.logger.error(
                    `Failed to register application commands for guild ${id}\n${error?.stack ?? error}`,
                    { color: "red", tag: "Startup" }
                );
            }
        }
    }

    /**
     * Backward-compatible alias for {@link Bot#registerApplicationCommands}.
     *
     * @param   {string} [guildId]
     * @returns {Promise<void>}
     */
    async loadInteractions(guildId) {
        return this.registerApplicationCommands(guildId);
    }

    /**
     * Imports every event module and binds it to its emitter.
     *
     * Each handler is wrapped so a rejection is logged with the originating
     * event name instead of escaping as an unhandled rejection — listeners are
     * fire-and-forget, so without this wrapper no async event failure would
     * ever be caught at its source.
     *
     * @returns {Promise<void>}
     */
    async loadEvents() {
        const eventFiles = this.getEventFiles();
        this.logger.log(`[LOAD] Events: found ${eventFiles.length} files`, { tag: "Startup" });

        this.events.clear();

        for (const filepath of eventFiles) {
            const imported = await import(pathToFileURL(filepath).href);
            const File = imported.default;

            if (!File || !(File.prototype instanceof Event)) {
                continue;
            }

            const event = new File();
            event.client = this;
            this.events.set(event.name, event);

            const emitter = event.emitter ? (typeof event.emitter === "string" ? this[event.emitter] : event.emitter) : this;
            const handler = async (...args) => {
                try {
                    await event.exec(...args);
                } catch (error) {
                    this.logger.error(
                        `Unhandled error in event "${event.name}"\n${error?.stack ?? error}`,
                        { color: "red", tag: "Event" }
                    );
                }
            };

            emitter[event.type ? "once" : "on"](event.name, handler);
        }
    }

    /**
     * Boots the application: load commands and events, connect to MongoDB, log
     * in, then publish application commands.
     *
     * Commands and events are loaded before login so no gateway event can
     * arrive before a handler exists to serve it.
     *
     * @param   {string} token           Discord bot token.
     * @returns {Promise<string>}        The resolved login token.
     * @throws  {Error}                  On failed login or database connection.
     */
    async start(token) {
        await this.loadCommands();
        await this.loadEvents();
        await this.loadDatabase();
        const loginResult = await this.login(token);
        await this.registerApplicationCommands();

        return loginResult;
    }
};
