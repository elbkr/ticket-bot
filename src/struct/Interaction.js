const { Permissions } = require("discord.js");
global.Interaction = module.exports = class Interaction {
  constructor(options) {
    this.name = options.name || name;
    this.type = options.type || 1;
    this.description =
      this.type === 1
        ? options.description || "No description provided"
        : undefined;
    this.options = options.options || [];
    this.defaultPermission = options.defaultPermission;
    this.memberPerms = new Permissions(options.memberPerms).freeze();
    this.clientPerms = new Permissions(options.clientPerms).freeze();
  }

  async exec(...args) {
    throw new Error(`${this.name} does not provide exec method !`);
  }
};
