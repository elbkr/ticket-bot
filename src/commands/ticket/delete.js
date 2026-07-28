import TicketCommand from "../../struct/TicketCommand.js";
import ticketService from "../../services/ticketService.js";

export default class Delete extends TicketCommand {
    constructor() {
        super({
            name: "delete",
            description: "Deletes a ticket",
        });
    }

    async run(interaction, data) {
        return ticketService.archiveTicket({
            interaction,
            guildConfig: data,
        });
    }
}
