import Event from "../../struct/Event.js";

/**
 * Provisions a newly joined guild.
 *
 * Creates its default configuration and publishes the command set immediately,
 * so the bot is usable without waiting for global command propagation.
 *
 * @extends {Event}
 */
export default class GuildCreate extends Event {
    constructor() {
        super({
            name: "guildCreate",
            once: false,
        });
    }

    /**
     * @param   {import("discord.js").Guild} guild
     * @returns {Promise<void>}
     */
    async exec(guild) {
 
        await this.client.getGuild({_id: guild.id});
        await this.client.loadInteractions(guild.id);

        this.client.logger.log(`${guild.name} (${guild.id}) just added me!`, {
            tag: "guildCreate",
        });

    }
};
