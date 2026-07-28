import { Schema, model } from "mongoose";

/**
 * Per-guild configuration — the unit of multi-tenant isolation.
 *
 * `_id` is the Discord guild snowflake rather than a generated ObjectId, so a
 * guild's configuration is addressable directly by its ID with no secondary
 * index required.
 */
const guildSchema = new Schema(
    {
        _id: {
            type: String,
            required: true,
            trim: true,
        },
        modRoles: {
            type: [String],
            default: [],
        },
        logsChannel: {
            type: String,
            default: null,
            trim: true,
        },
        transcriptChannel: {
            type: String,
            default: null,
            trim: true,
        },
        ticketsParent: {
            type: String,
            default: null,
            trim: true,
        },
    },
    {
        versionKey: false,
        strict: "throw",
        minimize: false,
        timestamps: true,
    }
);

/*
 * No secondary indexes: _id is the primary key and every query filters on it
 * alone, so compound indexes prefixed with _id could never improve a plan while
 * still costing write amplification and storage.
 */

export default model("Guilds", guildSchema);