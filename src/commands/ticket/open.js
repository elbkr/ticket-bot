import TicketCommand from "../../struct/TicketCommand.js";
import ticketService from "../../services/ticketService.js";

export default class Open extends TicketCommand {
    constructor() {
        super({
            name: "open",
            description: "Opens a Ticket",
        });
    }

    async run(interaction, data) {
        return ticketService.openTicket({
            interaction,
            guildConfig: data,
        });
    }
}
