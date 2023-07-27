import tickets from "../../models/Tickets.js";
import { EmbedBuilder, ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";

export default class Add extends Interaction {
    constructor() {
        super({
            name: "add",
            description: "Adds a user to the ticket",

            options: [
                {
                  type: ApplicationCommandOptionType.User,
                  name: "user",
                  description: "The user to add",
                  required: true,
                },
              ],

        });
    }

    async exec(int, data) {

        let target = int.options.getMember("user");
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
        let userAdded = target
          .permissionsIn(int.channel)
          .has(["ViewChannel", "SendMessages"]);
        if (userAdded)
          return int.reply({
            content: "This user is already in the ticket!",
            ephemeral: true,
          });
    
        await channel.permissionOverwrites
          .edit(target.user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
          })
          .catch((err) => {
            console.error(
              err
            );
            return int.reply({
              content:
                "Oops! It seems that my devs spilled coffee on the computer :/",
              ephemeral: true,
            });
          });
    
        if (data.logsChannel) {
          let owner = await int.guild.members.fetch(ticket._id);
          let log = new EmbedBuilder()
            .setTitle("User added")
            .addFields([
              {
                name: "Moderator",
                value: `${int.user}`,
                inline: true,
              },
              {
                name: "User",
                value: `${target.user}`,
                inline: true,
              },
              {
                name: "Ticket",
                value: `${int.channel.id}`,
                inline: true,
              },
              { name: "Opened by", value: `${owner}`, inline: true },
            ])
            .setColor("#59d253")
            .setTimestamp();
          let logs = await int.guild.channels.fetch(data.logsChannel);
          logs.send({ embeds: [log] });
        }
    
        int.reply({
          ephemeral: true,
          content: `${target.user} has been added to the ticket!`,
        });

    }
};
