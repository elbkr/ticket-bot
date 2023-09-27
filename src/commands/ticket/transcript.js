import tickets from "../../models/Tickets.js";
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, PermissionFlagsBits } from "discord.js";

export default class Transcript extends Interaction {
    constructor() {
        super({
            name: "transcript",
            description: "Saves the ticket's transcript",
        });
    }

    async exec(int, data) {

        const client = new PasteClient(process.env.PASTEBIN_API_KEY);
        let channel = int.channel;
        let isMod = data.modRoles.some((r) => int.member._roles.includes(r));

    if (!isMod && !int.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
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

          await int.editReply({
            content: "Transcript saved!",
            components: [row],
          });

          if (data.transcriptChannel) {
            let emb = new EmbedBuilder()
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
            let log = new EmbedBuilder()
              .setTitle("Ticket transcript saved")
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

    }
};
