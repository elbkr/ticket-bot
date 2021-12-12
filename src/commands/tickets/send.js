const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
module.exports = class Send extends Interaction {
  constructor() {
    super({
      name: "send",
      description: "Sends the ticket creator",
      options: [
        {
          type: 7,
          name: "channel",
          description: "The channel to send the message to",
          required: true,
        },
      ],
    });
  }

  async exec(int, data) {
    let channel = int.options.getChannel("channel");

    let isMod = data.modRoles.some((r) => int.member._roles.includes(r));

    if (!isMod && !int.member.permissions.has("MANAGE_GUILD")) {
      return int.reply({
        content: "You don't have permission to do that!",
        ephemeral: true,
      });
    }

    if (channel.type !== "GUILD_TEXT")
      return int.reply({
        content: "That channel must be a text channel!",
        ephemeral: true,
      });

    let emb = new MessageEmbed()
      .setColor("#2f3136")
      .setTitle("Open a ticket")
      .setDescription(
       "Press the button below to open a ticket"
      );

    let row = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId("open")
        .setLabel("Open ticket")
        .setEmoji("✉️")
        .setStyle("PRIMARY")
    );

    channel
      .send({
        embeds: [emb],
        components: [row],
      })
      .then(() => {
        return int.reply({
          content: `Tickets creator sent to ${channel}!`,
          ephemeral: true,
        });
      });
  }
};
