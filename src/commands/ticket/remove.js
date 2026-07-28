import { ApplicationCommandOptionType } from "discord.js";
import TicketCommand from "../../struct/TicketCommand.js";
import ticketService from "../../services/ticketService.js";

export default class Remove extends TicketCommand {
    constructor() {
        super({
            name: "remove",
            description: "Removes a user from the ticket",
            options: [
                {
                    type: ApplicationCommandOptionType.User,
                    name: "user",
                    description: "The user to remove",
                    required: true,
                },
            ],
        });
    }

    async run(interaction, data) {
        return ticketService.removeUserFromTicket({
            interaction,
            guildConfig: data,
            targetMember: interaction.options.getMember("user"),
        });
    }
}
