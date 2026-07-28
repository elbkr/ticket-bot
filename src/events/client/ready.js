import { ActivityType, Events } from "discord.js";
import Event from "../../struct/Event.js";
import * as ticketRepository from "../../repositories/ticketRepository.js";

const PRESENCE_REFRESH_MS = 15 * 60 * 1000;

/**
 * Startup routine: presence, statistics and ticket reconciliation.
 *
 * @extends {Event}
 */
export default class Ready extends Event {
    constructor() {
        super({
            name: Events.ClientReady,
            once: true,
        });
    }

    /**
     * @param   {import("../../struct/Bot.js").default} client
     * @returns {Promise<void>}
     */
    async exec(client) {
        try {
            await this.updatePresence(client);

            const timer = setInterval(() => {
                this.updatePresence(client).catch((error) =>
                    client.logger.error(error, { color: "red", tag: "Error" })
                );
            }, PRESENCE_REFRESH_MS);

            /* Never let the refresh loop keep the process alive on shutdown. */
            timer.unref?.();

            let memberCount = 0;
            let channelCount = 0;

            for (const guild of client.guilds.cache.values()) {
                memberCount += guild.memberCount ?? 0;
                channelCount += guild.channels.cache.size;
            }

            client.logger.log(
                `[READY] Logged in as ${client.user.tag} | Guilds: ${client.guilds.cache.size} | Members: ${memberCount} | Channels: ${channelCount}`,
                { color: "green", tag: "Startup" }
            );

            await this.reconcileOrphanedTickets(client);
        } catch (error) {
            client.logger.error(error, { color: "red", tag: "Error" });
        }
    }

    /**
     * Refreshes the "watching N tickets" presence.
     *
     * A failed count degrades to a generic label rather than propagating, so a
     * transient database issue cannot break the refresh loop.
     *
     * @param   {import("discord.js").Client} client
     * @returns {Promise<void>}
     */
    async updatePresence(client) {
        const ticketCount = await ticketRepository.countOpenTickets().catch(() => null);

        client.user.setPresence({
            activities: [
                {
                    name: ticketCount === null ? "tickets" : `${ticketCount} tickets`,
                    type: ActivityType.Watching,
                },
            ],
            status: "online",
        });
    }

    /**
     * Purges ticket rows whose thread no longer exists.
     *
     * Threads deleted while the bot was offline — or removed as a side effect of
     * their parent channel being deleted — never emit threadDelete, so the row
     * survives and blocks its owner from opening a new ticket.
     *
     * Guilds the bot has left are skipped rather than purged: their cleanup
     * belongs to `guildDelete`, and treating an absent guild as an orphaned
     * thread would destroy tickets the bot may regain access to.
     *
     * @param   {import("discord.js").Client} client
     * @returns {Promise<void>}
     */
    async reconcileOrphanedTickets(client) {
        const openTickets = await ticketRepository.listOpenTickets();
        if (openTickets.length === 0) {
            return;
        }

        let purged = 0;

        for (const ticket of openTickets) {
            const guild = client.guilds.cache.get(ticket.guildID);
            if (!guild) {
                /* Bot is no longer in that guild — guildDelete owns that cleanup. */
                continue;
            }

            const thread = await guild.channels.fetch(ticket.ticketID).catch(() => null);
            if (thread) {
                continue;
            }

            const removed = await ticketRepository
                .deleteTicketByGuildAndTicketId(ticket.guildID, ticket.ticketID)
                .catch(() => null);

            if (removed?.deletedCount) {
                purged += 1;
            }
        }

        if (purged > 0) {
            client.logger.warn(
                `[RECONCILE] Purged ${purged} orphaned ticket record(s) whose thread no longer exists.`,
                { tag: "Startup" }
            );
        }
    }
}
