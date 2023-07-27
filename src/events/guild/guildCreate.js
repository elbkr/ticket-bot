import { ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder } from "discord.js";


export default class GuildCreate extends Event {
    constructor() {
        super({
            name: "guildCreate",
            once: false,
        });
    }

    async exec(guild) {
 
        await this.client.getGuild({_id: guild.id});
        await this.client.loadInteractions(guild.id);

        this.client.logger.log(`${guild.name} (${guild.id}) just added me!`, {
            tag: "guildCreate",
        });

    }
};
