import Event from "../../struct/Event.js";

/**
 * Removes a guild's configuration when the bot is removed from it.
 *
 * The cache is evicted alongside the document so a re-invite starts from a
 * clean default rather than resurrecting stale settings.
 *
 * @extends {Event}
 */
export default class GuildDelete extends Event {
    constructor() {
        super({
            name: "guildDelete",
            once: false,
        });
    }

    /**
     * @param   {import("discord.js").Guild} guild
     * @returns {Promise<void>}
     */
    async exec(guild) {
        await this.client.guildsData.deleteOne({ _id: guild.id });
        this.client.forgetGuild(guild.id);

        this.client.logger.warn(`${guild.name} (${guild.id}) has been deleted from the database.`, {
            tag: "guildDelete",
        });
    }
}
