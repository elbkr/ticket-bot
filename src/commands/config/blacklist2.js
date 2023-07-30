import { EmbedBuilder, ApplicationCommandOptionType, ChannelType, PermissionFlagsBits } from "discord.js"
import UB from "../../models/userBlacklist.js";

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
                    description: "List all blacklisted user",
                },
            ],

        });
    }

    async exec(int) {
     
        const embed = new EmbedBuilder().setColor('Blurple').setTimestamp();
        const userID = int.options.getString("userid");
        const blacklist_reason = int.options.getString("reason");
        const data = await UB.findOne({ userId: userID });

        if (!int.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return int.reply({
            content: "You don't have the required permissions to do this!",
            ephemeral: true,
        });
        
        const cmd = int.options.getSubcommand();

        if(cmd === "add") {

            if (data) {
                return int.reply({
                    embeds: [
                        embed.setDescription('🔹 | This user is already blacklisted.'),
                    ],
                });
            }
         
            await UB.create({
                userId: userID,
                reason: blacklist_reason,
                time: Date.now(),
            });
    
            return int.reply({
                embeds: [
                    embed.setDescription(
                        `🔹 | This user has been successfully blacklisted for ${blacklist_reason}.`,
                    ),
                ],
            });
        }

        if (cmd === "remove") {
            if (!data) {
                return int.reply({
                    embeds: [embed.setDescription('This user isn\'t blacklisted.')],
                });
            }
    
            await data.deleteOne({ userId: userID });
                
            return int.reply({
                embeds: [
                    embed.setDescription(
                        '🔹 | This user has been removed from the blacklist.',
                    ),
                ],
            });
        }
        if (cmd === "show") {
          
            const blacklistedUsers = await UB.find();

            const embed = new EmbedBuilder()
                .setColor('Blurple')
                .setTimestamp();

                blacklistedUsers.forEach((user) => {
                    embed.addFields(
                        { name: `User ID`, value: `${user.userId}`, inline: true },
                        { name: `Reason`, value: `${user.reason}`, inline: true },
                        { name: `Time`, value: `${user.time}`, inline: true },
                    )
                });

                await int.reply({
                    embeds: [embed],
                });
        }

    }
};
