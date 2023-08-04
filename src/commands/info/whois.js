import { EmbedBuilder, ApplicationCommandOptionType } from "discord.js";
import moment from "moment";

export default class Whois extends Interaction {

    constructor() {
        super({
            name: "whois",
            description: "Get information about a user",

            options: [
                {
                  type: ApplicationCommandOptionType.User,
                  name: "user",
                  description: "The user to get information about",
                  required: true,
                },
              ],
        });
    }
    async exec(int, data) {

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

    let embed = new EmbedBuilder()
      .setColor("#2f3136")
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

    embed.setAuthor(
      member.user.tag,
      member.user.displayAvatarURL({ dynamic: true })
    );

      .addFields(
        if (member.nickname) { name: "Nickname", value: `${member.nickname}`, },
        { name: "Joined at", value: `${moment(member.user.joinedAt).format("LLLL"))}`, },
        { name: "Created at", value: `${moment(member.user.joinedAt).format("LLLL"))}`, },
        { name: "Badges", value: `${badges.join(" | ") || "None")}` },
        { name: "Roles", value: `${roles}` },
        
      )
      .setFooter({ text: `ID ${member.user.id}`}):

    return int.reply({ embeds: [embed] });

    }

};
