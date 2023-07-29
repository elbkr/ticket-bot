import UB from "../../models/userBlacklist.js";
import { EmbedBuilder, ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";

export default class Blacklist extends Interaction {
    constructor() {
        super({
            name: "blacklist",
            description: "Blacklist a user from creating the ticket",

            options: [
                {
                  type: ApplicationCommandOptionType.String,
                  name: "userid",
                  description: "Provide the ID of the user you would like to blacklist",
                  required: true,
                },
                {
                    name: "reason",
                    description: "Provide a reason for blacklisting this user",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                  },
                
              ],

        });
    }

    async exec(int) {

        const embed = new EmbedBuilder().setColor('Blurple').setTimestamp();
        const userID = int.options.getString("userid");
        const blacklist_reason = int.options.getString("reason");
        const data = await UB.findOne({ userId: userID });
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
};
