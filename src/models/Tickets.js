import { Schema, model } from "mongoose";

/**
 * A support ticket, backed one-to-one by a Discord private thread.
 *
 * `ticketID` stores the thread snowflake and `ownerId` the member snowflake;
 * Mongo's own `_id` is an ObjectId with no Discord meaning. `strict: "throw"`
 * makes an unknown field a hard error rather than a silent drop.
 */
const ticketSchema = new Schema(
    {
        ownerId: {
            type: String,
            required: true,
            trim: true,
        },
        ticketID: {
            type: String,
            required: true,
            trim: true,
        },
        mainMessageID: {
            type: String,
            default: null,
            trim: true,
        },
        panelMessageID: {
            type: String,
            default: null,
            trim: true,
        },
        guildID: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        closed: {
            type: Boolean,
            default: false,
        },
    },
    {
        versionKey: false,
        strict: "throw",
        minimize: false,
        timestamps: true,
    }
);

ticketSchema.index({ guildID: 1, ticketID: 1 }, { unique: true });
ticketSchema.index({ guildID: 1, closed: 1 });

/*
 * Enforces "one open ticket per user per guild" at the storage layer so
 * concurrent ticket creation cannot slip past an application-level check.
 * Closed tickets are excluded, so a user may reopen after their ticket closes.
 */
ticketSchema.index(
    { guildID: 1, ownerId: 1 },
    { unique: true, partialFilterExpression: { closed: false } }
);

export default model("Tickets", ticketSchema);