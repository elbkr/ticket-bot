import tickets from "../../models/Tickets.js";

export default class Ready extends Event {
    constructor() {
        super({
            name: "ready",
            once: false,
        });
    }

    async exec() {

        let ticket = await tickets.find()
        
        this.client.user.setActivity("${ticket.length} tickets", {type: ActivityType.Watching});

        let allMembers = new Set();
        this.client.guilds.cache.forEach((guild) => {
            guild.members.cache.forEach((member) => {
                allMembers.add(member.user.id);
            });
        });

        let allChannels = new Set();
        this.client.guilds.cache.forEach((guild) => {
            guild.channels.cache.forEach((channel) => {
                allChannels.add(channel.id);
            });
        });
        
        this.client.logger.log(`Connected into ${this.client.user.tag}`, {
            tag: "Ready",
        });
        this.client.logger.log(
            `Watching ${this.client.guilds.cache.size} servers | ${allMembers.size} members | ${allChannels.size} channels`,
            {
                tag: "Data",
            }
        );

        for (const guild of this.client.guilds.cache.values()) {
            await this.client.loadInteractions(guild.id);
        }
    }
};
