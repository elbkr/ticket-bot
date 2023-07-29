import UB from "../../models/userBlacklist.js";
import { EmbedBuilder, ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";

export default class WhiteList extends Interaction {
    constructor() {
        super({
            name: "whitelist",
            description: "Whitelist a user from creating the ticket",

            options: [
                {
                  type: ApplicationCommandOptionType.String,
                  name: "userid",
                  description: "Provide the ID of the user you would like to whitelist",
                  required: true,
                },                
              ],

        });
    }

    async exec(int) {

        const embed = new EmbedBuilder().setColor('Blurple').setTimestamp();
        const userID = int.options.getString("userid");
        
        const data = await UB.findOne({ userId: userID });
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
};
