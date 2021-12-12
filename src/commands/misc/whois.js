const { MessageEmbed } = require("discord.js");
const moment = require("moment");

module.exports = class Whois extends Interaction {
  constructor() {
    super({
      name: "whois",
      description: "Get information about a user",
      options: [
        {
          type: 6,
          name: "user",
          description: "The user to get information about",
          required: true,
        },
      ],
    });
  }
  async exec(int) {
    let member = int.options.getMember("user");

    //NOW BADGES
    let flags = await member.user.flags;
    flags = await flags.toArray();

    let badges = [];

    flags.forEach((f) => {
      if (f.toLowerCase().includes("bravery")) f = "HOUSE OF BRAVERY";
      if (f.toLowerCase().includes("brilliance")) f = "HOUSE OF BRILLIANCE";
      if (f.toLowerCase().includes("balance")) f = "HOUSE OF BALANCE";
      badges.push(f.replace("_", " "));
    });

    // ROLES
    let roles =
      member.roles.cache.filter((r) => r.id !== int.guild.id).size > 0
        ? member.roles.cache
            .filter((r) => r.id !== int.guild.id)
            .map((x) => x)
            .join(" ")
        : "None";

    let embed = new MessageEmbed()
      .setColor("#2f3136")
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

    embed.setAuthor(
      member.user.tag,
      member.user.displayAvatarURL({ dynamic: true })
    );

    if (member.nickname) embed.addField("Nickname", member.nickname);

    embed
      .addField("Joined at", moment(member.user.joinedAt).format("LLLL"))
      .addField(
        "Created at",
        moment(member.user.createdAt).format("LLLL")
      )
      .addField("Badges", badges.join(" | ") || "None")

      .addField("Roles", roles, true)
      .setFooter(`ID: ${member.user.id} `);

    return int.reply({ embeds: [embed] });
  }
};
