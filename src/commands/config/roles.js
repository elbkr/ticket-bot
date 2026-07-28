import {ApplicationCommandOptionType, MessageFlags} from "discord.js";
import Interaction from "../../struct/Interaction.js";
import { EMBED_DESCRIPTION_LIMIT, buildEmbed, joinWithinLimit } from "../../utils/theme.js";
import { hasConfigAccess, permissionDeniedReply } from "../../utils/permissions.js";

export default class Roles extends Interaction {
    constructor() {
        super({
            name: "roles",
            description: "Manage Mod Roles",
            options: [
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "add",
                    description: "Add a role to the mod roles list",
                    options: [
                        {
                            type: ApplicationCommandOptionType.Role,
                            name: "role",
                            description: "The role to add",
                            required: true,
                        },
                    ]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "remove",
                    description: "Remove a role from the mod roles list",
                    options: [
                        {
                            type: ApplicationCommandOptionType.Role,
                            name: "role",
                            description: "The role to remove",
                            required: true,
                        },
                    ]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "list",
                    description: "List all mod roles",
                },
            ],
        });
    }

    async exec(int, data) {
        if (!hasConfigAccess(int.member)) {
            return int.reply(permissionDeniedReply());
        }

        const cmd = int.options.getSubcommand();

        if (cmd === "add") {
            const role = int.options.getRole("role");

            if (role.id === int.guild.id) {
                return int.reply({
                    embeds: [buildEmbed().setTitle('⚠️ Invalid Role').setDescription("The *everyone* role is not manageable!")],
                    flags: MessageFlags.Ephemeral,
                });
            }
            const old = data.modRoles.find((r) => r === role.id);

            if (old) {
                return int.reply({
                    embeds: [buildEmbed().setTitle('⚠️ Already Added').setDescription(`The role ${role.name} is already in the list!`)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            await this.client.updateGuild(int.guild.id, { $addToSet: { modRoles: role.id } });

            return int.reply({
                embeds: [buildEmbed().setTitle('✅ Role Added').setDescription(`Added role ${role.name} to the mod roles list!`)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (cmd === "remove") {
            const role = int.options.getRole("role");

            if (role.id === int.guild.id) {
                return int.reply({
                    embeds: [buildEmbed().setTitle('⚠️ Invalid Role').setDescription("The *everyone* role is not manageable!")],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const old = data.modRoles.find((r) => r === role.id);

            if (!old) {
                return int.reply({
                    embeds: [buildEmbed().setTitle('⚠️ Role Not Found').setDescription(`The role ${role.name} is not in the list!`)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            await this.client.updateGuild(int.guild.id, { $pull: { modRoles: role.id } });

            return int.reply({
                embeds: [buildEmbed().setTitle('✅ Role Removed').setDescription(`Removed role ${role.name} from the mod roles list!`)],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (cmd === "list") {
            const mods = data.modRoles;

            if (!mods.length) {
                return int.reply({
                    embeds: [buildEmbed().setTitle('⚠️ No Roles Set').setDescription("There are no mod roles set!")],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const emb = buildEmbed()
                .setTitle("🛡️ Mod Roles List")
                .setThumbnail(int.guild.iconURL({ size: 2048 }))
                .setDescription(joinWithinLimit(mods.map((m) => `<@&${m}>`), " ", EMBED_DESCRIPTION_LIMIT))
                .setTimestamp();

            return int.reply({ embeds: [emb] });
        }
    }
}