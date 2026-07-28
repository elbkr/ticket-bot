/**
 * @typedef {object} InteractionOptions
 * @property {string}   name          Command name as registered with Discord.
 * @property {number}   [type=1]      Application command type (1 = chat input).
 * @property {string}   [description] Shown in the Discord command picker.
 * @property {object[]} [options]     Raw application command option definitions.
 */

/**
 * Base class for every slash command.
 *
 * The command loader identifies commands by `instanceof` against this class, so
 * anything intended to be registered must extend it — directly, or through
 * {@link TicketCommand} for ticket actions.
 */
export default class Interaction {
    /**
     * @param {InteractionOptions} options
     * @throws {Error} When no name is supplied; an unnamed command can never be
     *                 dispatched, so this fails loudly at load time rather than
     *                 registering a silently unreachable command.
     */
    constructor(options = {}) {
        if (!options.name) {
            throw new Error("Interaction requires a name.");
        }

        this.name = options.name;
        this.type = options.type || 1;
        this.description =
            this.type === 1
                ? options.description || "No description provided"
                : undefined;
        this.options = options.options || [];
    }

    /**
     * Executes the command. Subclasses must override.
     *
     * @param   {import("discord.js").ChatInputCommandInteraction} interaction
     * @param   {import("./Bot.js").GuildConfig} data Guild configuration.
     * @returns {Promise<void>}
     * @throws  {Error} Always, unless overridden.
     */
    async exec() {
        throw new Error(`${this.name} does not provide exec method !`);
    }
}
