const tickets = require("../../models/Tickets");
const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const JSP = require("jspaste");

module.exports = class Delete extends Interaction {
  constructor() {
    super({
      name: "delete",
      description: "Deletes a ticket",
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
    if (ticket.closed === false) {
      return int.reply({
        content: "This ticket is not closed!",
        ephemeral: true,
      });
    }

    int.reply("Deleting ticket...");

    int.channel.messages.fetch().then(async (messages) => {
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
      await JSP.publish(a).then(async (data) => {
        let urlToPaste = data.url
          let ticket = await tickets.findOne({
            ticketID: int.channel.id,
            guildID: int.guild.id,
          });

          await ticket.delete().catch((err) => {
            console.log(err);
          });

          if (data.logsChannel) {
            let row = new MessageActionRow().addComponents(
              new MessageButton()
                .setLabel("View transcript")
                .setURL(urlToPaste)
                .setStyle("LINK")
            );

            let owner = await int.guild.members.fetch(ticket._id);
            let log = new MessageEmbed()
              .setTitle("Ticket deleted")
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
              .setColor("#ff3c3c")
              .setTimestamp();
            let logs = await int.guild.channels.fetch(data.logsChannel);
            logs.send({ embeds: [log], components: [row] });
          }

          setTimeout(() => {
            int.channel.delete();
          }, 5000);
        });
    });
  }
};
