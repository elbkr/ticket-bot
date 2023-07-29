import { EmbedBuilder } from "discord.js";
import UB from "../models/userBlacklist.js";

async function isBlacklisted(int) {
  const embed = new EmbedBuilder().setColor("Blurple").setTimestamp();

  const userBlacklist = await UB.findOne({
    userId: int.user.id,
  });

  if (userBlacklist)
    return int.reply({
      embeds: [
        embed
          .setTitle("Blacklisted")
          .setDescription(
            `You have been blacklisted from creating ticket, the reason behind this decision and the time this has occured is attached below. `
          )
          .addFields(
            {
              name: "Reason",
              value: `${userBlacklist.reason}`,
              inline: true,
            },
            {
              name: "Time",
              value: `<t:${parseInt(userBlacklist.time / 1000)}:R>`,
              inline: true,
            }
          ),
      ],
      ephemeral: true,
    });

}

export {isBlacklisted};