module.exports = class Unset extends Interaction {
  constructor() {
    super({
      name: "unset",
      description: "Unset a config value",
      options: [
        {
          type: "3",
          name: "function",
          description: "The function to unset",
          required: true,
          choices: [
            {
              name: "Logs channel",
              value: "logs",
            },
            {
              name: "Tickets category",
              value: "category",
            },
            {
              name: "Transcripts channel",
              value: "transcript",
            },
          ],
        },
      ],
    });
  }
  async exec(int, data) {
    const option = int.options.getString("function");

    if (!int.member.permissions.has("MANAGE_GUILD")) {
      return int.reply({
        content: "You don't have permission to do that!",
        ephemeral: true,
      });
    }

    if (option === "logs") {
      data.logsChannel = null;
      await data.save();

      return int.reply({
        content: "Logs channel unset!",
        ephemeral: true,
      });
    }
    if (option === "category") {
      data.ticketsParent = null;
      await data.save();

      return int.reply({
        content: "Tickets category unset!",
        ephemeral: true,
      });
    }
    if (option === "transcript") {
      data.transcriptChannel = null;
      await data.save();

      return int.reply({
        content: "Transcripts channel unset!",
        ephemeral: true,
      });
    }
  }
};
