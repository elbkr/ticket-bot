import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ApplicationCommandOptionType, ChannelType, PermissionFlagsBits } from "discord.js"

export default class Send extends Interaction {
    constructor() {
        super({
            name: "send",
            description: "Sends the ticket creator",

            options: [
                {
                  type: ApplicationCommandOptionType.Channel,
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
    
        if (!isMod && !int.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return int.reply({
            content: "You don't have permission to do that!",
            ephemeral: true,
          });
        }
    
        if (channel.type !== ChannelType.GuildText)
          return int.reply({
            content: "That channel must be a text channel!",
            ephemeral: true,
          });
    
        let emb = new EmbedBuilder()
          .setColor("#2f3136")
          .setTitle("Open a ticket")
          .setDescription(
           "Press the button below to open a ticket"
          );
    
        let row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("open")
            .setLabel("Open ticket")
            .setEmoji("✉️")
            .setStyle(ButtonStyle.Secondary)
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
