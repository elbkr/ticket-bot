import {
    ChannelType,
    PermissionFlagsBits,
    ThreadAutoArchiveDuration,
} from "discord.js";
import { findBlacklistByUserId } from "../repositories/blacklistRepository.js";
import * as ticketRepository from "../repositories/ticketRepository.js";
import {
    TICKET_TOPIC_LABELS,
    buildCloseButtonRow,
    buildClosedControlPanelRow,
    buildControlPanelEmbed,
    buildPanelEmbed,
    buildTicketChannelName,
    buildTicketClosedLogEmbed,
    buildTicketClosedReplyEmbed,
    buildTicketDeletedLogEmbed,
    buildTicketOpenedLogEmbed,
    buildTicketOpenedReplyEmbed,
    buildTicketOpeningEmbed,
    buildTicketReopenedLogEmbed,
    buildTicketReopenedReplyEmbed,
    buildTicketTopicRow,
    buildTranscriptArchiveEmbed,
    buildTranscriptAttachment,
    buildTranscriptRow,
    buildTranscriptSavedEmbed,
    buildTranscriptSavedLogEmbed,
    buildUserAddedLogEmbed,
    buildUserAddedReplyEmbed,
    buildUserRemovedLogEmbed,
    buildUserRemovedReplyEmbed,
    formatTranscript,
} from "./ticketPresentation.js";

const HASTE_DOCUMENTS_URL = "https://hastebin.blackforthosting.com/documents";
const HASTE_BASE_URL = "https://hastebin.blackforthosting.com";
const TRANSCRIPT_TIMEOUT_MS = 10_000;
const TRANSCRIPT_PAGE_SIZE = 100;
const MAX_TRANSCRIPT_MESSAGES = 5000;

/**
 * @typedef {import("../struct/Bot.js").GuildConfig} GuildConfig
 */

/**
 * @typedef {object} Ticket
 * @property {string}  ownerId        Snowflake of the member who opened the ticket.
 * @property {string}  ticketID       Snowflake of the backing thread.
 * @property {string}  guildID        Guild the ticket belongs to.
 * @property {?string} mainMessageID  Pinned opening message, holds the close button.
 * @property {?string} panelMessageID Control panel posted when the ticket closes.
 * @property {boolean} closed
 * @property {Date}    createdAt
 */

/**
 * @typedef {object} TranscriptArtifact
 * @property {"url"|"attachment"} mode       How the transcript was delivered.
 * @property {import("discord.js").EmbedBuilder[]} embeds
 * @property {?string} url                   Hastebin URL, `null` in attachment mode.
 * @property {import("discord.js").ActionRowBuilder[]} components
 * @property {import("discord.js").AttachmentBuilder[]} files
 * @property {string}  transcript            Rendered transcript text.
 */

/**
 * An expected, user-facing failure raised by the ticket service.
 *
 * Distinguishes domain outcomes ("you already have a ticket open") from genuine
 * defects: callers surface `message` verbatim to the user and only log errors
 * that are *not* instances of this class.
 */
export class TicketServiceError extends Error {
    /**
     * @param {string}  message Shown directly to the end user.
     * @param {string}  code    Stable machine-readable code, e.g. `"FORBIDDEN"`.
     * @param {unknown} [cause] Underlying error, preserved for logging.
     */
    constructor(message, code, cause) {
        super(message, cause ? { cause } : undefined);
        this.name = "TicketServiceError";
        this.code = code;
    }
}

/**
 * Coerces a stored `modRoles` value into a clean array of role IDs.
 *
 * @param   {unknown}  modRoles Raw value from the guild config.
 * @returns {string[]}          Role IDs, empty when unset or malformed.
 */
function normalizeRoleIds(modRoles) {
    return Array.isArray(modRoles) ? modRoles.filter(Boolean) : [];
}

/**
 * Detects a MongoDB duplicate-key violation (error 11000), whether raised
 * directly or wrapped by Mongoose.
 *
 * @param   {unknown} error
 * @returns {boolean}
 */
function isDuplicateKeyError(error) {
    return error?.code === 11000 || error?.cause?.code === 11000;
}

/**
 * Pages backwards through a channel's history for transcript generation.
 *
 * Capped at {@link MAX_TRANSCRIPT_MESSAGES}: an unbounded walk on a long-lived
 * ticket would issue hundreds of API calls and hold every message in memory
 * while a user waits on the interaction.
 *
 * @param   {import("discord.js").TextBasedChannel} channel
 * @returns {Promise<{ messages: import("discord.js").Message[], truncated: boolean }>}
 *          `truncated` is `true` when the cap stopped the walk early.
 */
async function fetchAllMessages(channel) {
    const collected = [];
    let before;
    let truncated = false;

    for (;;) {
        const batch = await channel.messages.fetch({
            limit: TRANSCRIPT_PAGE_SIZE,
            ...(before ? { before } : {}),
        });

        if (batch.size === 0) {
            break;
        }

        collected.push(...batch.values());

        if (batch.size < TRANSCRIPT_PAGE_SIZE) {
            break;
        }

        /* Bound memory and API usage on very long-lived tickets. */
        if (collected.length >= MAX_TRANSCRIPT_MESSAGES) {
            truncated = true;
            break;
        }

        const lastMessage = batch.last();
        before = lastMessage ? lastMessage.id : undefined;
    }

    return {
        messages: collected.slice(0, MAX_TRANSCRIPT_MESSAGES),
        truncated,
    };
}

/**
 * Uploads transcript text to Hastebin and returns its public URL.
 *
 * Aborted after {@link TRANSCRIPT_TIMEOUT_MS} so an unresponsive third party
 * cannot stall a ticket action indefinitely.
 *
 * @param   {string} content Rendered transcript.
 * @returns {Promise<string>} Public paste URL.
 * @throws  {Error} On timeout, non-2xx response, or a malformed payload.
 */
async function uploadTranscriptToHastebin(content) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRANSCRIPT_TIMEOUT_MS);

    try {
        const response = await fetch(HASTE_DOCUMENTS_URL, {
            method: "POST",
            body: content,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`Transcript upload failed with status ${response.status}`);
        }

        const payload = await response.json();
        if (!payload || typeof payload.key !== "string" || payload.key.length === 0) {
            throw new Error("Transcript upload did not return a key.");
        }

        return `${HASTE_BASE_URL}/${payload.key}`;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Renders a channel's history into a deliverable transcript.
 *
 * Prefers a Hastebin link so the transcript stays readable in-client; if the
 * upload fails for any reason the text is degraded to a file attachment rather
 * than losing the record entirely.
 *
 * @param   {import("discord.js").TextBasedChannel} channel
 * @param   {Ticket} ticket
 * @returns {Promise<TranscriptArtifact>}
 */
async function createTranscriptArtifact(channel, ticket) {
    const { messages, truncated } = await fetchAllMessages(channel);
    const body = formatTranscript(messages);
    const transcript = truncated
        ? `[Transcript truncated to the most recent ${MAX_TRANSCRIPT_MESSAGES} messages.]\n\n${body}`
        : body;

    try {
        const url = await uploadTranscriptToHastebin(transcript);
        return {
            mode: "url",
            embeds: [buildTranscriptSavedEmbed()],
            url,
            components: [buildTranscriptRow(url)],
            files: [],
            transcript,
        };
    } catch {
        const attachment = buildTranscriptAttachment(transcript, channel.id, ticket.guildID);

        return {
            mode: "attachment",
            embeds: [buildTranscriptSavedEmbed({ attached: true })],
            url: null,
            components: [],
            files: [attachment],
            transcript,
            attachment,
        };
    }
}

/**
 * Guards that an action is running somewhere a ticket can exist.
 *
 * `GuildText` remains accepted alongside `PrivateThread` for tickets created
 * before the bot moved to a thread-based model.
 *
 * @param   {import("discord.js").Channel} channel
 * @returns {void}
 * @throws  {TicketServiceError} `INVALID_CHANNEL` for any other channel type.
 */
function assertTextChannel(channel) {
    if (!channel || ![ChannelType.GuildText, ChannelType.PrivateThread].includes(channel.type)) {
        throw new TicketServiceError("This action can only be used in a ticket channel or private thread.", "INVALID_CHANNEL");
    }
}

/**
 * Determines which text channel will host a new ticket thread.
 *
 * Prefers the guild's configured `ticketsParent`, which lets every ticket be
 * grouped into one channel regardless of where the panel was posted. Discord
 * permits threads only on text channels, so a parent that is missing, deleted,
 * or of any other type (notably a category, which earlier versions stored here)
 * is rejected and the panel's own channel is used instead — a misconfigured
 * setting should degrade to a working default, not block ticket creation.
 *
 * @param   {import("discord.js").Interaction} interaction
 * @param   {GuildConfig} guildConfig
 * @returns {Promise<import("discord.js").TextChannel>} The thread's parent.
 * @throws  {TicketServiceError} `INVALID_THREAD_PARENT` when neither the
 *                               configured parent nor the fallback can host a
 *                               thread.
 */
async function resolveTicketParentChannel(interaction, guildConfig) {
    const configuredParent = guildConfig?.ticketsParent
        ? await interaction.guild.channels.fetch(guildConfig.ticketsParent).catch(() => null)
        : null;

    if (configuredParent?.type === ChannelType.GuildText) {
        return configuredParent;
    }

    if (guildConfig?.ticketsParent) {
        interaction.client.logger?.warn(
            configuredParent
                ? `Configured ticket parent ${guildConfig.ticketsParent} is not a text channel; falling back to the panel's channel. Update it with /set parent.`
                : `Configured ticket parent ${guildConfig.ticketsParent} could not be resolved; falling back to the panel's channel.`,
            { tag: "createTicket" }
        );
    }

    const fallbackChannel = interaction.channel;

    if (!fallbackChannel || fallbackChannel.type !== ChannelType.GuildText) {
        throw new TicketServiceError(
            "Ticket threads must be created in a text channel. Configure one with `/set parent`, or use the panel inside a text channel.",
            "INVALID_THREAD_PARENT"
        );
    }

    return fallbackChannel;
}

/**
 * Adds the ticket owner and all configured staff to a freshly created thread.
 *
 * Staff are resolved from each role's own member list rather than a guild-wide
 * member fetch, which would download every member over the gateway on the hot
 * path of the bot's most common action. The trade-off is that staff missing
 * from the member cache are not auto-added.
 *
 * Membership additions are settled in parallel and individually tolerant of
 * failure, so one un-addable member cannot block the rest.
 *
 * @param   {import("discord.js").ThreadChannel} thread
 * @param   {import("discord.js").Interaction} interaction
 * @param   {GuildConfig} guildConfig
 * @returns {Promise<void>}
 */
async function addTicketThreadMembers(thread, interaction, guildConfig) {
    await thread.members.add(interaction.user.id);

    const modRoleIds = normalizeRoleIds(guildConfig?.modRoles);
    if (modRoleIds.length === 0) return;

    const staffIds = new Set();
    for (const roleId of modRoleIds) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) continue;

        for (const member of role.members.values()) {
            if (!member.user.bot && member.id !== interaction.user.id) {
                staffIds.add(member.id);
            }
        }
    }

    if (staffIds.size === 0) return;

    await Promise.allSettled([...staffIds].map((memberId) => thread.members.add(memberId)));
}

/**
 * Determines whether a member counts as ticket staff for a guild.
 *
 * Server managers and administrators always qualify, so a guild that has not
 * configured `modRoles` yet is never locked out of its own tickets.
 *
 * @param   {import("discord.js").GuildMember} member
 * @param   {GuildConfig} guildConfig
 * @returns {boolean}
 */
function isStaffMember(member, guildConfig) {
    const modRoleIds = normalizeRoleIds(guildConfig?.modRoles);
    return (
        member.permissions.has(PermissionFlagsBits.ManageGuild) ||
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.roles.cache.some((role) => modRoleIds.includes(role.id))
    );
}

/**
 * Authorisation gate for privileged ticket actions.
 *
 * Named separately from {@link isStaffMember} to mark the two distinct call
 * sites: this one answers "may this member perform the action", the other
 * answers "should this member retain channel access".
 *
 * @param   {import("discord.js").GuildMember} member
 * @param   {GuildConfig} guildConfig
 * @returns {boolean}
 */
function hasTicketStaffAccess(member, guildConfig) {
    return isStaffMember(member, guildConfig);
}

/**
 * Best-effort delivery of an audit-log message.
 *
 * Logging is deliberately non-fatal: a deleted or unreachable log channel must
 * never abort the ticket operation that produced the entry, so every failure
 * mode resolves to `null` instead of throwing.
 *
 * @param   {import("discord.js").Guild} guild
 * @param   {?string} channelId Configured log channel; falsy skips silently.
 * @param   {import("discord.js").MessagePayload|object} payload
 * @returns {Promise<?import("discord.js").Message>} `null` when not delivered.
 */
async function sendLogMessage(guild, channelId, payload) {
    if (!channelId) {
        return null;
    }

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) {
        return null;
    }

    return channel.send(payload).catch(() => null);
}

/**
 * Ticket domain logic.
 *
 * This layer owns authorisation, persistence and Discord side effects; it holds
 * no rendering code — every embed, button and transcript string comes from
 * `ticketPresentation.js`. Methods return plain result objects (`{ reply, … }`)
 * and never touch the interaction directly, which keeps them callable from
 * slash commands, buttons and modals alike.
 */
export class TicketService {
    /**
     * Posts the public ticket-opening panel into a channel.
     *
     * @param   {object} params
     * @param   {import("discord.js").Interaction} params.interaction
     * @param   {import("discord.js").TextChannel} params.channel Destination channel.
     * @returns {Promise<{ reply: object }>}
     * @throws  {TicketServiceError} `FORBIDDEN` without Manage Server;
     *                               `INVALID_CHANNEL` for a non-text channel.
     */
    async sendTicketPanel({interaction, channel}) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            throw new TicketServiceError("You don't have permission to do that!", "FORBIDDEN");
        }

        if (!channel || channel.type !== ChannelType.GuildText) {
            throw new TicketServiceError("That channel must be a text channel!", "INVALID_CHANNEL");
        }

        await channel.send({
            embeds: [buildPanelEmbed()],
            components: [buildTicketTopicRow()],
        });

        return {
            reply: {
                content: `Ticket panel sent to ${channel}!`,
            },
        };
    }

    /**
     * Opens a new ticket: creates the private thread, persists the record, and
     * posts the pinned opening message.
     *
     * "One open ticket per user" is enforced by a partial unique index rather
     * than a read-then-write check, which no amount of application-level
     * guarding could make race-free across concurrent submissions. A duplicate
     * key is therefore an expected outcome and is translated back into
     * `TICKET_ALREADY_OPEN`.
     *
     * Thread creation precedes persistence, so any failure after the thread
     * exists rolls back both the record and the thread — a ticket must never
     * outlive its channel, nor a channel its record.
     *
     * @param   {object} params
     * @param   {import("discord.js").Interaction} params.interaction
     * @param   {GuildConfig} params.guildConfig
     * @param   {string} params.topic       Key from `TICKET_TOPIC_LABELS`.
     * @param   {string} params.subject     Modal subject field.
     * @param   {string} params.description Modal description field.
     * @returns {Promise<{ ticket: Ticket, channel: import("discord.js").ThreadChannel, initialMessage: import("discord.js").Message, reply: object }>}
     * @throws  {TicketServiceError} `INVALID_TOPIC`, `BLACKLISTED`, or
     *                               `TICKET_ALREADY_OPEN`.
     */
    async createTicket({interaction, guildConfig, topic, subject, description}) {
        assertTextChannel(interaction.channel);

        const topicLabel = TICKET_TOPIC_LABELS[topic];
        if (!topicLabel) {
            throw new TicketServiceError("Unknown ticket topic.", "INVALID_TOPIC");
        }

        const blacklistEntry = await findBlacklistByUserId(interaction.user.id, interaction.guildId);
        if (blacklistEntry) {
            throw new TicketServiceError(
                blacklistEntry.reason,
                "BLACKLISTED"
            );
        }

        const parentChannel = await resolveTicketParentChannel(interaction, guildConfig);
        const thread = await parentChannel.threads.create({
            name: buildTicketChannelName(interaction.user),
            type: ChannelType.PrivateThread,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
            invitable: false,
            reason: `Ticket opened by ${interaction.user.tag}`,
        });

        try {
            await addTicketThreadMembers(thread, interaction, guildConfig);

            const ticket = await ticketRepository.createTicket({
                ownerId: interaction.user.id,
                guildID: interaction.guildId,
                ticketID: thread.id,
            });

            const initialMessage = await thread.send({
                content: `${interaction.user}`,
                embeds: [buildTicketOpeningEmbed({
                    subject,
                    topicLabel,
                    user: interaction.user,
                    description,
                })],
                components: [buildCloseButtonRow()],
            });
            await initialMessage.pin().catch(() => null);

            await ticketRepository.setTicketMainMessageIdByTicketId(thread.id, initialMessage.id);

            if (guildConfig?.logsChannel) {
                const logEmbed = buildTicketOpenedLogEmbed({
                    moderator: interaction.user,
                    ticketId: thread.id,
                    owner: interaction.user,
                    topicLabel,
                    subject,
                });

                await sendLogMessage(interaction.guild, guildConfig.logsChannel, {embeds: [logEmbed]});
            }

            return {
                ticket,
                channel: thread,
                initialMessage,
                reply: {
                    embeds: [buildTicketOpenedReplyEmbed(thread)]
                },
            };
        } catch (error) {
            await ticketRepository.deleteTicketByTicketId(thread.id).catch(() => null);
            await thread.delete().catch(() => null);

            /*
             * The { guildID, ownerId } partial unique index is the authority on
             * "one open ticket per user" — a duplicate here means a concurrent
             * request won the race, so report it as an already-open ticket.
             */
            if (isDuplicateKeyError(error)) {
                throw new TicketServiceError("You already have a ticket open!", "TICKET_ALREADY_OPEN");
            }

            throw error;
        }
    }

    /**
     * Returns the ticket panel as an ephemeral reply.
     *
     * Opening is a two-step flow: this renders the topic picker, and the
     * resulting modal submission is what actually calls {@link TicketService#createTicket}.
     *
     * @returns {Promise<{ reply: object }>}
     */
    async openTicket() {
        return {
            reply: {
                embeds: [buildPanelEmbed()],
                components: [buildTicketTopicRow()],
            },
        };
    }

    /**
     * Closes an open ticket, revoking access and locking the thread.
     *
     * The ticket **owner** may close their own ticket; every other action in
     * this service is staff-only. Access revocation is batched in parallel and
     * failure-tolerant, since a member who has already left cannot be edited.
     *
     * The optional flags exist so {@link TicketService#archiveTicket} can reuse
     * this method as its closing step without emitting a duplicate reply, a
     * redundant control panel, or a second audit entry.
     *
     * @param   {object} params
     * @param   {import("discord.js").Interaction} params.interaction
     * @param   {GuildConfig} params.guildConfig
     * @param   {boolean} [params.silent=false]            Suppress the user-facing reply.
     * @param   {boolean} [params.createControlPanel=true] Post the reopen/save/delete panel.
     * @param   {boolean} [params.logAction=true]          Emit an audit-log entry.
     * @returns {Promise<{ ticket: Ticket, controlPanelMessage: ?import("discord.js").Message, reply: ?object }>}
     * @throws  {TicketServiceError} `TICKET_NOT_FOUND`, `TICKET_ALREADY_CLOSED`,
     *                               or `FORBIDDEN` for a non-owner, non-staff caller.
     */
    async closeTicket({interaction, guildConfig, silent = false, createControlPanel = true, logAction = true}) {
        assertTextChannel(interaction.channel);

        const ticket = await ticketRepository.findTicketByGuildAndTicketId(interaction.guildId, interaction.channel.id);
        if (!ticket) {
            throw new TicketServiceError("This is not a ticket!", "TICKET_NOT_FOUND");
        }

        if (ticket.closed) {
            throw new TicketServiceError("This ticket is already closed!", "TICKET_ALREADY_CLOSED");
        }

        const isOwner = interaction.user.id === ticket.ownerId;
        if (!isOwner && !hasTicketStaffAccess(interaction.member, guildConfig)) {
            throw new TicketServiceError("You don't have permission to do that!", "FORBIDDEN");
        }

        const mainMessage = ticket.mainMessageID ? await interaction.channel.messages.fetch(ticket.mainMessageID).catch(() => null) : null;
        if (mainMessage) {
            await mainMessage.edit({
                components: [buildCloseButtonRow(true)],
            });
        }

        if (interaction.channel.type === ChannelType.GuildText) {
            const revokedIds = [...interaction.channel.members.values()]
                .filter((member) =>
                    member.id !== interaction.client.user.id &&
                    member.id !== ticket.ownerId &&
                    !isStaffMember(member, guildConfig)
                )
                .map((member) => member.id);

            /* The owner always loses access on close, alongside any non-staff. */
            revokedIds.push(ticket.ownerId);

            await Promise.allSettled(
                revokedIds.map((memberId) => interaction.channel.permissionOverwrites.edit(memberId, {
                    ViewChannel: false,
                    SendMessages: false,
                }))
            );
        }

        await ticketRepository.setTicketClosedStateByTicketId(interaction.channel.id, true);

        let controlPanelMessage = null;
        if (createControlPanel) {
            controlPanelMessage = await interaction.channel.send({
                embeds: [buildControlPanelEmbed()],
                components: [buildClosedControlPanelRow()],
            });

            await ticketRepository.setTicketPanelMessageIdByTicketId(interaction.channel.id, controlPanelMessage.id);
        } else {
            await ticketRepository.setTicketPanelMessageIdByTicketId(interaction.channel.id, null);
        }

        if (interaction.channel.type === ChannelType.PrivateThread) {
            await interaction.channel.setLocked(true, `Ticket closed by ${interaction.user.tag}`);
        }

        if (logAction && guildConfig?.logsChannel) {
            const owner = await interaction.guild.members.fetch(ticket.ownerId);
            const logEmbed = buildTicketClosedLogEmbed({
                moderator: interaction.user,
                ticketId: interaction.channel.id,
                owner,
            });

            await sendLogMessage(interaction.guild, guildConfig.logsChannel, {embeds: [logEmbed]});
        }

        return {
            ticket: {
                ...ticket,
                closed: true,
            },
            controlPanelMessage,
            reply: silent
                ? null
                : {
                    embeds: [buildTicketClosedReplyEmbed()]
                },
        };
    }

    /**
     * Reopens a closed ticket, restoring owner access and unlocking the thread.
     *
     * Staff-only: the owner may close their own ticket but may not reopen it,
     * which prevents a resolved ticket from being reopened indefinitely.
     *
     * @param   {object} params
     * @param   {import("discord.js").Interaction} params.interaction
     * @param   {GuildConfig} params.guildConfig
     * @returns {Promise<{ ticket: Ticket, reply: object }>}
     * @throws  {TicketServiceError} `TICKET_NOT_FOUND`, `TICKET_NOT_CLOSED`, or `FORBIDDEN`.
     */
    async reopenTicket({interaction, guildConfig}) {
        assertTextChannel(interaction.channel);

        const ticket = await ticketRepository.findTicketByGuildAndTicketId(interaction.guildId, interaction.channel.id);
        if (!ticket) {
            throw new TicketServiceError("This is not a ticket!", "TICKET_NOT_FOUND");
        }

        if (!ticket.closed) {
            throw new TicketServiceError("This ticket is not closed!", "TICKET_NOT_CLOSED");
        }

        if (!hasTicketStaffAccess(interaction.member, guildConfig)) {
            throw new TicketServiceError("You don't have permission to do that!", "FORBIDDEN");
        }

        const mainMessage = ticket.mainMessageID ? await interaction.channel.messages.fetch(ticket.mainMessageID).catch(() => null) : null;
        if (mainMessage) {
            await mainMessage.edit({
                components: [buildCloseButtonRow(false)],
            });
        }

        if (ticket.panelMessageID) {
            const panelMessage = await interaction.channel.messages.fetch(ticket.panelMessageID).catch(() => null);
            if (panelMessage) {
                await panelMessage.delete().catch(() => null);
            }
        }

        if (interaction.channel.type === ChannelType.PrivateThread) {
            await interaction.channel.setLocked(false, `Ticket reopened by ${interaction.user.tag}`);
            await interaction.channel.members.add(ticket.ownerId);
        } else {
            await interaction.channel.permissionOverwrites.edit(ticket.ownerId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
            });
        }

        await ticketRepository.setTicketPanelMessageIdByTicketId(interaction.channel.id, null);
        await ticketRepository.setTicketClosedStateByTicketId(interaction.channel.id, false);

        if (guildConfig?.logsChannel) {
            const owner = await interaction.guild.members.fetch(ticket.ownerId);
            const logEmbed = buildTicketReopenedLogEmbed({
                moderator: interaction.user,
                ticketId: interaction.channel.id,
                owner,
            });

            await sendLogMessage(interaction.guild, guildConfig.logsChannel, {embeds: [logEmbed]});
        }

        return {
            ticket: {
                ...ticket,
                closed: false,
                panelMessageID: null,
            },
            reply: {
                embeds: [buildTicketReopenedReplyEmbed()]
            },
        };
    }

    /**
     * Builds a transcript artifact without persisting it anywhere.
     *
     * Staff-only, because a transcript exposes the full conversation history.
     *
     * @param   {object} params
     * @param   {import("discord.js").Interaction} params.interaction
     * @param   {Ticket} [params.ticket]   Skips a lookup when already resolved.
     * @param   {import("discord.js").TextBasedChannel} [params.channel] Defaults to the interaction channel.
     * @param   {GuildConfig} params.guildConfig
     * @returns {Promise<TranscriptArtifact>}
     * @throws  {TicketServiceError} `INVALID_CHANNEL`, `TICKET_NOT_FOUND`, or `FORBIDDEN`.
     */
    async generateTranscript({interaction, ticket, channel, guildConfig}) {
        const resolvedChannel = channel || interaction.channel;
        assertTextChannel(resolvedChannel);

        const resolvedTicket = ticket || (await ticketRepository.findTicketByGuildAndTicketId(interaction.guildId, resolvedChannel.id));
        if (!resolvedTicket) {
            throw new TicketServiceError("This is not a ticket!", "TICKET_NOT_FOUND");
        }

        if (!hasTicketStaffAccess(interaction.member, guildConfig)) {
            throw new TicketServiceError("You don't have permission to do that!", "FORBIDDEN");
        }

        return createTranscriptArtifact(resolvedChannel, resolvedTicket);
    }

    /**
     * Generates a transcript and archives it to the configured channels.
     *
     * Delivery is best-effort by design: an unreachable transcript channel is
     * logged and skipped rather than thrown, because this method is a step
     * inside {@link TicketService#archiveTicket} — aborting here would strand a
     * ticket closed-but-undeleted purely because a log destination went missing.
     *
     * @param   {object} params
     * @param   {import("discord.js").Interaction} params.interaction
     * @param   {GuildConfig} params.guildConfig
     * @returns {Promise<{ ticket: Ticket, transcript: TranscriptArtifact, reply: object }>}
     * @throws  {TicketServiceError} `TICKET_NOT_FOUND` or `FORBIDDEN`.
     */
    async saveTranscript({interaction, guildConfig}) {
        assertTextChannel(interaction.channel);

        const ticket = await ticketRepository.findTicketByGuildAndTicketId(interaction.guildId, interaction.channel.id);
        if (!ticket) {
            throw new TicketServiceError("This is not a ticket!", "TICKET_NOT_FOUND");
        }

        const transcript = await this.generateTranscript({
            interaction,
            ticket,
            channel: interaction.channel,
            guildConfig,
        });

        /*
         * Independent lookups — resolve them together. A deleted transcript
         * channel rejects with Unknown Channel rather than resolving null, so
         * archiving must never be blocked by an unreachable log destination:
         * callers such as archiveTicket still need to purge the ticket and
         * delete the thread afterwards.
         */
        const [owner, transcriptChannel] = await Promise.all([
            interaction.guild.members.fetch(ticket.ownerId),
            guildConfig?.transcriptChannel
                ? interaction.guild.channels.fetch(guildConfig.transcriptChannel).catch(() => null)
                : Promise.resolve(null),
        ]);

        if (guildConfig?.transcriptChannel) {
            if (transcriptChannel) {
                const archiveEmbed = buildTranscriptArchiveEmbed({
                    owner,
                    moderator: interaction.user,
                    channelName: interaction.channel.name,
                    ticketId: interaction.channel.id,
                    createdAt: ticket.createdAt,
                    attached: transcript.mode === "attachment",
                });
                const linkRow = transcript.url ? buildTranscriptRow(transcript.url) : null;

                await transcriptChannel.send({
                    embeds: [archiveEmbed],
                    components: linkRow ? [linkRow] : [],
                    files: transcript.files,
                }).catch(() => null);
            } else {
                interaction.client.logger?.warn(
                    `Configured transcript channel ${guildConfig.transcriptChannel} is unavailable; skipping the archive copy.`,
                    { tag: "saveTranscript" }
                );
            }
        }

        if (guildConfig?.logsChannel) {
            const logEmbed = buildTranscriptSavedLogEmbed({
                moderator: interaction.user,
                ticketId: interaction.channel.id,
                owner,
                transcriptUrl: transcript.url,
            });

            await sendLogMessage(interaction.guild, guildConfig.logsChannel, {
                embeds: [logEmbed],
                components: transcript.components,
                files: transcript.files,
            });
        }

        return {
            ticket,
            transcript,
            reply: {
                embeds: transcript.embeds,
                components: transcript.components,
                files: transcript.files,
            },
        };
    }

    /**
     * Permanently archives a ticket: closes it if open, optionally saves the
     * transcript, writes the audit entry, purges the record, then deletes the
     * thread.
     *
     * Ordering is deliberate — the transcript and the log must be captured
     * while the thread still exists, and the record removed before the channel
     * disappears, since `threadDelete` can no longer reach a transcript for a
     * channel that is already gone.
     *
     * Transcript generation is conditional on `transcriptChannel` being
     * configured; the deletion audit entry is always written when a
     * `logsChannel` is configured, regardless.
     *
     * @param   {object} params
     * @param   {import("discord.js").Interaction} params.interaction
     * @param   {GuildConfig} params.guildConfig
     * @returns {Promise<{ ticket: Ticket, transcript: ?object, channelDeleted: true }>}
     *          `transcript` is `null` when no transcript channel is configured;
     *          `channelDeleted` tells callers not to attempt a reply.
     * @throws  {TicketServiceError} `TICKET_NOT_FOUND` or `FORBIDDEN`.
     */
    async archiveTicket({interaction, guildConfig}) {
        assertTextChannel(interaction.channel);

        const ticket = await ticketRepository.findTicketByGuildAndTicketId(interaction.guildId, interaction.channel.id);
        if (!ticket) {
            throw new TicketServiceError("This is not a ticket!", "TICKET_NOT_FOUND");
        }

        if (!hasTicketStaffAccess(interaction.member, guildConfig)) {
            throw new TicketServiceError("You don't have permission to do that!", "FORBIDDEN");
        }

        if (!ticket.closed) {
            await this.closeTicket({
                interaction,
                guildConfig,
                silent: true,
                createControlPanel: false,
                logAction: false,
            });
        }

        /*
         * Generating a transcript pages the entire thread history and uploads
         * it, so it only runs when the guild has somewhere to archive it.
         * Without a transcript channel the work would be discarded.
         */
        const transcript = guildConfig?.transcriptChannel
            ? await this.saveTranscript({ interaction, guildConfig })
            : null;

        /*
         * closeTicket ran with logAction disabled to avoid a duplicate "closed"
         * entry, so the deletion is logged here — otherwise removing a ticket
         * would leave no audit trail at all.
         */
        if (guildConfig?.logsChannel) {
            const owner = await interaction.guild.members.fetch(ticket.ownerId).catch(() => null);
            const logEmbed = buildTicketDeletedLogEmbed({
                moderator: interaction.user,
                ticketId: interaction.channel.id,
                owner: owner ?? `<@${ticket.ownerId}>`,
                transcriptUrl: transcript?.transcript?.url ?? null,
            });

            await sendLogMessage(interaction.guild, guildConfig.logsChannel, { embeds: [logEmbed] });
        }

        await ticketRepository.deleteTicketByTicketId(interaction.channel.id);
        await interaction.channel.delete().catch(() => null);

        return {
            ticket,
            transcript,
            channelDeleted: true
        };
    }

    /**
     * Grants a member access to an existing ticket.
     *
     * @param   {object} params
     * @param   {import("discord.js").Interaction} params.interaction
     * @param   {GuildConfig} params.guildConfig
     * @param   {import("discord.js").GuildMember} params.targetMember
     * @returns {Promise<{ reply: object }>}
     * @throws  {TicketServiceError} `MEMBER_NOT_FOUND`, `FORBIDDEN`,
     *                               `TICKET_NOT_FOUND`, or `ALREADY_ADDED`.
     */
    async addUserToTicket({interaction, guildConfig, targetMember}) {
        assertTextChannel(interaction.channel);

        if (!targetMember) {
            throw new TicketServiceError("That user could not be found.", "MEMBER_NOT_FOUND");
        }

        if (!hasTicketStaffAccess(interaction.member, guildConfig)) {
            throw new TicketServiceError("You don't have permission to do that!", "FORBIDDEN");
        }

        const ticket = await ticketRepository.findTicketByGuildAndTicketId(interaction.guildId, interaction.channel.id);
        if (!ticket) {
            throw new TicketServiceError("This is not a ticket!", "TICKET_NOT_FOUND");
        }

        const existingThreadMember = interaction.channel.type === ChannelType.PrivateThread
            ? await interaction.channel.members.fetch(targetMember.id).catch(() => null)
            : null;
        const currentPermissions = interaction.channel.permissionsFor(targetMember);
        if (existingThreadMember || (interaction.channel.type === ChannelType.GuildText &&
            currentPermissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))) {
            throw new TicketServiceError("This user is already in the ticket!", "ALREADY_ADDED");
        }

        if (interaction.channel.type === ChannelType.PrivateThread) {
            await interaction.channel.members.add(targetMember.id);
        } else {
            await interaction.channel.permissionOverwrites.edit(targetMember.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
            });
        }

        if (guildConfig?.logsChannel) {
            const owner = await interaction.guild.members.fetch(ticket.ownerId);
            const logEmbed = buildUserAddedLogEmbed({
                moderator: interaction.user,
                ticketId: interaction.channel.id,
                owner,
                targetUser: targetMember.user,
            });

            await sendLogMessage(interaction.guild, guildConfig.logsChannel, {embeds: [logEmbed]});
        }

        return {
            reply: {
                embeds: [buildUserAddedReplyEmbed(targetMember.user)]
            },
        };
    }

    /**
     * Revokes a member's access to a ticket.
     *
     * @param   {object} params
     * @param   {import("discord.js").Interaction} params.interaction
     * @param   {GuildConfig} params.guildConfig
     * @param   {import("discord.js").GuildMember} params.targetMember
     * @returns {Promise<{ reply: object }>}
     * @throws  {TicketServiceError} `MEMBER_NOT_FOUND`, `FORBIDDEN`,
     *                               `TICKET_NOT_FOUND`, or `NOT_ADDED`.
     */
    async removeUserFromTicket({interaction, guildConfig, targetMember}) {
        assertTextChannel(interaction.channel);

        if (!targetMember) {
            throw new TicketServiceError("That user could not be found.", "MEMBER_NOT_FOUND");
        }

        if (!hasTicketStaffAccess(interaction.member, guildConfig)) {
            throw new TicketServiceError("You don't have permission to do that!", "FORBIDDEN");
        }

        const ticket = await ticketRepository.findTicketByGuildAndTicketId(interaction.guildId, interaction.channel.id);
        if (!ticket) {
            throw new TicketServiceError("This is not a ticket!", "TICKET_NOT_FOUND");
        }

        const existingThreadMember = interaction.channel.type === ChannelType.PrivateThread
            ? await interaction.channel.members.fetch(targetMember.id).catch(() => null)
            : null;
        const currentPermissions = interaction.channel.permissionsFor(targetMember);
        if (!existingThreadMember && (interaction.channel.type === ChannelType.PrivateThread ||
            !currentPermissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))) {
            throw new TicketServiceError("That user is not in the ticket!", "NOT_ADDED");
        }

        if (interaction.channel.type === ChannelType.PrivateThread) {
            await interaction.channel.members.remove(targetMember.id);
        } else {
            await interaction.channel.permissionOverwrites.edit(targetMember.id, {
                ViewChannel: false,
                SendMessages: false,
            });
        }

        if (guildConfig?.logsChannel) {
            const owner = await interaction.guild.members.fetch(ticket.ownerId);
            const logEmbed = buildUserRemovedLogEmbed({
                moderator: interaction.user,
                ticketId: interaction.channel.id,
                owner,
                targetUser: targetMember.user,
            });

            await sendLogMessage(interaction.guild, guildConfig.logsChannel, {embeds: [logEmbed]});
        }

        return {
            reply: {
                embeds: [buildUserRemovedReplyEmbed(targetMember.user)]
            },
        };
    }
}

/**
 * Shared singleton — the service is stateless, so one instance serves every
 * command, button and modal.
 *
 * @type {TicketService}
 */
const ticketService = new TicketService();

export default ticketService;
