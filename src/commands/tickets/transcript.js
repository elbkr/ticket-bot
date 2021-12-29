const tickets = require("../../models/Tickets");
const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const JSP = require("jspaste");

module.exports = class Transcript extends Interaction {
  constructor() {
    super({
      name: "transcript",
      description: "Saves the ticket's transcript",
    });
  }

  async exec(int, data) {
    let channel = int.channel;

    let isMod = data.modRoles.some((r) => int.member._roles.includes(r));

    if (!isMod && !int.member.permissions.has("MANAGE_GUILD")) {
      return int.reply({
        content: "You don't have permission to do that!",
        ephemeral: true,
      });
    }
    let ticket = await tickets.findOne({ ticketID: channel.id });
    if (!ticket) {
      return int.reply({
        content: "This is not a ticket!",
        ephemeral: true,
      });
    }

    int.reply({
      content: "Saving transcript...",
    });

    int.channel.messages.fetch().then(async (messages) => {
      let a = messages
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
      if (a.length < 1) a = "No messages sent";
      await JSP.publish(a).then(async (res) => {
        let urlToPaste = res.url
          let ticket = await tickets.findOne({
            ticketID: int.channel.id,
            guildID: int.guild.id,
          });

          let row = new MessageActionRow().addComponents(
            new MessageButton()
              .setLabel("View transcript")
              .setURL(urlToPaste)
              .setStyle("LINK")
          );

          await int.editReply({
            content: "Transcript saved!",
            components: [row],
          });

          if (data.transcriptChannel) {
            let emb = new MessageEmbed()
              .setDescription(
                `📰 Transcript of the ticket \`${int.channel.id}\` Opened by <@!${ticket._id}>`
              )
              .setColor("#2f3136")
              .setTimestamp();

            let transcript = await int.guild.channels.fetch(
              data.transcriptChannel
            );
            transcript.send({
              embeds: [emb],
              components: [row],
            });
          }

          if (data.logsChannel) {
            let owner = await int.guild.members.fetch(ticket._id);
            let log = new MessageEmbed()
              .setTitle("Ticket transcript saved")
              .setAuthor(
                int.user.username,
                int.user.displayAvatarURL({ dynamic: true })
              )
              .addFields([
                {
                  name: "Moderator",
                  value: `${int.user}`,
                  inline: true,
                },
                {
                  name: "Ticket",
                  value: `${int.channel.id}`,
                  inline: true,
                },
                { name: "Opened by", value: `${owner}`, inline: true },
              ])
              .setColor("#3ccffa")
              .setTimestamp();
            let logs = await int.guild.channels.fetch(data.logsChannel);
            logs.send({ embeds: [log], components: [row] });
          }
        });
    });
  }
};
