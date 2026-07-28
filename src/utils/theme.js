import { EmbedBuilder } from "discord.js";

/**
 * Semantic colour palette.
 *
 * Colour is chosen by meaning rather than by call site, so a "closed" event
 * looks the same everywhere it is rendered.
 */
export const PRIMARY_COLOR = 0x242429;
export const INFO_COLOR = 0x3ccffa;
export const SUCCESS_COLOR = 0x59d253;
export const WARNING_COLOR = 0xe38c47;
export const NOTICE_COLOR = 0xfaea3c;
export const DANGER_COLOR = 0xff3c3c;

/**
 * Builds a themed embed.
 *
 * Every embed in the bot is constructed here so branding stays consistent; only
 * the fields actually supplied are set, keeping the payload minimal.
 *
 * @param   {object}   [options]
 * @param   {string}   [options.title]
 * @param   {string}   [options.description]
 * @param   {object[]} [options.fields]
 * @param   {boolean}  [options.timestamp=false]
 * @param   {number}   [options.color=PRIMARY_COLOR]
 * @returns {EmbedBuilder}
 */
export function buildEmbed({ title, description, fields, timestamp = false, color = PRIMARY_COLOR } = {}) {
    const embed = new EmbedBuilder().setColor(color);

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (fields?.length) embed.addFields(fields);
    if (timestamp) embed.setTimestamp();

    return embed;
}

export const EMBED_FIELD_VALUE_LIMIT = 1024;
export const EMBED_DESCRIPTION_LIMIT = 4096;

/**
 * Joins items into embed text without exceeding Discord's length limits.
 *
 * Only whole items are kept: naively slicing the joined string would split a
 * `<@&id>` mention into broken markup that renders as raw text. Whatever does
 * not fit is summarised as "…and N more", and the suffix is reserved for up
 * front so the result cannot overshoot the limit.
 *
 * @param   {unknown[]} items
 * @param   {string}    [separator=" "]
 * @param   {number}    [limit=EMBED_FIELD_VALUE_LIMIT] Use
 *                      {@link EMBED_DESCRIPTION_LIMIT} for descriptions.
 * @returns {string}    Empty string for an empty list.
 */
export function joinWithinLimit(items, separator = " ", limit = EMBED_FIELD_VALUE_LIMIT) {
    const list = (items ?? []).map(String);
    if (list.length === 0) {
        return "";
    }

    const full = list.join(separator);
    if (full.length <= limit) {
        return full;
    }

    const overflowLabel = (count) => `…and ${count} more`;
    const kept = [];
    let length = 0;

    for (const piece of list) {
        const cost = (kept.length === 0 ? 0 : separator.length) + piece.length;
        const reservedSuffix = separator.length + overflowLabel(list.length - kept.length).length;

        if (length + cost + reservedSuffix > limit) {
            break;
        }

        kept.push(piece);
        length += cost;
    }

    const omitted = list.length - kept.length;
    if (omitted === 0) {
        return kept.join(separator);
    }
    if (kept.length === 0) {
        return overflowLabel(list.length).slice(0, limit);
    }

    return `${kept.join(separator)}${separator}${overflowLabel(omitted)}`;
}

/**
 * Wraps a description in a themed embed message payload.
 *
 * @param   {string} description
 * @param   {object} [options] Extra payload fields, e.g. `{ flags }`.
 * @returns {object} An interaction/message payload.
 */
export function embedReply(description, options = {}) {
    return {
        ...options,
        embeds: [buildEmbed({ description })],
    };
}

/**
 * Builds a titled alert payload for failures and warnings.
 *
 * Defaults to {@link DANGER_COLOR} so failures read as failures at a glance.
 *
 * @param   {string} title
 * @param   {object} [options]
 * @param   {string} [options.description]
 * @param   {number} [options.color=DANGER_COLOR]
 * @returns {object} An interaction/message payload.
 */
export function alertReply(title, { description, color = DANGER_COLOR, ...options } = {}) {
    return {
        ...options,
        embeds: [buildEmbed({ title, description, color })],
    };
}
