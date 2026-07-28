import {
    ActionRowBuilder, MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";
import { TICKET_TOPIC_LABELS } from "../services/ticketPresentation.js";
import { alertReply } from "../utils/theme.js";

/**
 * Handles topic selection from the public ticket panel.
 *
 * Responds with a modal collecting the subject and description, encoding the
 * chosen topic into the modal's `customId` so the submission handler can
 * recover it — Discord offers no other channel for carrying that state.
 *
 * Showing a modal is itself the interaction acknowledgement, so this must not
 * defer beforehand.
 *
 * @param   {import("discord.js").StringSelectMenuInteraction} interaction
 * @returns {Promise<void>} Never rejects; failures are logged.
 */
export default async function ticketSelectMenuHandler(interaction) {
    if (interaction.customId !== "ticket_topic") {
        return;
    }

    try {
        const topic = interaction.values[0];
        if (!TICKET_TOPIC_LABELS[topic]) {
            await interaction.reply(alertReply("⚠️ Unknown Ticket Topic", { flags: MessageFlags.Ephemeral, }));
            return;
        }

        const subjectInput = new TextInputBuilder()
            .setCustomId("subject")
            .setLabel("Subject")
            .setStyle(TextInputStyle.Short)
            .setMinLength(3)
            .setMaxLength(100)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId("description")
            .setLabel("Description of the issue")
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(10)
            .setMaxLength(1000)
            .setRequired(true);

        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal:${topic}`)
            .setTitle(`New ticket · ${TICKET_TOPIC_LABELS[topic]}`)
            .addComponents(
                new ActionRowBuilder().addComponents(subjectInput),
                new ActionRowBuilder().addComponents(descriptionInput)
            );

        await interaction.showModal(modal);
    } catch (error) {
        interaction.client.logger.error(error, { color: "red", tag: "Error" });
    }
}
