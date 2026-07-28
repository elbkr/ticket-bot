import Event from "../../struct/Event.js";
import * as ticketRepository from "../../repositories/ticketRepository.js";
import { buildTicketManuallyDeletedLogEmbed } from "../../services/ticketPresentation.js";

/**
 * Purges a ticket when its thread is deleted.
 *
 * Tickets are threads, so this — not `channelDelete` — is the event that fires
 * for them. No transcript can be produced here: by the time the event arrives
 * the thread is already gone server-side and its history is unreachable, so the
 * log entry records the loss instead.
 *
 * @extends {Event}
 */
export default class ThreadDelete extends Event {
    constructor() {
        super({
            name: "threadDelete",
            once: false,
        });
    }

    /**
     * @param   {import("discord.js").ThreadChannel} thread
     * @returns {Promise<void>}
     */
    async exec(thread) {
        const data = await this.client.getGuild({ _id: thread.guild.id });
        if (!data) return;

        const ticket = await ticketRepository.findTicketByGuildAndTicketId(thread.guild.id, thread.id);

        if (ticket) {
            if (data.logsChannel) {
                try {
                    const owner = await thread.guild.members.fetch(ticket.ownerId);
                    const logEmbed = buildTicketManuallyDeletedLogEmbed({
                        ticketId: thread.id,
                        owner,
                    });

                    const logs = await thread.guild.channels.fetch(data.logsChannel);
                    await logs.send({ embeds: [logEmbed] });
                } catch (err) {
                    this.client.logger.error(err, { color: "red", tag: "Error" });
                }
            }

            await ticketRepository.deleteTicketByGuildAndTicketId(thread.guild.id, thread.id).catch((err) => {
                this.client.logger.error(err, { color: "red", tag: "Error" });
            });
        }

        const clearedFields = {};
        if (data.transcriptChannel && data.transcriptChannel === thread.id) {
            clearedFields.transcriptChannel = null;
        }
        if (data.logsChannel && data.logsChannel === thread.id) {
            clearedFields.logsChannel = null;
        }
        if (data.ticketsParent && data.ticketsParent === thread.id) {
            clearedFields.ticketsParent = null;
        }

        if (Object.keys(clearedFields).length > 0) {
            await this.client.updateGuild(thread.guild.id, { $set: clearedFields });
        }
    }
}
