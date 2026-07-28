import {ApplicationCommandOptionType, MessageFlags} from "discord.js";
import Interaction from "../../struct/Interaction.js";
import { buildEmbed } from "../../utils/theme.js";
import { hasConfigAccess, permissionDeniedReply } from "../../utils/permissions.js";

export default class UnsetFunctions extends Interaction {
    constructor() {
        super({
            name: "unset",
            description: "Unset a config value",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "function",
                    description: "The function to unset",
                    required: true,
                    choices: [
                        { name: "Logs channel", value: "logs" },
                        { name: "Parent channel", value: "parent" },
                        { name: "Transcripts channel", value: "transcript" },
                    ],
                },
            ],
        });
    }

    async exec(int, _data) {
        const option = int.options.getString("function");

        if (!hasConfigAccess(int.member)) {
            return int.reply(permissionDeniedReply());
        }

        if (option === "logs") {
            await this.client.updateGuild(int.guild.id, { $set: { logsChannel: null } });
            return int.reply({
                embeds: [buildEmbed().setTitle('✅ Configuration Updated').setDescription("Logs channel unset!")],
                flags: MessageFlags.Ephemeral,
            });
        }
        if (option === "parent") {
            await this.client.updateGuild(int.guild.id, { $set: { ticketsParent: null } });
            return int.reply({
                embeds: [buildEmbed().setTitle('✅ Configuration Updated').setDescription("Parent channel unset! Ticket threads will be created in the channel the panel is used in.")],
                flags: MessageFlags.Ephemeral,
            });
        }
        if (option === "transcript") {
            await this.client.updateGuild(int.guild.id, { $set: { transcriptChannel: null } });
            return int.reply({
                embeds: [buildEmbed().setTitle('✅ Configuration Updated').setDescription("Transcripts channel unset!")],
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}