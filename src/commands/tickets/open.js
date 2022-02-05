const tickets = require("../../models/Tickets");
const {
  MessageEmbed,
  MessageActionRow,
  MessageSelectMenu,
  MessageButton,
} = require("discord.js");

module.exports = class Open extends Interaction {
  constructor() {
    super({
      name: "open",
      description: "Opens a ticket",
    });
  }

  async exec(int, data) {
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
      .create(`ticket-${int.user.username}`, {
        parent: data.ticketsParent ? data.ticketsParent : null,
        topic: `${int.user.tag}`,
        permissionOverwrites: [
          {
            id: int.user.id,
            allow: ["READ_MESSAGE_HISTORY", "VIEW_CHANNEL", "ATTACH_FILES"],
            deny: ["SEND_MESSAGES"],
          },
          {
            id: int.guild.roles.everyone,
            deny: ["VIEW_CHANNEL"],
          },
        ],
        type: "text",
      })
      .then(async (c) => {
        data.modRoles.forEach(async (r) => {
          await c.permissionOverwrites.edit(r, {
            VIEW_CHANNEL: true,
            SEND_MESSAGES: true,
            READ_MESSAGE_HISTORY: true,
            MANAGE_MESSAGES: true,
            ATTACH_FILES: true,
            ADD_REACTIONS: true,
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
          let log = new MessageEmbed()
            .setTitle("Ticket opened")
            .setAuthor(
              int.user.username,
              int.user.displayAvatarURL({ dynamic: true })
            )
            .addFields([
              {
                name: "Opened by",
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

        let emb = new MessageEmbed()
          .setColor("#2f3136")
          .setAuthor(
            int.member.nick
              ? int.user.username + " (" + int.member.nick + ")"
              : int.user.username,
            int.user.displayAvatarURL({
              size: 128,
              format: "png",
              animated: true,
            })
          )
          .setDescription("Choose the ticket topic")
          .setTimestamp();

        const row = new MessageActionRow().addComponents(
          new MessageSelectMenu()
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
          componentType: "SELECT_MENU",
          time: 600000,
        });

        collector.on("collect", async (i) => {
          let emb = new MessageEmbed()
            .setColor("#2f3136")
            .setAuthor(
              int.member.nick
                ? int.user.username + " (" + int.member.nick + ")"
                : int.user.username,
              int.user.displayAvatarURL({
                size: 128,
                format: "png",
                animated: true,
              })
            )
            .setDescription(i.values[0])
            .setTimestamp();

          const row = new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId("close")
              .setLabel("Close ticket")
              .setEmoji("🔒")
              .setStyle("SECONDARY")
          );

          await msg.edit({
            embeds: [emb],
            components: [row],
          });

          c.permissionOverwrites
            .edit(int.user.id, {
              VIEW_CHANNEL: true,
              SEND_MESSAGES: true,
              READ_MESSAGE_HISTORY: true,
              ADD_REACTIONS: true,
              ATTACH_FILES: true,
            })
            .then((x) => x.edit({ topic: `${int.user.tag} | ${i.values[0]}` }))
            .catch((err) => {
              this.client.logger.error(
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
              let emb = new MessageEmbed()
                .setColor("#2f3136")
                .setAuthor(
                  int.member.nick
                    ? int.user.username + " (" + int.member.nick + ")"
                    : int.user.username,
                  int.user.displayAvatarURL({
                    size: 128,
                    format: "png",
                    animated: true,
                  })
                )
                .addField("Reason", reason)
                .setTimestamp();

              await collected.first().delete();
              i.deleteReply().catch((err) => {
                this.client.logger.error(
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
                      await this.client.paste
                        .createPaste({
                          code: `${b}`,
                          expireDate: "N",
                          publicity: 1,
                          name: `${int.channel.name}`,
                        })
                        .then(async (res) => {
                          let urlToPaste = res;
                          let row = new MessageActionRow().addComponents(
                            new MessageButton()
                              .setLabel("View transcript")
                              .setURL(urlToPaste)
                              .setStyle("LINK")
                          );

                          let owner = await int.guild.members.fetch(ticket._id);
                          let log = new MessageEmbed()
                            .setTitle("Ticket deleted")
                            .setAuthor(
                              this.client.user.username,
                              this.client.user.displayAvatarURL({
                                dynamic: true,
                              })
                            )
                            .addFields([
                              {
                                name: "Moderator",
                                value: "The bot",
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
                    });
                  } else {
                    let owner = await int.guild.members.fetch(ticket._id);
                    let log = new MessageEmbed()
                      .setTitle("Ticket deleted")
                      .setAuthor(
                        this.client.user.username,
                        this.client.user.displayAvatarURL({ dynamic: true })
                      )
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
                    logs.send({ embeds: [log] });
                  }
                }

                if (c.deleted) return ticket.delete();
                if (!c.deleted) {
                  await ticket.delete();
                  return c.delete().catch((err) => {
                    this.client.logger.error(
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
                        )} - ${m.author.username}#${m.author.discriminator}: ${
                          m.attachments.size > 0
                            ? m.content + m.attachments.first().proxyURL
                            : m.content
                        }`
                    )
                    .reverse()
                    .join("\n");
                  if (b.length < 1) b = "No messages sent";
                  await this.client.paste
                    .createPaste({
                      code: `${b}`,
                      expireDate: "N",
                      publicity: 1,
                      name: `${int.channel.name}`,
                    })
                    .then(async (res) => {
                      let urlToPaste = res;
                      let row = new MessageActionRow().addComponents(
                        new MessageButton()
                          .setLabel("View transcript")
                          .setURL(urlToPaste)
                          .setStyle("LINK")
                      );

                      let owner = await int.guild.members.fetch(ticket._id);
                      let log = new MessageEmbed()
                        .setTitle("Ticket deleted")
                        .setAuthor(
                          this.client.user.username,
                          this.client.user.displayAvatarURL({ dynamic: true })
                        )
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
                });
              } else {
                let owner = await int.guild.members.fetch(ticket._id);
                let log = new MessageEmbed()
                  .setTitle("Ticket deleted")
                  .setAuthor(
                    this.client.user.username,
                    this.client.user.displayAvatarURL({ dynamic: true })
                  )
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
};
