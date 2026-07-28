import { TicketServiceError } from "../services/ticketService.js";
import { DANGER_COLOR, alertReply, buildEmbed } from "../utils/theme.js";

/**
 * Shown when a failure is not a {@link TicketServiceError} — an unexpected
 * defect whose real message must not leak internals to end users.
 *
 * @type {string}
 */
export const GENERIC_ERROR_MESSAGE = "Oops! It seems like my devs spilled coffee on the computer :/";

/**
 * @param   {string} reason Moderator-supplied blacklist reason.
 * @returns {object} Message payload explaining the restriction.
 */
function buildBlacklistedReply(reason) {
    return {
        embeds: [
            buildEmbed({ color: DANGER_COLOR })
                .setTitle("⛔ You Have Been Blacklisted")
                .setDescription("You have been blacklisted from creating tickets.")
                .addFields({ name: "Reason", value: reason, inline: false }),
        ],
        components: [],
        files: [],
    };
}

/**
 * Renders an interaction failure back to the user and logs anything unexpected.
 *
 * Shared by the button and modal handlers so both surfaces report identically.
 * Expected domain failures ({@link TicketServiceError}) are shown verbatim and
 * deliberately **not** logged — they are normal outcomes, and logging them
 * would bury genuine defects in noise. Blacklisting gets a dedicated layout
 * because the reason must be presented as policy rather than as an error.
 *
 * Assumes the interaction is already deferred or replied. Never rejects.
 *
 * @param   {import("discord.js").RepliableInteraction} interaction
 * @param   {unknown} error
 * @returns {Promise<void>}
 */
export default async function reportInteractionError(interaction, error) {
    if (error instanceof TicketServiceError && error.code === "BLACKLISTED") {
        await interaction.editReply(buildBlacklistedReply(error.message)).catch(() => null);
        return;
    }

    const description = error instanceof TicketServiceError ? error.message : GENERIC_ERROR_MESSAGE;

    await interaction.editReply(alertReply("⚠️ Action Failed", {
        description,
        components: [],
        files: [],
    })).catch(() => null);

    if (!(error instanceof TicketServiceError)) {
        interaction.client?.logger?.error(error, { color: "red", tag: "Error" });
    }
}
