import { ApplicationCommandOptionType, ChannelType, MessageFlags } from "discord.js";
import Interaction from "../../struct/Interaction.js";
import ticketService, { TicketServiceError } from "../../services/ticketService.js";
import { alertReply } from "../../utils/theme.js";

export default class Panel extends Interaction {
    constructor() {
        super({
            name: "panel",
            description: "Sends the ticket panel",
            options: [
                {
                    type: ApplicationCommandOptionType.Channel,
                    name: "channel",
                    description: "The text channel to send the panel to",
                    required: true,
                },
            ],
        });
    }

    async exec(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const channel = interaction.options.getChannel("channel");
            if (!channel || channel.type !== ChannelType.GuildText) {
                throw new TicketServiceError("That channel must be a text channel!", "INVALID_CHANNEL");
            }

            const result = await ticketService.sendTicketPanel({
                interaction,
                channel,
            });

            if (result && !result.channelDeleted) {
                await interaction.editReply(result.reply).catch(() => null);
            }
        } catch (error) {
            await interaction.editReply(alertReply("⚠️ Action Failed", {
                description: error instanceof TicketServiceError ? error.message : "Oops! It seems like my devs spilled coffee on the computer :/"
            })).catch(() => null);
        }
    }
}