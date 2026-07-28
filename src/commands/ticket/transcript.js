import TicketCommand from "../../struct/TicketCommand.js";
import ticketService from "../../services/ticketService.js";

export default class Transcript extends TicketCommand {
    constructor() {
        super({
            name: "transcript",
            description: "Saves the ticket's transcript",
        });
    }

    async run(interaction, data) {
        return ticketService.saveTranscript({
            interaction,
            guildConfig: data,
        });
    }
}
