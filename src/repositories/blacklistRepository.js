import UserBlacklist from "../models/userBlacklist.js";

/**
 * @typedef {object} BlacklistEntry
 * @property {string} userId  Blacklisted member snowflake.
 * @property {string} guildId Guild the ban applies to.
 * @property {string} reason  Shown to the user when they are blocked.
 * @property {number} time    Epoch milliseconds when the entry was created.
 */

/**
 * Data-access layer for per-guild ticket blacklists.
 *
 * Every query is scoped by `guildId`: blacklists are tenant-local, so a member
 * barred in one server is unaffected in another.
 */

/**
 * @param   {string} userId
 * @param   {string} guildId
 * @returns {Promise<?BlacklistEntry>} `null` when the member is not blacklisted.
 */
export async function findBlacklistByUserId(userId, guildId) {
    return UserBlacklist.findOne({ userId, guildId }).lean();
}

/**
 * @param   {string} guildId
 * @returns {Promise<BlacklistEntry[]>}
 */
export async function listBlacklistByGuildId(guildId) {
    return UserBlacklist.find({ guildId }).lean();
}

/**
 * @param   {BlacklistEntry} entry
 * @returns {Promise<import("mongoose").Document>}
 */
export async function createBlacklistEntry({ userId, guildId, reason, time }) {
    return UserBlacklist.create({ userId, guildId, reason, time });
}

/**
 * @param   {string} userId
 * @param   {string} guildId
 * @returns {Promise<{ deletedCount: number }>}
 */
export async function deleteBlacklistEntry(userId, guildId) {
    return UserBlacklist.deleteOne({ userId, guildId });
}
