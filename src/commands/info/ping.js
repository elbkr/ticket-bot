export default class Ping extends Interaction {
    constructor() {
        super({
            name: "ping",
            description: "Adds the last played track to the queue",
        });
    }

    async exec(int, data) {
     
        return int.reply({ content: "Working!" });
    }
};
