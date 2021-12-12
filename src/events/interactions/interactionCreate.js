module.exports = class InteractionCreate extends Event {
  constructor() {
    super({
      name: "interactionCreate",
      once: false,
    });
  }
  async exec(interaction) {
    if (interaction.guild) {
      const data = await this.client.getGuild({
        _id: interaction.guildId,
      });
      /* Slash commands */
      if (interaction.isCommand())
        return this.client.emit("slashCommands", interaction, data);
      /* User commands (when right click on an username) */
      if (interaction.isContextMenu())
        return this.client.emit("slashCommands", interaction, data);

      if (interaction.isButton())
        return this.client.emit("buttonPress", interaction, data);
    }
  }
};
