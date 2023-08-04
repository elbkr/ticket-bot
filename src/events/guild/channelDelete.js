import {
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import tickets from "../../models/Tickets.js";

export default class ChannelDelete extends Event {
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

            const options = {
              method: "POST",
              body: b,
              headers: {
                "Content-Type": "application/json",
              },
            };
            const res = await (
              await fetch("https://hastebin.blackforthosting.com/documents", options)
            ).json();
            const urlToPaste = `https://hastebin.blackforthosting.com/${res.key}`

            let ticket = await tickets.findOne({
              ticketID: int.channel.id,
              guildID: int.guild.id,
            });
  
            let row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel("View transcript")
                .setURL(urlToPaste)
                .setStyle(ButtonStyle.Link)
            );

            let owner = await channel.guild.members.fetch(ticket._id);
            let log = new EmbedBuilder()
              .setTitle("Ticket deleted")
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
}
