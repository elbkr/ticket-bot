import Tickets from "../models/Tickets.js";

/**
 * @typedef {import("../services/ticketService.js").Ticket} Ticket
 */

/**
 * Data-access layer for ticket records.
 *
 * Every read returns a lean plain object rather than a hydrated Mongoose
 * document: callers treat tickets as immutable snapshots and persist changes
 * through the explicit setters below, which keeps writes atomic and prevents a
 * stale in-memory document from overwriting concurrent updates.
 *
 * Note that `ticketID` is the Discord **thread** snowflake and `ownerId` the
 * member snowflake; `_id` is Mongo's own identifier and carries no Discord
 * meaning.
 */

/**
 * @param   {string} guildID
 * @param   {string} ticketID Thread snowflake.
 * @returns {Promise<?Ticket>}
 */
export async function findTicketByGuildAndTicketId(guildID, ticketID) {
    return Tickets.findOne({ guildID, ticketID }).lean();
}

/**
 * Lists every open ticket across all guilds.
 *
 * Used by the startup reconciliation sweep to detect records whose thread no
 * longer exists.
 *
 * @returns {Promise<Ticket[]>}
 */
export async function listOpenTickets() {
    return Tickets.find({ closed: false }).lean();
}

/**
 * @returns {Promise<number>} Count of open tickets, for the presence indicator.
 */
export async function countOpenTickets() {
    return Tickets.countDocuments({ closed: false });
}

/**
 * Inserts a ticket record.
 *
 * @param   {{ ownerId: string, guildID: string, ticketID: string, mainMessageID?: ?string, panelMessageID?: ?string, closed?: boolean }} data
 * @returns {Promise<import("mongoose").Document>}
 * @throws  {Error} MongoDB error 11000 when the owner already has an open
 *                  ticket in that guild — the partial unique index, not the
 *                  application, is what enforces that rule.
 */
export async function createTicket(data) {
    const ticket = new Tickets({
        ownerId: data.ownerId,
        guildID: data.guildID,
        ticketID: data.ticketID,
        mainMessageID: data.mainMessageID ?? null,
        panelMessageID: data.panelMessageID ?? null,
        closed: data.closed ?? false,
    });

    return ticket.save();
}

/**
 * @param   {string}  ticketID
 * @param   {boolean} closed
 * @returns {Promise<?import("mongoose").Document>} The post-update document.
 */
export async function setTicketClosedStateByTicketId(ticketID, closed) {
    return Tickets.findOneAndUpdate(
        { ticketID },
        { $set: { closed } },
        { returnDocument: "after", runValidators: true }
    );
}

/**
 * Records the pinned opening message that carries the close button.
 *
 * @param   {string}  ticketID
 * @param   {?string} mainMessageID
 * @returns {Promise<?import("mongoose").Document>}
 */
export async function setTicketMainMessageIdByTicketId(ticketID, mainMessageID) {
    return Tickets.findOneAndUpdate(
        { ticketID },
        { $set: { mainMessageID } },
        { returnDocument: "after", runValidators: true }
    );
}

/**
 * Records the control panel posted on close, so it can be removed on reopen.
 *
 * @param   {string}  ticketID
 * @param   {?string} panelMessageID Pass `null` to clear.
 * @returns {Promise<?import("mongoose").Document>}
 */
export async function setTicketPanelMessageIdByTicketId(ticketID, panelMessageID) {
    return Tickets.findOneAndUpdate(
        { ticketID },
        { $set: { panelMessageID } },
        { returnDocument: "after", runValidators: true }
    );
}

/**
 * Guild-scoped delete, used where the caller knows the owning guild.
 *
 * @param   {string} guildID
 * @param   {string} ticketID
 * @returns {Promise<{ deletedCount: number }>}
 */
export async function deleteTicketByGuildAndTicketId(guildID, ticketID) {
    return Tickets.deleteOne({ guildID, ticketID });
}

/**
 * @param   {string} ticketID
 * @returns {Promise<{ deletedCount: number }>}
 */
export async function deleteTicketByTicketId(ticketID) {
    return Tickets.deleteOne({ ticketID });
}
