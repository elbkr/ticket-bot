import { ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

export default class GuildDelete extends Event {
    constructor() {
        super({
            name: "guildDelete",
            once: false,
        });
    }

    async exec(guild) {

        const data = await this.client.getGuild({_id: guild.id});

        await data
        .delete()
        .then(() => {
            this.client.logger.warn(`${guild.name} (${guild.id}) has been deleted from the database.`, {tag: "guildDelete"})
        })

    }
};
