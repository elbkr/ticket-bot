const tickets = require("../../models/Tickets");
const hastebin = require("hastebin");
const { MessageActionRow, MessageButton, MessageEmbed } = require("discord.js");

module.exports = class GuildMemberRemove extends Event {
  constructor() {
    super({
      name: "guildMemberRemove",
      once: false,
    });
  }
  async exec(member) {
    const data = await this.client.getGuild({ _id: member.guild.id });
    const ticket = await tickets.findOne({
      guildID: member.guild.id,
      _id: member.user.id,
    });

    if (ticket) {
      let channel = await member.guild.channels.fetch(ticket.ticketID);
      if (channel) {
        if (data.logsChannel) {
          channel.messages.fetch().then(async (messages) => {
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
            hastebin
              .createPaste(
                b,
                {
                  contentType: "text/plain",
                  server: "https://hastebin.com",
                },
                {}
              )
              .then(async (urlToPaste) => {
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
                      value: "The bot",
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
              });
          });
        }

        await channel.delete();
      }
      await ticket.delete();
    }
  }
};
