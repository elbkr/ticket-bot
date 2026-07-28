import TicketCommand from "../../struct/TicketCommand.js";
import ticketService from "../../services/ticketService.js";

export default class Reopen extends TicketCommand {
    constructor() {
        super({
            name: "reopen",
            description: "Reopens the ticket",
        });
    }

    async run(interaction, data) {
        return ticketService.reopenTicket({
            interaction,
            guildConfig: data,
        });
    }
}
