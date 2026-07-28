import Event from "../../struct/Event.js";

/**
 * Clears configuration that pointed at a deleted channel.
 *
 * Only concerns real channels and categories — ticket threads are handled by
 * `threadDelete`. All matches are cleared in a single atomic update.
 *
 * @extends {Event}
 */
export default class ChannelDelete extends Event {
    constructor() {
        super({
            name: "channelDelete",
            once: false,
        });
    }

    /**
     * @param   {import("discord.js").GuildChannel} channel
     * @returns {Promise<void>}
     */
    async exec(channel) {
        const data = await this.client.getGuild({ _id: channel.guild.id });
        if (!data) return;

        const clearedFields = {};
        if (data.transcriptChannel && data.transcriptChannel === channel.id) {
            clearedFields.transcriptChannel = null;
        }
        if (data.logsChannel && data.logsChannel === channel.id) {
            clearedFields.logsChannel = null;
        }
        if (data.ticketsParent && data.ticketsParent === channel.id) {
            clearedFields.ticketsParent = null;
        }

        if (Object.keys(clearedFields).length > 0) {
            await this.client.updateGuild(channel.guild.id, { $set: clearedFields });
        }
    }
}
