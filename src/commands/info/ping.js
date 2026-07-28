import { MessageFlags } from "discord.js";
import Interaction from "../../struct/Interaction.js";
import { embedReply } from "../../utils/theme.js";

export default class Ping extends Interaction {
    constructor() {
        super({
            name: "ping",
            description: "Shows Client Latency",
        });
    }

    async exec(int) {
        return int.reply(embedReply(`WebSocket latency: ${this.client.ws.ping} ms`, {
            flags: MessageFlags.Ephemeral,
        }));
    }
}
