const tickets = require("../../models/Tickets");
module.exports = class GuildDelete extends Event {
  constructor() {
    super({
      name: "guildDelete",
      once: false,
    });
  }
  async exec(guild) {
    const data = await this.client.getGuild({ _id: guild.id });

    await tickets.find({
      guildID: guild.id,
    }).then(ticket => {
      if(ticket.length > 0) {
        ticket.forEach(async t => {
          await t.delete();
        });
      }
    });

    await data
      .delete()
      .catch((err) =>
        this.client.logger.error(
          `An error occurred when trying to trigger guildDelete event.\n${
            err.stack ? err + "\n\n" + err.stack : err
          }`,
          { tag: "guildDelete" }
        )
      );
  }
};
