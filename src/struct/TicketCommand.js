import { MessageFlags } from "discord.js";
import Interaction from "./Interaction.js";
import { TicketServiceError } from "../services/ticketService.js";
import { alertReply } from "../utils/theme.js";
import { GENERIC_ERROR_MESSAGE } from "../handlers/interactionErrorReporter.js";

/**
 * Base class for ticket slash commands.
 *
 * Owns the defer → run → reply → report lifecycle that every ticket command
 * would otherwise repeat verbatim. Subclasses declare their options in
 * `constructor()` and implement {@link TicketCommand#run}, returning the
 * service result unchanged; rendering and failure reporting happen here.
 *
 * The split matters for error semantics: a {@link TicketServiceError} is a
 * *expected* domain outcome (no permission, not a ticket, already closed) and
 * is shown to the user verbatim, whereas any other error is a genuine defect
 * and is logged with a generic user-facing message.
 *
 * @extends {Interaction}
 */
export default class TicketCommand extends Interaction {
    /**
     * Defers ephemerally, runs the subclass, then renders the outcome.
     *
     * Deferring is guarded because Discord invalidates an interaction after
     * three seconds; a missed acknowledgement must not escape as an unhandled
     * rejection. Every reply path is likewise guarded, since the channel may
     * have been deleted by the very action being performed.
     *
     * @param   {import("discord.js").ChatInputCommandInteraction} interaction
     * @param   {import("./Bot.js").GuildConfig} data Guild configuration.
     * @returns {Promise<void>} Never rejects; failures are reported to the user.
     */
    async exec(interaction, data) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);

        try {
            const result = await this.run(interaction, data);

            if (result?.channelDeleted) {
                return;
            }

            if (result?.reply) {
                await interaction.editReply(result.reply).catch(() => null);
            }
        } catch (error) {
            await interaction.editReply(alertReply("⚠️ Action Failed", {
                description: error instanceof TicketServiceError ? error.message : GENERIC_ERROR_MESSAGE,
            })).catch(() => null);

            if (!(error instanceof TicketServiceError)) {
                interaction.client?.logger?.error(error, { color: "red", tag: "Error" });
            }
        }
    }

    /**
     * Performs the command's work. Subclasses must override.
     *
     * Return the service result directly. A result carrying `channelDeleted`
     * suppresses the reply; a result carrying `reply` is rendered as the
     * ephemeral response.
     *
     * @param   {import("discord.js").ChatInputCommandInteraction} interaction
     * @param   {import("./Bot.js").GuildConfig} data Guild configuration.
     * @returns {Promise<{ reply?: object, channelDeleted?: boolean }|void>}
     * @throws  {TicketServiceError} For expected domain failures, surfaced to the user.
     */
    async run() {
        throw new Error(`${this.name} does not provide a run method !`);
    }
}
