import { ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

export default class RoleDelete extends Event {
    constructor() {
        super({
            name: "roleDelete",
            once: false,
        });
    }

    async exec(role) {

        const data = await this.client.getGuild({guildID: role.guild.id});

        let isDJ = data.djRoles.find((r) => r === role.id);
        if (isDJ) {
            let index = data.djRoles.indexOf(role.id);
            data.djRoles.splice(index, 1);
            await data.save().then(() => {
                this.client.logger.warn(`Role ${role.name} (${role.id}) removed from ${role.guild.name} DJ roles`, {tag: "roleDelete"});
            })
        }

    }
};
