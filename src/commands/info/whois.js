import { ApplicationCommandOptionType, EmbedBuilder, MessageFlags } from "discord.js";
import Interaction from "../../struct/Interaction.js";
import { PRIMARY_COLOR, buildEmbed, embedReply, joinWithinLimit } from "../../utils/theme.js";

function formatDate(date) {
    return date ? `<t:${Math.floor(date.getTime() / 1000)}:F>` : "Unknown";
}

export default class Whois extends Interaction {
    constructor() {
        super({
            name: "whois",
            description: "Get information about a user",
            options: [
                {
                    type: ApplicationCommandOptionType.User,
                    name: "user",
                    description: "User to inspect",
                    required: true,
                },
            ],
        });
    }

    async exec(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const user = interaction.options.getUser("user", true);
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (!member) {
                await interaction.editReply(embedReply("❌ Could not resolve member in this server."));
                return;
            }

            const roles = member.roles.cache
                .filter((r) => r.id !== interaction.guild.id)
                .map((r) => r.toString());

            const flags = user.flags ?? (await interaction.client.users.fetch(user.id, { force: true })).flags;
            const badgeList = flags.toArray().length
                ? joinWithinLimit(flags.toArray(), ", ")
                : "None";

            const embed = new EmbedBuilder()
                .setColor(PRIMARY_COLOR)
                .setAuthor({
                    name: user.tag,
                    iconURL: user.displayAvatarURL({ forceStatic: false })
                })
                .setThumbnail(user.displayAvatarURL({ forceStatic: false, size: 512 }))
                .addFields(
                    { name: "User ID", value: `\`${user.id}\``, inline: true },
                    { name: "Nickname", value: member.nickname ?? "None", inline: true },
                    { name: "Joined Server", value: formatDate(member.joinedAt), inline: false },
                    { name: "Account Created", value: formatDate(user.createdAt), inline: false },
                    { name: "Badges", value: badgeList, inline: false },
                    { name: "Roles", value: roles.length ? joinWithinLimit(roles, " ") : "None", inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            interaction.client.logger.error(error, { color: "red", tag: "Error" });
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(embedReply("❌ Failed to resolve user info.")).catch(() => null);
            } else {
                await interaction.reply({
                    embeds: [buildEmbed({ description: "❌ Failed to resolve user info." })],
                    flags: MessageFlags.Ephemeral
                }).catch(() => null);
            }
        }
    }
}
