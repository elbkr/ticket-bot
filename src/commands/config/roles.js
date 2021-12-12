const {MessageEmbed} = require('discord.js');

module.exports = class Roles extends Interaction {
    constructor() {
        super({
            name: "roles",
            description: "Manage mod roles",
            options: [
                {
                    type: "1",
                    name: "add",
                    description: "Add a role to the mod roles list",
                    options: [
                        {
                            type: "8",
                            name: "role",
                            description: "The role to add",
                            required: true,
                        },
                    ]
                },
                {
                    type: "1",
                    name: "remove",
                    description: "Remove a role from the mod roles list",
                    options: [
                        {
                            type: "8",
                            name: "role",
                            description: "The role to remove",
                            required: true,
                        },
                    ]
                },
                {
                    type: "1",
                    name: "list",
                    description: "List all mod roles",
                },
            ],
        });
    }
    async exec(int, data) {
        if (!int.member.permissions.has("MANAGE_GUILD"))
            return int.reply({
                content: "You don't have the required permissions to do this!",
                ephemeral: true,
            });

        const cmd = int.options.getSubcommand("add")
      
        if(cmd === "add") {

            let role = int.options._hoistedOptions[0].role

            if(role.id === int.guild.id) {
                return int.reply({
                    content: "The *everyone* role is not manageable!",
                    ephemeral: true,
                });
            }
            let old = data.modRoles.find((r) => r === role.id);

            if (old) {
                return int.reply({
                    content: `The role ${role.name} is already in the list!`,
                    ephemeral: true,
                });
            }

            data.modRoles.push(role.id);
            await data.save();

            return int.reply({
                content: `Added role ${role.name} to the mod roles list!`,
                ephemeral: true,
            });
        }
        if (cmd === "remove") {
          let role = int.options._hoistedOptions[0].role;

          if (role.id === int.guild.id) {
            return int.reply({
              content: "The *everyone* role is not manageable!",
              ephemeral: true,
            });
          }

          let old = data.modRoles.find((r) => r === role.id);

          if (!old)
            return int.reply({
              content: `The role ${role.name} is not in the list!`,
              ephemeral: true,
            });

          let index = data.modRoles.indexOf(role.id);
          data.modRoles.splice(index, 1);
          await data.save();

          return int.reply({
            content: `Removed role ${role.name} from the mod roles list!`,
            ephemeral: true,
          });
        }
        if (cmd === "list") {
          let mods = data.modRoles;

          if (!mods.length)
            return int.reply({
              content: "There are no mod roles set!",
              ephemeral: true,
            });

          let emb = new MessageEmbed()
            .setTitle("Mod roles list")
            .setThumbnail(int.guild.iconURL({ size: 2048, dynamic: true }))
            .setColor("#2f3136")
            .setDescription(`${mods.map((m) => `<@&${m}>`).join(" ")}`)
            .setTimestamp();

          return int.reply({ embeds: [emb] });
        }
    }
};
