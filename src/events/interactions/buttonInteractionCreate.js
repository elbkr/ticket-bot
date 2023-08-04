import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from "discord.js";
import { isBlacklisted } from "../../utils/isBlacklisted.js";
import tickets from "../../models/Tickets.js";

export default class ButtonInteractionCreate extends Event {
  constructor() {
    super({
      name: "buttonInteractionCreate",
      once: false,
    });
  }

  async exec(int, data) {
    if (int.customId === "open") {
      
      if (await isBlacklisted(int)) return;
      
      let ticket = await tickets.findOne({
        guildID: int.guild.id,
        _id: int.user.id,
      });

      if (ticket) {
        return int.reply({
          content: "You already have a ticket open!",
          ephemeral: true,
        });
      }

      int.guild.channels
        .create({
          name: `ticket-${int.user.username}`,
          parent: data.ticketsParent ? data.ticketsParent : null,
          topic: `${int.user.tag}`,
          type: ChannelType.GuildText,

          permissionOverwrites: [
            {
              id: int.user.id,
              allow: ["ReadMessageHistory", "ViewChannel", "AttachFiles"],
              deny: ["SendMessages"],
            },
            {
              id: int.guild.roles.everyone,
              deny: ["ViewChannel"],
            },
          ],
        })
        .then(async (c) => {
          data.modRoles.forEach(async (r) => {
            await c.permissionOverwrites.edit(r, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true,
              ManageMessages: true,
              AttachFiles: true,
              AddReactions: true,
            });
          });

          int.reply({
            content: `Your ticket ${c} has been opened!`,
            ephemeral: true,
          });

          let ticket = await tickets.create({
            _id: int.user.id,
            ticketID: c.id,
            guildID: int.guild.id,
          });
          await ticket.save();

          if (data.logsChannel) {
            let log = new EmbedBuilder()
              .setTitle("Ticket opened")
              .addFields([
                {
                  name: "User",
                  value: `${int.user}`,
                  inline: true,
                },
                {
                  name: "Ticket",
                  value: `${c.id}`,
                  inline: true,
                },
              ])
              .setColor("#3ccffa")
              .setTimestamp();
            let logs = await int.guild.channels.fetch(data.logsChannel);
            logs.send({ embeds: [log] });
          }

          let emb = new EmbedBuilder()
            .setColor("#2f3136")
            .setDescription("Choose the ticket topic")
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("topic")
              .setPlaceholder("Choose topic")
              .addOptions([
                {
                  label: "Server questions",
                  value: "questions",
                  emoji: "❓",
                },
                {
                  label: "Mute or ban appeal",
                  value: "appeal",
                  emoji: "🔇",
                },
                {
                  label: "Report an user",
                  value: "report",
                  emoji: "😡",
                },
                {
                  label: "Contact the owners",
                  value: "owners",
                  emoji: "👑",
                },
              ])
          );

          let msg = await c.send({
            content: `<@!${int.user.id}>`,
            embeds: [emb],
            components: [row],
          });

          ticket = await tickets.findOne({
            guildID: int.guild.id,
            _id: int.user.id,
          });

          ticket.mainMessageID = msg.id;
          await ticket.save().catch((e) => console.log(e));

          await msg.pin().then(() => {
            c.bulkDelete(1);
          });

          const collector = msg.createMessageComponentCollector({
            filter: (m) => m.user.id === int.user.id,
            componentType: ComponentType.StringSelect,
            time: 600000,
          });

          collector.on("collect", async (i) => {
            let emb = new EmbedBuilder()
              .setColor("#2f3136")
              .setDescription(i.values[0])
              .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("close")
                .setLabel("Close ticket")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Secondary)
            );

            await msg.edit({
              embeds: [emb],
              components: [row],
            });

            c.permissionOverwrites
              .edit(int.user.id, {
                ReadMessageHistory: true,
                SendMessages: true,
                ViewChannel: true,
                AddReactions: true,
                AttachFiles: true,
              })
              .then((x) => {
                x.edit({ topic: `${int.user.tag} | ${i.values[0]}` });
              })
              .catch((err) => {
                console.error(
                  `An error occurred while editing the channel topic:\n ${
                    err.stack ? err + "\n\n" + err.stack : err
                  }`
                );
              });

            i.reply({
              content: "Now send the reason of the ticket **in one message**",
            });

            const filter = (m) => m.author.id === int.user.id;

            const awaitReason = await c
              .awaitMessages({ filter, max: 1, time: 600000, errors: ["time"] })
              .then(async (collected) => {
                let reason = collected.first().content;
                let emb = new EmbedBuilder()
                  .setColor("#2f3136")
                  .addField("Reason", reason)
                  .setTimestamp();

                await collected.first().delete();
                i.deleteReply().catch((err) => {
                  cosnole.error(
                    `An error occurred while deleting the message:\n ${
                      err.stack ? err + "\n\n" + err.stack : err
                    }`
                  );
                });
                await msg.edit({
                  embeds: [emb],
                });
              })
              .catch(async (collected) => {
                if (collected.size === 0) {
                  if (data.logsChannel) {
                    if (!c.deleted) {
                      c.messages.fetch().then(async (messages) => {
                        let b = messages
                          .filter((m) => m.author.bot !== true)
                          .map(
                            (m) =>
                              `${new Date(m.createdTimestamp).toLocaleString(
                                "en-GB"
                              )} - ${m.author.username}#${
                                m.author.discriminator
                              }: ${
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
                          await fetch(
                            "https://hastebin.blackforthosting.com/documents",
                            options
                          )
                        ).json();
                        const urlToPaste = `https://hastebin.blackforthosting.com/${res.key}`;

                        let row = new ActionRowBuilder().addComponents(
                          new ButtonBuilder()
                            .setLabel("View transcript")
                            .setURL(urlToPaste)
                            .setStyle(ButtonStyle.Link)
                        );

                        let owner = await int.guild.members.fetch(ticket._id);
                        let log = new EmbedBuilder()
                          .setTitle("Ticket deleted")
                          .addFields([
                            {
                              name: "Moderator",
                              value: `The bot`,
                              inline: true,
                            },
                            {
                              name: "Ticket",
                              value: `${c.id}`,
                              inline: true,
                            },
                            {
                              name: "Opened by",
                              value: `${owner}`,
                              inline: true,
                            },
                          ])
                          .setColor("#ff3c3c")
                          .setTimestamp();
                        let logs = await int.guild.channels.fetch(
                          data.logsChannel
                        );
                        logs.send({ embeds: [log], components: [row] });
                      });
                    } else {
                      let owner = await int.guild.members.fetch(ticket._id);
                      let log = new EmbedBuilder()
                        .setTitle("Ticket deleted")

                        .addFields([
                          {
                            name: "Moderator",
                            value: `The bot`,
                            inline: true,
                          },
                          {
                            name: "Ticket",
                            value: `${c.id}`,
                            inline: true,
                          },
                          {
                            name: "Opened by",
                            value: `${owner}`,
                            inline: true,
                          },
                        ])
                        .setColor("#ff3c3c")
                        .setTimestamp();
                      let logs = await int.guild.channels.fetch(
                        data.logsChannel
                      );
                      logs.send({ embeds: [log] });
                    }
                  }

                  if (c.deleted) return ticket.delete();
                  if (!c.deleted) {
                    await ticket.delete();
                    return c.delete().catch((err) => {
                      console.error(
                        `An error occurred while deleting the channel:\n ${
                          err.stack ? err + "\n\n" + err.stack : err
                        }`
                      );
                    });
                  }
                }
              });

            await awaitReason;
          });

          collector.on("end", async (collected) => {
            if (collected.size < 1) {
              if (data.logsChannel) {
                if (!c.deleted) {
                  c.messages.fetch().then(async (messages) => {
                    let b = messages
                      .filter((m) => m.author.bot !== true)
                      .map(
                        (m) =>
                          `${new Date(m.createdTimestamp).toLocaleString(
                            "en-GB"
                          )} - ${m.author.username}#${
                            m.author.discriminator
                          }: ${
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
                      await fetch(
                        "https://hastebin.blackforthosting.com/documents",
                        options
                      )
                    ).json();
                    const urlToPaste = `https://hastebin.blackforthosting.com/${res.key}`;

                    let row = new ActionRowBuilder().addComponents(
                      new ButtonBuilder()
                        .setLabel("View transcript")
                        .setURL(urlToPaste)
                        .setStyle(ButtonStyle.Link)
                    );

                    let owner = await int.guild.members.fetch(ticket._id);
                    let log = new EmbedBuilder()
                      .setTitle("Ticket deleted")
                      .addFields([
                        {
                          name: "Moderator",
                          value: `The bot`,
                          inline: true,
                        },
                        {
                          name: "Ticket",
                          value: `${c.id}`,
                          inline: true,
                        },
                        {
                          name: "Opened by",
                          value: `${owner}`,
                          inline: true,
                        },
                      ])
                      .setColor("#ff3c3c")
                      .setTimestamp();
                    let logs = await int.guild.channels.fetch(data.logsChannel);
                    logs.send({ embeds: [log], components: [row] });
                  });
                } else {
                  let owner = await int.guild.members.fetch(ticket._id);
                  let log = new EmbedBuilder()
                    .setTitle("Ticket deleted")
                    .addFields([
                      {
                        name: "Moderator",
                        value: `The bot`,
                        inline: true,
                      },
                      {
                        name: "Ticket",
                        value: `${c.id}`,
                        inline: true,
                      },
                      { name: "Opened by", value: `${owner}`, inline: true },
                    ])
                    .setColor("#ff3c3c")
                    .setTimestamp();
                  let logs = await int.guild.channels.fetch(data.logsChannel);
                  logs.send({ embeds: [log] });
                }
              }

              if (c.deleted) return ticket.delete();
              if (!c.deleted) {
                await ticket.delete();
                return c.delete();
              }
            }
          });
        });
    }

    if (int.customId === "close") {
      let ticket = await tickets.findOne({
        guildID: int.guild.id,
        ticketID: int.channel.id,
      });

      let isMod = data.modRoles.some((r) => int.member._roles.includes(r));

      if (
        !isMod &&
        !int.member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return int.reply({
          content: "You don't have permission to do that!",
          ephemeral: true,
        });
      }
      if (ticket.closed === true) {
        return int.reply({
          content: "This ticket is already closed!",
          ephemeral: true,
        });
      }
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm")
          .setLabel("Close")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("✖"),
        new ButtonBuilder()
          .setCustomId("cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary)
      );

      await int.reply({
        content: "Are you sure you want to close this ticket?",
        components: [row],
      });

      const filter = (m) => m.user.id === int.user.id;
      const collector = int.channel.createMessageComponentCollector({
        filter,
        componentType: ComponentType.Button,
        time: 10000,
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
          int.message.edit({ components: [row] });
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
                  let ticket = await tickets.findOne({
                    ticketID: int.channel.id,
                  });
                  ticket.panelMessageID = m.id;
                  await ticket.save();
                });
            });

          collector.stop();
        }
        if (i.customId === "cancel") {
          i.message.delete();
          i.reply({
            content: "Process cancelled!",
            components: [],
          });
          collector.stop();
        }
      });

      collector.on("end", (i) => {
        if (i.size < 1) {
          int.editReply({
            content: "Process cancelled!",
            components: [],
          });
        }
      });
    }

    if (int.customId === "delete") {
      let isMod = data.modRoles.some((r) => int.member._roles.includes(r));

      if (
        !isMod &&
        !int.member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return int.reply({
          content: "You don't have permission to do that!",
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
       const options = {
          method: "POST",
          body: b,
          headers: {
            "Content-Type": "application/json",
          },
        };
        const res = await (
          await fetch(
            "https://hastebin.blackforthosting.com/documents",
            options
          )
        ).json();
        const urlToPaste = `https://hastebin.blackforthosting.com/${res.key}`;

        let ticket = await tickets.findOne({
          ticketID: int.channel.id,
          guildID: int.guild.id,
        });

        await ticket.delete().catch((err) => {
          console.log(err);
        });

        if (data.logsChannel) {
          let row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("View transcript")
              .setURL(urlToPaste)
              .setStyle(ButtonStyle.Link)
          );

          let owner = await int.guild.members.fetch(ticket._id);
          let log = new EmbedBuilder()
            .setTitle("Ticket deleted")
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
    }

    if (int.customId === "reopen") {
      let isMod = data.modRoles.some((r) => int.member._roles.includes(r));

      if (
        !isMod &&
        !int.member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return int.reply({
          content: "You don't have permission to do that!",
          ephemeral: true,
        });
      }

      let ticket = await tickets.findOne({
        ticketID: int.channel.id,
        guildID: int.guild.id,
      });

      if (ticket.closed === false)
        return int.reply({
          content: "This ticket is not closed!",
          ephemeral: true,
        });

      let main = await int.channel.messages.fetch(ticket.mainMessageID);
      let user = await int.guild.members.fetch(ticket._id);

      if (!user)
        return int.reply({ content: "I couldn't find the ticket owner!" });
      ticket.closed = false;
      ticket.panelMessageID = undefined;
      await ticket.save();

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

      await int.channel.permissionOverwrites
        .edit(user.user.id, {
          SendMessages: true,
          ViewChannel: true,
        })
        .catch((err) => {
          console.log(err);
        });

      int.message.delete();

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

    if (int.customId === "transcript") {
      let isMod = data.modRoles.some((r) => int.member._roles.includes(r));

      if (
        !isMod &&
        !int.member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return int.reply({
          content: "You don't have permission to do that!",
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
          await fetch(
            "https://hastebin.blackforthosting.com/documents",
            options
          )
        ).json();
        const urlToPaste = `https://hastebin.blackforthosting.com/${res.key}`;

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
              `📰 Transcript from the ticket \`${int.channel.id}\` Opened by <@!${ticket._id}>`
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
            .setTitle("Transcript saved")
            .addFields([
              {
                name: "Moderator",
                value: `${int.user}`,
                inline: true,
              },
              {
                name: "Ticket",
                value: `${int.channel}`,
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
  }
}
