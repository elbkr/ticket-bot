import { ApplicationCommandOptionType, ChannelType, PermissionFlagsBits } from "discord.js"

export default class SetFunctions extends Interaction {
    constructor() {
        super({
            name: "set",
            description: "Set a config value",

            options: [
                {
                  type: ApplicationCommandOptionType.String,
                  name: "function",
                  description: "The function to set",
                  required: true,
                  choices: [
                    {
                      name: "Logs channel",
                      value: "logs",
                    },
                    {
                      name: "Tickets category",
                      value: "category",
                    },
                    {
                      name: "Transcripts channel",
                      value: "transcript",
                    },
                  ],
                },
                {
                  type: ApplicationCommandOptionType.Channel,
                  name: "channel",
                  description: "The channel or category to set the function to",
                  required: true,
                },
              ],
        });
    }

    async exec(int, data) {
     
        const option = int.options.getString("function");
        const channel = int.options.getChannel("channel");
    
        if (!int.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return int.reply({
            content: "You don't have permission to do that!",
            ephemeral: true,
          });
        }
    
        if (channel.type === ChannelType.GuildCategory && option !== "category") {
          return int.reply({
            content: "The channel type for this option must be a text channel!",
            ephemeral: true,
          });
        } else if (channel.type === ChannelType.GuildVoice) {
          return int.reply({
            content:
              "The channel type for this option must be a text channel or category!",
            ephemeral: true,
          });
        } else if (option === "category" && channel.type !== ChannelType.GuildCategory) {
          return int.reply({
            content: "The channel type for this option must be a category!",
            ephemeral: true,
          });
        }
    
        if (option === "logs") {
          data.logsChannel = channel.id;
          await data.save();
    
          return int.reply({
            content: `Set the logs channel to ${channel}`,
            ephemeral: true,
          });
        }
        if (option === "category") {
          data.ticketsParent = channel.id;
          await data.save();
    
          return int.reply({
            content: `Tickets will be created under **${channel.name}**`,
            ephemeral: true,
          });
        }
        if (option === "transcript") {
          data.transcriptChannel = channel.id;
          await data.save();
    
          return int.reply({
            content: `Set the transcripts channel to ${channel}`,
            ephemeral: true,
          });
        }

    }
};
