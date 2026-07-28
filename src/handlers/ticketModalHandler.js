import { MessageFlags } from "discord.js";
import ticketService, { TicketServiceError } from "../services/ticketService.js";
import reportInteractionError from "./interactionErrorReporter.js";

/**
 * Maps a modal submission to its service call.
 *
 * `ticket_modal:<topic>` is the only modal this bot shows — every other ticket
 * action is button-driven and handled in `ticketButtonHandler.js`. The topic is
 * carried in the `customId` because Discord provides no other way to pass state
 * from the select menu that opened the modal.
 *
 * @param   {import("discord.js").ModalSubmitInteraction} interaction
 * @returns {Promise<object>} The service result.
 * @throws  {TicketServiceError} `UNKNOWN_MODAL` for an unrecognised submission.
 */
function resolveModalAction(interaction) {
    if (interaction.customId.startsWith("ticket_modal:")) {
        const topic = interaction.customId.slice("ticket_modal:".length);
        return ticketService.createTicket({
            interaction,
            guildConfig: interaction.guildConfig,
            topic,
            subject: interaction.fields.getTextInputValue("subject").trim(),
            description: interaction.fields.getTextInputValue("description").trim(),
        });
    }

    throw new TicketServiceError("Unknown ticket modal.", "UNKNOWN_MODAL");
}

/**
 * Entry point for every ticket modal submission.
 *
 * Never rejects — failures are rendered to the user and logged.
 *
 * @param   {import("discord.js").ModalSubmitInteraction} interaction
 * @param   {import("../struct/Bot.js").GuildConfig} guildConfig
 * @returns {Promise<void>}
 */
export default async function ticketModalHandler(interaction, guildConfig) {
    interaction.guildConfig = guildConfig;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);

    try {
        const result = await resolveModalAction(interaction);

        if (result?.channelDeleted) return;

        await interaction.editReply(result.reply || result).catch(() => null);
    } catch (error) {
        await reportInteractionError(interaction, error);
    }
}
