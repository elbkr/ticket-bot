import { ApplicationCommandOptionType } from "discord.js";
import TicketCommand from "../../struct/TicketCommand.js";
import ticketService from "../../services/ticketService.js";

export default class Add extends TicketCommand {
    constructor() {
        super({
            name: "add",
            description: "Adds a user to the ticket",
            options: [
                {
                    type: ApplicationCommandOptionType.User,
                    name: "user",
                    description: "The user to add",
                    required: true,
                },
            ],
        });
    }

    async run(interaction, data) {
        return ticketService.addUserToTicket({
            interaction,
            guildConfig: data,
            targetMember: interaction.options.getMember("user"),
        });
    }
}
