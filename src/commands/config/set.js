import {ApplicationCommandOptionType, ChannelType, MessageFlags} from "discord.js";
import Interaction from "../../struct/Interaction.js";
import { buildEmbed } from "../../utils/theme.js";
import { hasConfigAccess, permissionDeniedReply } from "../../utils/permissions.js";

export default class SetFunctions extends Interaction {
    constructor() {
        super({
            name: "set",
            description: "Set a config value",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "function",
                    description: "The function to set",
                    required: true,
                    choices: [
                        { name: "Logs channel", value: "logs" },
                        { name: "Parent channel", value: "parent" },
                        { name: "Transcripts channel", value: "transcript" },
                    ],
                },
                {
                    type: ApplicationCommandOptionType.Channel,
                    name: "channel",
                    description: "Set the parent text channel where ticket threads will be created.",
                    required: true,
                    channelTypes: [ChannelType.GuildText],
                },
            ],
        });
    }

    async exec(int, _data) {
        const option = int.options.getString("function");
        const channel = int.options.getChannel("channel");

        if (!hasConfigAccess(int.member)) {
            return int.reply(permissionDeniedReply());
        }

        /*
         * Every configurable destination is now a text channel: logs and
         * transcripts are posted into one, and ticket threads can only be
         * parented to one — Discord does not allow threads under a category.
         */
        if (channel.type !== ChannelType.GuildText) {
            return int.reply({
                embeds: [buildEmbed().setTitle('⚠️ Invalid Channel Type').setDescription("The channel for this option must be a text channel!")],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (option === "logs") {
            await this.client.updateGuild(int.guild.id, { $set: { logsChannel: channel.id } });
            return int.reply({
                embeds: [buildEmbed().setTitle('✅ Configuration Updated').setDescription(`Set the logs channel to ${channel}`)],
                flags: MessageFlags.Ephemeral,
            });
        }
        if (option === "parent") {
            await this.client.updateGuild(int.guild.id, { $set: { ticketsParent: channel.id } });
            return int.reply({
                embeds: [buildEmbed().setTitle('✅ Configuration Updated').setDescription(`Ticket threads will now be created in ${channel}`)],
                flags: MessageFlags.Ephemeral,
            });
        }
        if (option === "transcript") {
            await this.client.updateGuild(int.guild.id, { $set: { transcriptChannel: channel.id } });
            return int.reply({
                embeds: [buildEmbed().setTitle('✅ Configuration Updated').setDescription(`Set the transcripts channel to ${channel}`)],
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}