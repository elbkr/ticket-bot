import TicketCommand from "../../struct/TicketCommand.js";
import ticketService from "../../services/ticketService.js";

export default class Close extends TicketCommand {
    constructor() {
        super({
            name: "close",
            description: "Closes a ticket",
        });
    }

    async run(interaction, data) {
        return ticketService.closeTicket({
            interaction,
            guildConfig: data,
        });
    }
}
