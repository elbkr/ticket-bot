import tickets from "../../models/Tickets.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType ,PermissionFlagsBits } from "discord.js";

export default class Close extends Interaction {
    constructor() {
        super({
            name: "close",
            description: "Closes a ticket",
        });
    }

    async exec(int, data) {

        let channel = int.channel;

    let isMod = data.modRoles.some((r) => int.member._roles.includes(r));

    if (!isMod && !int.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return int.reply({
        content: "You don't have permission to do that!",
        ephemeral: true,
      });

    let ticket = await tickets.findOne({ ticketID: channel.id });
    if (!ticket) {
      return int.reply({
        content: "This is not a ticket!",
        ephemeral: true,
      });
    }

    if (ticket.closed === true) {
      return int.reply({
        content: "This ticket is already closed!",
        ephemeral: true,
      });
    }

    let main = await int.channel.messages.fetch(ticket.mainMessageID);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm")
        .setLabel("Close")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );

    await int.reply({
      content: "Are you sure you want to close this ticket?",
      components: [row],
    });

    const collector = int.channel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "confirm") {
        let row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("close")
            .setLabel("Close ticket")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🔒")
            .setDisabled(true)
        );

        ticket.closed = true;
        await ticket.save();

        await main.edit({ components: [row] });
        i.message.delete();
        i.reply({ content: "The ticket has been closed!", ephemeral: true });

        int.channel.members.forEach((m) => {
          let has = data.modRoles.some((r) => m._roles.includes(r));
          let perm = m.permissions.has("ManageGuild");
          if (!has && !perm && m.id !== ticket._id) {
            int.channel.permissionOverwrites.edit(m.id, {
              ViewChannel: false,
              SendMessages: false,
            });
          }
        });

        int.channel.permissionOverwrites
          .edit(ticket._id, {
            SendMessages: false,
            ViewChannel: false,
          })
          .then(async () => {
            if (data.logsChannel) {
              let owner = await int.guild.members.fetch(ticket._id);
              let log = new EmbedBuilder()
                .setTitle("Ticket closed")
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
                .setColor("#e38c47")
                .setTimestamp();
              let logs = await int.guild.channels.fetch(data.logsChannel);
              logs.send({ embeds: [log] });
            }

            let emb = new EmbedBuilder()
              .setColor("#2f3136")
              .setTitle("Ticket control panel")
              .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("reopen")
                .setLabel("Reopen")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId("transcript")
                .setLabel("Save")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId("delete")
                .setLabel("Delete")
                .setStyle(ButtonStyle.Danger)
            );

            int.channel
              .send({
                embeds: [emb],
                components: [row],
              })
              .then(async (m) => {
                ticket.panelMessageID = m.id;
                await ticket.save();
              });
          });

        collector.stop();
      }
      if (i.customId === "cancel") {
        i.message.delete();
        i.reply({
          content: "Process canceled!",
          ephemeral: true,
        });
        collector.stop();
      }
    });

    collector.on("end", (i) => {
      if (i.size < 1) {
        int.editReply({
          content: "Process canceled!",
          components: [],
        });
      }
    });
        
    }
};
