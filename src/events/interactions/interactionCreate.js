import { InteractionType, MessageFlags } from "discord.js";
import Event from "../../struct/Event.js";
import ticketButtonHandler from "../../handlers/ticketButtonHandler.js";
import ticketModalHandler from "../../handlers/ticketModalHandler.js";
import ticketSelectMenuHandler from "../../handlers/ticketSelectMenuHandler.js";
import { embedReply } from "../../utils/theme.js";

/**
 * Single entry point for every interaction the bot receives.
 *
 * Resolves the guild configuration once and passes it down, so no command or
 * handler needs to reach for the database itself. Interactions outside a guild
 * are ignored: the bot is guild-scoped by design and every feature depends on a
 * guild configuration.
 *
 * @extends {Event}
 */
export default class InteractionCreate extends Event {
    constructor() {
        super({
            name: "interactionCreate",
            once: false,
        });
    }

    /**
     * @param   {import("discord.js").Interaction} interaction
     * @returns {Promise<void>}
     */
    async exec(interaction) {
        if (!interaction.guild) {
            return;
        }

        const data = await this.client.getGuild({
            _id: interaction.guild.id,
        });

        if (interaction.type === InteractionType.ApplicationCommand) {
            const command = this.client.interactions.get(interaction.commandName);
            if (!command) {
                return;
            }

            try {
                await command.exec(interaction, data);
            } catch (error) {
                this.client.logger.error(
                    `An error occured while trying to trigger ${interaction.commandName}\n${
                        error.stack ? `${error}\n\n${error.stack}` : error
                    }`,
                    {
                        tag: "Interaction",
                    }
                );

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(embedReply(
                        "Oops! It seems like my devs spilled coffee on the computer :/"
                    )).catch(() => null);
                } else {
                    await interaction.reply(embedReply(
                        "Oops! It seems like my devs spilled coffee on the computer :/", {
                        flags: MessageFlags.Ephemeral,
                    })).catch(() => null);
                }
            }

            return;
        }

        if (interaction.isButton()) {
            await ticketButtonHandler(interaction, data);
            return;
        }

        if (interaction.isStringSelectMenu()) {
            await ticketSelectMenuHandler(interaction, data);
            return;
        }

        if (interaction.isModalSubmit()) {
            await ticketModalHandler(interaction, data);
            return;
        }
    }
}
