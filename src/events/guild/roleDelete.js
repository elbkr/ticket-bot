const tickets = require("../../models/Tickets");

module.exports = class RoleDelete extends Event {
  constructor() {
    super({
      name: "roleDelete",
      once: false,
    });
  }
  async exec(role) {
    const data = await this.client.getGuild({ _id: role.guild.id });

    let mod = data.modRoles.find((r) => r === role.id);
    if (mod) {
      let index = data.modRoles.indexOf(role.id);
      data.modRoles.splice(index, 1);
      await data.save();
    }
  }
};
