import { ChannelType, EmbedBuilder, MessageFlags } from "discord.js";
import Interaction from "../../struct/Interaction.js";
import { PRIMARY_COLOR } from "../../utils/theme.js";
import { hasConfigAccess, permissionDeniedReply } from "../../utils/permissions.js";

export default class Diagnostics extends Interaction {
    constructor() {
        super({
            name: "diagnostics",
            description: "Checks the ticket configuration",
        });
    }

    async exec(interaction, data) {
        if (!hasConfigAccess(interaction.member)) {
            return interaction.reply(permissionDeniedReply());
        }

        const supportRoles = Array.isArray(data.modRoles) ? data.modRoles : [];
        const resolvedSupportRoles = supportRoles
            .map((roleId) => interaction.guild.roles.cache.get(roleId))
            .filter(Boolean);

        const parentChannel = data.ticketsParent ? interaction.guild.channels.cache.get(data.ticketsParent) : null;
        const logsChannel = data.logsChannel ? interaction.guild.channels.cache.get(data.logsChannel) : null;
        const transcriptChannel = data.transcriptChannel ? interaction.guild.channels.cache.get(data.transcriptChannel) : null;

        /**
         * Renders a configured channel's status uniformly across every field.
         *
         * Distinguishes "never configured" from "configured but now invalid" —
         * a deleted or retyped channel is a very different problem to fix than
         * an empty setting.
         *
         * @param   {?import("discord.js").GuildChannel} channel
         * @param   {string} missingLabel Shown when nothing is configured.
         * @returns {string}
         */
        const describeChannel = (channel, missingLabel) => {
            if (!channel) {
                return `❌ ${missingLabel}`;
            }
            if (channel.type !== ChannelType.GuildText) {
                return `❌ <#${channel.id}> is not a text channel`;
            }
            return `✅ <#${channel.id}>`;
        };

        const embed = new EmbedBuilder()
            .setColor(PRIMARY_COLOR)
            .setTitle("⚙️ Ticket Diagnostics")
            .addFields([
                {
                    name: "Support Role",
                    value: resolvedSupportRoles.length > 0
                        ? `✅ ${resolvedSupportRoles.map((role) => `<@&${role.id}>`).join(", ")}`
                        : "❌ No support role configured in the database",
                },
                {
                    name: "Parent Channel",
                    value: data.ticketsParent
                        ? describeChannel(parentChannel, "Configured parent channel no longer exists")
                        : "➖ Not set — threads are created in the channel the panel is used in",
                },
                {
                    name: "Logs Channel",
                    value: describeChannel(logsChannel, "Missing logs channel in the database"),
                },
                {
                    name: "Transcript Channel",
                    value: describeChannel(transcriptChannel, "Missing transcript channel in the database"),
                },
            ]);

        return interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    }
}