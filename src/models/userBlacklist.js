import { Schema, model } from "mongoose";

/**
 * A per-guild ban on opening tickets.
 *
 * Scoped by `guildId`, so a member barred in one server is unaffected in
 * another; the compound unique index enforces at most one entry per member per
 * guild.
 */
const userBlacklistSchema = new Schema(
    {
        userId: {
            type: String,
            required: true,
            trim: true,
        },
        guildId: {
            type: String,
            required: true,
            trim: true,
        },
        reason: {
            type: String,
            required: true,
            trim: true,
        },
        time: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    {
        versionKey: false,
        strict: "throw",
        minimize: false,
        timestamps: true,
    }
);

userBlacklistSchema.index({ guildId: 1, userId: 1 }, { unique: true });
userBlacklistSchema.index({ guildId: 1, time: -1 });

export default model("UBlacklist", userBlacklistSchema);