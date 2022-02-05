const tickets = require("../../models/Tickets");
const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
module.exports = class ChannelDelete extends Event {
  constructor() {
    super({
      name: "channelDelete",
      once: false,
    });
  }
  async exec(channel) {
    const data = await this.client.getGuild({ _id: channel.guild.id });
    const ticket = await tickets.findOne({
      guildID: channel.guild.id,
      ticketID: channel.id,
    });

    if (ticket) {
      if (data.logsChannel) {
        channel.messages
          .fetch()
          .then(async (messages) => {
            let b = messages
              .filter((m) => m.author.bot !== true)
              .map(
                (m) =>
                  `${new Date(m.createdTimestamp).toLocaleString("en-GB")} - ${
                    m.author.username
                  }#${m.author.discriminator}: ${
                    m.attachments.size > 0
                      ? m.content + m.attachments.first().proxyURL
                      : m.content
                  }`
              )
              .reverse()
              .join("\n");
            if (b.length < 1) b = "No messages sent";
            await this.client.paste
              .createPaste({
                code: `${b}`,
                expireDate: "N",
                publicity: 1,
                name: `${int.channel.name}`,
              })
              .then(async (res) => {
                let urlToPaste = res;
                let row = new MessageActionRow().addComponents(
                  new MessageButton()
                    .setLabel("View transcript")
                    .setURL(urlToPaste)
                    .setStyle("LINK")
                );

                let owner = await channel.guild.members.fetch(ticket._id);
                let log = new MessageEmbed()
                  .setTitle("Ticket deleted")
                  .setAuthor(
                    this.client.user.username,
                    this.client.user.displayAvatarURL({ dynamic: true })
                  )
                  .addFields([
                    {
                      name: "Moderator",
                      value: `The bot`,
                      inline: true,
                    },
                    {
                      name: "Ticket",
                      value: `${channel.id}`,
                      inline: true,
                    },
                    { name: "Opened by", value: `${owner}`, inline: true },
                  ])
                  .setColor("#ff3c3c")
                  .setTimestamp();
                let logs = await channel.guild.channels.fetch(data.logsChannel);
                logs.send({ embeds: [log], components: [row] });
              })
              .catch((err) => {
                console.log(err);
              });
          })
          .catch((err) => {
            console.log(err);
          });
      }
      await ticket.delete();
    }

    if (data.transcriptChannel && data.transcriptChannel === channel.id) {
      data.transcriptChannel = undefined;
      await data.save();
    }
    if (data.logsChannel && data.logsChannel === channel.id) {
      data.logsChannel = undefined;
      await data.save();
    }
    if (data.ticketsParent && data.ticketsParent === channel.id) {
      data.ticketsParent = undefined;
      await data.save();
    }
  }
};
