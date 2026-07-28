import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import Interaction from "../../struct/Interaction.js";
import * as blacklistRepository from "../../repositories/blacklistRepository.js";
import { buildEmbed } from "../../utils/theme.js";
import { hasConfigAccess, permissionDeniedReply } from "../../utils/permissions.js";

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

export default class Blacklist extends Interaction {
    constructor() {
        super({
            name: "blacklist",
            description: "Blacklist System",
            options: [
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "add",
                    description: "Add a user to the blacklist",
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: "userid",
                            description: "The user to add",
                            required: true,
                        },
                        {
                            name: "reason",
                            description: "Provide a reason for blacklisting this user",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                        },
                    ]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "remove",
                    description: "Remove a user from the blacklist",
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: "userid",
                            description: "The user to remove",
                            required: true,
                        },
                    ]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "show",
                    description: "List all blacklisted users",
                },
            ],
        });
    }

    async exec(int) {
        if (!hasConfigAccess(int.member)) {
            return int.reply(permissionDeniedReply());
        }

        await int.deferReply({ flags: MessageFlags.Ephemeral });

        const cmd = int.options.getSubcommand();
        const guildId = int.guild.id;

        if (cmd === "show") {
            const blacklistedUsers = await blacklistRepository.listBlacklistByGuildId(guildId);
            const embed = buildEmbed({ timestamp: true }).setTitle('⛔ Blacklisted Users');

            if (blacklistedUsers.length === 0) {
                embed.setDescription("There are currently no blacklisted users.");
            } else {
                blacklistedUsers.forEach((user) => {
                    embed.addFields(
                        { name: `User ID`, value: `${user.userId}`, inline: true },
                        { name: `Reason`, value: `${user.reason}`, inline: true },
                        { name: `Time`, value: `<t:${Math.floor(Number(user.time) / 1000)}:F> (<t:${Math.floor(Number(user.time) / 1000)}:R>)`, inline: true },
                    );
                });
            }

            return int.editReply({
                embeds: [embed],
            });
        }

        const userID = int.options.getString("userid").trim();

        if (!SNOWFLAKE_PATTERN.test(userID)) {
            return int.editReply({
                embeds: [
                    buildEmbed()
                        .setTitle('⚠️ Invalid User ID')
                        .setDescription("That is not a valid Discord user ID. It must be 17-20 digits.")
                ],
            });
        }

        const data = await blacklistRepository.findBlacklistByUserId(userID, guildId);

        if (cmd === "add") {
            const blacklist_reason = int.options.getString("reason");

            if (data) {
                return int.editReply({
                    embeds: [
                        buildEmbed()
                            .setTitle('⚠️ Already Blacklisted')
                            .setDescription('This user is already in the blacklist.')
                    ],
                });
            }

            await blacklistRepository.createBlacklistEntry({
                userId: userID,
                guildId,
                reason: blacklist_reason,
                time: Date.now(),
            });

            return int.editReply({
                embeds: [
                    buildEmbed()
                        .setTitle('⛔ User Added to Blacklist')
                        .setDescription('This user has been successfully blacklisted.')
                        .addFields({ name: 'Reason', value: blacklist_reason, inline: false })
                ],
            });
        }

        if (cmd === "remove") {
            if (!data) {
                return int.editReply({
                    embeds: [
                        buildEmbed()
                            .setTitle('⚠️ Not Blacklisted')
                            .setDescription("This user isn't currently blacklisted.")
                    ],
                });
            }

            await blacklistRepository.deleteBlacklistEntry(userID, guildId);

            return int.editReply({
                embeds: [
                    buildEmbed()
                        .setTitle('✅ User Removed from Blacklist')
                        .setDescription('This user has been successfully removed from the blacklist.')
                ],
            });
        }
    }
}