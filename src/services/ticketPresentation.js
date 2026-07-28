import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} from "discord.js";
import {
    DANGER_COLOR,
    INFO_COLOR,
    NOTICE_COLOR,
    PRIMARY_COLOR,
    SUCCESS_COLOR,
    WARNING_COLOR,
    buildEmbed,
} from "../utils/theme.js";

/**
 * Presentation layer for every ticket surface.
 *
 * Pure and side-effect free: these builders perform no I/O and touch no
 * database, so the service layer can decide *what happened* while this module
 * decides *how it looks*. Keeping the boundary strict means user-facing copy
 * and colour can change without touching business logic.
 */

/**
 * Canonical topic catalogue — the single source of truth for topic keys, their
 * labels and their menu emoji. The select menu, the modal title and the
 * server-side validity check all derive from this object so they cannot drift.
 */
const TICKET_TOPICS = {
    questions: { label: "Server questions", emoji: "❓" },
    appeal: { label: "Mute or ban appeal", emoji: "🔇" },
    report: { label: "Report an user", emoji: "😡" },
    owners: { label: "Contact the owners", emoji: "👑" },
};

/**
 * Topic key → human label, derived from {@link TICKET_TOPICS}.
 *
 * Doubles as the topic whitelist: an unknown key is rejected before a ticket
 * is created.
 *
 * @type {Record<string, string>}
 */
export const TICKET_TOPIC_LABELS = Object.fromEntries(
    Object.entries(TICKET_TOPICS).map(([value, { label }]) => [value, label])
);

/* Names and text formatting */

/**
 * Derives a Discord-safe thread name from the ticket opener.
 *
 * Discord rejects channel names containing arbitrary characters, so the
 * username is reduced to lowercase alphanumerics and dashes, then capped at 90
 * characters. Usernames consisting entirely of unsupported characters (common
 * with non-Latin scripts) collapse to empty, so the user ID is the fallback.
 *
 * @param   {import("discord.js").User} user
 * @returns {string} A valid thread name.
 */
export function buildTicketChannelName(user) {
    const baseName = `ticket-${user.username}`.toLowerCase();
    const safeName = baseName.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return safeName.length > 0 ? safeName.slice(0, 90) : `ticket-${user.id}`;
}

/**
 * @param   {string} ticketId Thread snowflake.
 * @param   {string} guildId
 * @returns {string} Attachment filename, scoped so archived files stay unique.
 */
export function buildTranscriptFileName(ticketId, guildId) {
    return `ticket-${guildId}-${ticketId}-transcript.txt`;
}

/**
 * Renders fetched messages into a plain-text transcript.
 *
 * Bot messages are excluded — panels, control rows and confirmations are noise
 * in a support record. History arrives newest-first from the API and is
 * reversed here so the transcript reads chronologically.
 *
 * @param   {import("discord.js").Message[]} messages
 * @returns {string} Transcript text, or a placeholder when empty.
 */
export function formatTranscript(messages) {
    const lines = messages
        .filter((message) => message.author && message.author.bot !== true)
        .map((message) => {
            const timestamp = new Date(message.createdTimestamp).toLocaleString("en-GB");
            const authorTag = message.author.tag || message.author.username;
            const attachment = message.attachments.size > 0 ? ` ${message.attachments.first().proxyURL}` : "";
            return `${timestamp} - ${authorTag}: ${message.content}${attachment}`;
        })
        .reverse()
        .join("\n");

    return lines.length > 0 ? lines : "No messages sent";
}

/**
 * Wraps transcript text as an uploadable attachment.
 *
 * Used as the fallback when the Hastebin upload fails, so the record survives
 * even when the external service does not.
 *
 * @param   {string} transcript
 * @param   {string} ticketId
 * @param   {string} guildId
 * @returns {import("discord.js").AttachmentBuilder}
 */
export function buildTranscriptAttachment(transcript, ticketId, guildId) {
    return new AttachmentBuilder(Buffer.from(transcript, "utf8"), {
        name: buildTranscriptFileName(ticketId, guildId),
    });
}

/* Components */

/**
 * @returns {import("discord.js").ActionRowBuilder} Topic select menu for the panel.
 */
export function buildTicketTopicRow() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_topic")
        .setPlaceholder("Choose topic")
        .addOptions(
            Object.entries(TICKET_TOPICS).map(([value, { label, emoji }]) => ({
                label,
                value,
                emoji,
            }))
        );

    return new ActionRowBuilder().addComponents(menu);
}

/**
 * Close button attached to a ticket's pinned opening message.
 *
 * Rendered disabled once the ticket closes, so the message remains a record of
 * the control that was available rather than disappearing.
 *
 * @param   {boolean} [disabled=false]
 * @returns {import("discord.js").ActionRowBuilder}
 */
export function buildCloseButtonRow(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("close")
            .setLabel("Close ticket")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
    );
}

/**
 * Staff control panel posted when a ticket closes.
 *
 * @returns {import("discord.js").ActionRowBuilder} Reopen, Save and Delete actions.
 */
export function buildClosedControlPanelRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("reopen")
            .setLabel("Reopen")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("transcript")
            .setLabel("Save")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("delete")
            .setLabel("Delete")
            .setStyle(ButtonStyle.Danger)
    );
}

/**
 * @param   {string} url Hastebin paste URL.
 * @returns {import("discord.js").ActionRowBuilder} Link button opening the transcript.
 */
export function buildTranscriptRow(url) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("View transcript")
            .setURL(url)
            .setStyle(ButtonStyle.Link)
    );
}

/* Ticket embeds */

/**
 * @returns {import("discord.js").EmbedBuilder} The public ticket panel.
 */
export function buildPanelEmbed() {
    return buildEmbed({
        title: "Open a ticket",
        description: "Choose a topic below to open a private support ticket.",
    });
}

/**
 * The pinned opening message summarising why a ticket exists.
 *
 * @param   {object} params
 * @param   {string} params.subject
 * @param   {string} params.topicLabel
 * @param   {import("discord.js").User} params.user Ticket owner.
 * @param   {string} params.description
 * @returns {import("discord.js").EmbedBuilder}
 */
export function buildTicketOpeningEmbed({ subject, topicLabel, user, description }) {
    return buildEmbed({
        title: subject,
        fields: [
            { name: "Topic", value: topicLabel, inline: true },
            { name: "Opened by", value: `${user}`, inline: true },
            { name: "Description", value: description, inline: false },
        ],
        timestamp: true,
    });
}

export function buildControlPanelEmbed() {
    return buildEmbed({
        title: "Ticket control panel",
        timestamp: true,
    });
}

export function buildTranscriptSavedEmbed({ attached = false } = {}) {
    return buildEmbed({
        title: "📝 Transcript Saved",
        description: attached
            ? "The transcript has been attached as a file."
            : "The transcript has been successfully saved.",
    });
}

/**
 * Rich archive record posted to the transcript channel.
 *
 * Carries the full provenance of the ticket — who opened it, who saved it, when
 * it was created and closed — because the thread itself is usually deleted
 * shortly afterwards, leaving this embed as the only durable record.
 *
 * @param   {object} params
 * @param   {import("discord.js").GuildMember} params.owner
 * @param   {import("discord.js").User} params.moderator Who triggered the save.
 * @param   {string} params.channelName
 * @param   {string} params.ticketId
 * @param   {Date|string} [params.createdAt]
 * @param   {boolean} [params.attached=false] Whether delivery fell back to a file.
 * @returns {import("discord.js").EmbedBuilder}
 */
export function buildTranscriptArchiveEmbed({ owner, moderator, channelName, ticketId, createdAt, attached = false }) {
    const fields = [
        { name: "Ticket Owner", value: `${owner} (\`${owner.id}\`)`, inline: true },
        { name: "Saved By", value: `${moderator}`, inline: true },
        { name: "Ticket", value: `${channelName} (\`${ticketId}\`)`, inline: true },
    ];

    if (createdAt) {
        fields.push({
            name: "Created",
            value: `<t:${Math.floor(new Date(createdAt).getTime() / 1000)}:F>`,
            inline: true,
        });
    }

    fields.push({
        name: "Saved",
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: true,
    });

    return buildEmbed({
        title: "📝 Transcript Saved",
        description: attached
            ? "The transcript has been attached as a file."
            : "The transcript has been successfully saved.",
        color: PRIMARY_COLOR,
        fields,
        timestamp: true,
    });
}

/* Replies sent back to the interacting user */

export function buildTicketOpenedReplyEmbed(channel) {
    return buildEmbed({
        title: "✅ Ticket Opened",
        description: `Your ticket ${channel} has been successfully opened!`,
    });
}

export function buildTicketClosedReplyEmbed() {
    return buildEmbed({
        title: "🔒 Ticket Closed",
        description: "The ticket has been closed successfully.",
    });
}

export function buildTicketReopenedReplyEmbed() {
    return buildEmbed({
        title: "🔓 Ticket Reopened",
        description: "The ticket has been reopened.",
    });
}

export function buildUserAddedReplyEmbed(user) {
    return buildEmbed({
        title: "➕ User Added",
        description: `${user} has been added to the ticket!`,
    });
}

export function buildUserRemovedReplyEmbed(user) {
    return buildEmbed({
        title: "➖ User Removed",
        description: `${user} has been removed from the ticket!`,
    });
}

/* Log embeds */

/**
 * Warning logged when a ticket thread is deleted by hand.
 *
 * Deliberately does not use the standard log skeleton: there is no moderator to
 * attribute (Discord's gateway does not identify who deleted a thread) and the
 * absence of a transcript is the point of the entry.
 *
 * @param   {object} params
 * @param   {string} params.ticketId
 * @param   {import("discord.js").GuildMember} params.owner
 * @returns {import("discord.js").EmbedBuilder}
 */
export function buildTicketManuallyDeletedLogEmbed({ ticketId, owner }) {
    return buildEmbed({
        title: "⚠️ Ticket Manually Deleted",
        color: DANGER_COLOR,
        fields: [
            { name: "Ticket", value: `${ticketId}`, inline: true },
            { name: "Opened by", value: `${owner}`, inline: true },
            {
                name: "Warning",
                value: "Transcript unavailable because the thread was deleted manually.",
                inline: false,
            },
        ],
        timestamp: true,
    });
}

/**
 * Shared skeleton for audit-log embeds.
 *
 * Every ticket event logs the same three facts — actor, ticket and owner — so
 * entries can be scanned uniformly; the wrappers below supply only the title,
 * semantic colour and any event-specific fields.
 *
 * @param   {object} params
 * @param   {string} params.title
 * @param   {number} [params.color=PRIMARY_COLOR]
 * @param   {import("discord.js").User} params.moderator
 * @param   {string} params.ticketId
 * @param   {import("discord.js").GuildMember|import("discord.js").User} params.owner
 * @param   {object[]} [params.fields] Appended after the standard three.
 * @returns {import("discord.js").EmbedBuilder}
 */
export function buildTicketLogEmbed({ title, color = PRIMARY_COLOR, moderator, ticketId, owner, fields = [] }) {
    return buildEmbed({
        title,
        color,
        fields: [
            { name: "Moderator", value: `${moderator}`, inline: true },
            { name: "Ticket", value: `${ticketId}`, inline: true },
            { name: "Opened by", value: `${owner}`, inline: true },
            ...fields,
        ],
        timestamp: true,
    });
}

export function buildTicketOpenedLogEmbed({ moderator, ticketId, owner, topicLabel, subject }) {
    return buildTicketLogEmbed({
        title: "Ticket opened",
        color: PRIMARY_COLOR,
        moderator,
        ticketId,
        owner,
        fields: [
            { name: "Topic", value: topicLabel, inline: true },
            { name: "Subject", value: subject, inline: false },
        ],
    });
}

export function buildTicketClosedLogEmbed({ moderator, ticketId, owner }) {
    return buildTicketLogEmbed({
        title: "Ticket closed",
        color: WARNING_COLOR,
        moderator,
        ticketId,
        owner,
    });
}

/**
 * Audit entry for a ticket deleted through the bot.
 *
 * This is the ticket's final record — the thread is destroyed moments later —
 * so the transcript link is embedded here when one exists, rather than leaving
 * it only in the separate "transcript saved" entry.
 *
 * @param   {object} params
 * @param   {import("discord.js").User} params.moderator Who triggered the deletion.
 * @param   {string} params.ticketId
 * @param   {import("discord.js").GuildMember|string} params.owner
 * @param   {?string} [params.transcriptUrl] Present only when a transcript was archived.
 * @returns {import("discord.js").EmbedBuilder}
 */
export function buildTicketDeletedLogEmbed({ moderator, ticketId, owner, transcriptUrl = null }) {
    return buildTicketLogEmbed({
        title: "Ticket deleted",
        color: DANGER_COLOR,
        moderator,
        ticketId,
        owner,
        fields: transcriptUrl
            ? [{ name: "Transcript", value: transcriptUrl, inline: false }]
            : [],
    });
}

export function buildTicketReopenedLogEmbed({ moderator, ticketId, owner }) {
    return buildTicketLogEmbed({
        title: "Ticket reopened",
        color: NOTICE_COLOR,
        moderator,
        ticketId,
        owner,
    });
}

export function buildTranscriptSavedLogEmbed({ moderator, ticketId, owner, transcriptUrl }) {
    return buildTicketLogEmbed({
        title: "Ticket transcript saved",
        color: INFO_COLOR,
        moderator,
        ticketId,
        owner,
        fields: [
            {
                name: "Transcript",
                value: transcriptUrl ? transcriptUrl : "Transcript attached as file",
                inline: false,
            },
        ],
    });
}

export function buildUserAddedLogEmbed({ moderator, ticketId, owner, targetUser }) {
    return buildTicketLogEmbed({
        title: "User added",
        color: SUCCESS_COLOR,
        moderator,
        ticketId,
        owner,
        fields: [{ name: "User", value: `${targetUser}`, inline: true }],
    });
}

export function buildUserRemovedLogEmbed({ moderator, ticketId, owner, targetUser }) {
    return buildTicketLogEmbed({
        title: "User removed",
        color: DANGER_COLOR,
        moderator,
        ticketId,
        owner,
        fields: [{ name: "User", value: `${targetUser}`, inline: true }],
    });
}
