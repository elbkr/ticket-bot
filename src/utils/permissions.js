import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { buildEmbed } from "./theme.js";

/*
 * Single baseline privilege for every configuration command (/set, /unset,
 * /roles, /blacklist, /diagnostics). Discord grants Administrator holders every
 * permission implicitly, so admins still satisfy this check — the previous
 * split, where /set demanded Administrator but /unset only ManageGuild, let a
 * manager undo configuration they could not create.
 */
export const CONFIG_PERMISSION = PermissionFlagsBits.ManageGuild;

/**
 * Whether a member may run configuration commands.
 *
 * @param   {?import("discord.js").GuildMember} member
 * @returns {boolean} `false` for a missing member rather than throwing.
 */
export function hasConfigAccess(member) {
    return Boolean(member?.permissions?.has(CONFIG_PERMISSION));
}

/**
 * The shared refusal payload, so every command denies access identically.
 *
 * @returns {object} An ephemeral interaction payload.
 */
export function permissionDeniedReply() {
    return {
        embeds: [
            buildEmbed()
                .setTitle("⛔ Permission Denied")
                .setDescription("You don't have the required permissions to do this!"),
        ],
        flags: MessageFlags.Ephemeral,
    };
}
