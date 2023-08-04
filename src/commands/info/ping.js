export default class Ping extends Interaction {
    constructor() {
        super({
            name: "ping",
            description: "Shows Client Latency",
        });
    }

    async exec(int, data) {
     
        return int.reply({ content: `${this.client.ws.ping}` });
    }
};
