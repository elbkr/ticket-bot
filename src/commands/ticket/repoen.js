import tickets from "../../models/Tickets.js";
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, PermissionFlagsBits } from "discord.js";

export default class Reopen extends Interaction {
    constructor() {
        super({
            name: "reopen",
            description: "Reopens the ticket",
        });
    }

    async exec(int, data) {

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
    
        if (ticket.closed === false) {
          return int.reply({
            content: "This ticket is not closed!",
            ephemeral: true,
          });
        }
    
        let main = await int.channel.messages.fetch(ticket.mainMessageID);
        let member = await int.guild.members.fetch(ticket._id);
        let panel = await int.channel.messages.fetch(ticket.panelMessageID);
    
        if (!member) return int.reply("Couldn't find the ticket owner!");
    
        let row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("close")
            .setLabel("Close ticket")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🔒")
        );
    
        await main.edit({
          components: [row],
        });
    
        if (panel) {
          panel.delete();
          ticket.panelMessageID = undefined;
        }
    
        ticket.closed = false;
        await ticket.save();
    
        await int.channel.permissionOverwrites
          .edit(member.user.id, {
            SendMessages: true,
            ViewChannel: true,
          })
          .catch((err) => {
            console.log(err);
          });
    
        if (data.logsChannel) {
          let owner = await int.guild.members.fetch(ticket._id);
          let log = new EmbedBuilder()
            .setTitle("Ticket reopened")
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
            .setColor("#faea3c")
            .setTimestamp();
          let logs = await int.guild.channels.fetch(data.logsChannel);
          logs.send({ embeds: [log] });
        }
    
        return int.reply({
          content: "Ticket reopened!",
          ephemeral: true,
        });
        
    }
};
