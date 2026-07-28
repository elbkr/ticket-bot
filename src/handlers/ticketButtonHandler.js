import { MessageFlags } from "discord.js";
import ticketService, { TicketServiceError } from "../services/ticketService.js";
import reportInteractionError from "./interactionErrorReporter.js";
import { alertReply } from "../utils/theme.js";

/**
 * Maps a button's `customId` to its service call.
 *
 * @param   {import("discord.js").ButtonInteraction} interaction
 * @returns {Promise<object>} The service result.
 * @throws  {TicketServiceError} `UNKNOWN_ACTION` for an unrecognised button.
 */
function resolveButtonAction(interaction) {
    switch (interaction.customId) {
        case "open":
            return ticketService.openTicket({ interaction, guildConfig: interaction.guildConfig });
        case "close":
            return ticketService.closeTicket({ interaction, guildConfig: interaction.guildConfig });
        case "reopen":
            return ticketService.reopenTicket({ interaction, guildConfig: interaction.guildConfig });
        case "transcript":
            return ticketService.saveTranscript({ interaction, guildConfig: interaction.guildConfig });
        case "delete":
        case "archive":
            return ticketService.archiveTicket({ interaction, guildConfig: interaction.guildConfig });
        default:
            throw new TicketServiceError("Unknown ticket action.", "UNKNOWN_ACTION");
    }
}

/**
 * Entry point for every ticket button press.
 *
 * Two acknowledgement strategies are required. Destructive actions
 * (delete/archive) remove the very channel the interaction belongs to, so they
 * defer as an *update* and report failures via `followUp`; an `editReply`
 * against a deleted channel would itself fail. All other actions use a normal
 * ephemeral deferral.
 *
 * Never rejects — failures are rendered to the user and logged.
 *
 * @param   {import("discord.js").ButtonInteraction} interaction
 * @param   {import("../struct/Bot.js").GuildConfig} guildConfig
 * @returns {Promise<void>}
 */
export default async function ticketButtonHandler(interaction, guildConfig) {
    interaction.guildConfig = guildConfig;
    if (interaction.customId === "delete" || interaction.customId === "archive") {
        await interaction.deferUpdate().catch(() => null);

        try {
            await resolveButtonAction(interaction);
        } catch (error) {
            if (error instanceof TicketServiceError) {
                await interaction.followUp({
                    ...alertReply("⚠️ Action Failed", { description: error.message }),
                    flags: MessageFlags.Ephemeral,
                }).catch(() => null);
            } else {
                interaction.client?.logger?.error(error, { color: "red", tag: "Error" });
            }
        }

        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);

    try {
        const result = await resolveButtonAction(interaction);

        if (result?.channelDeleted) return;

        await interaction.editReply(result.reply || result).catch(() => null);
    } catch (error) {
        await reportInteractionError(interaction, error);
    }
}
