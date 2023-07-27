export default class SlashCommands extends Event {
    constructor() {
        super({
            name: "slashCommands",
            once: false,
        });
    }

    async exec(interaction, data) {
        const cmd = this.client.interactions.get(interaction.commandName);

        if (!cmd) return;

        try {
            await cmd.exec(interaction, data);
        } catch (err) {
            if (interaction.replied || interaction.deferred) {
                if (!interaction.ephemeral) {
                    await interaction.editReply({
                        content:
                            "Oops! It seems like my devs spilled coffee on the computer :/",
                    });
                } else {
                    interaction.channel.send({
                        content:
                            "Oops! It seems like my devs spilled coffee on the computer :/",
                    });
                }
            } else {
                interaction.reply({
                    ephemeral: true,
                    content:
                        "Oops! It seems like my devs spilled coffee on the computer :/",
                });
            }
            return this.client.logger.error(
                `An error occured while trying to trigger slashCommands\n${
                    err.stack ? err + "\n\n" + err.stack : err
                }`,
                {
                    tag: "Interaction",
                }
            );
        }
    }
};
