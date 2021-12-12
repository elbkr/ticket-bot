const { Schema, model } = require("mongoose");

module.exports = model(
  "Tickets",
  new Schema(
    {
      _id: { type: String },
      ticketID: { type: String },
      mainMessageID: { type: String },
      panelMessageID: { type: String },
      guildID: { type: String },
      closed: { type: Boolean, default: false },
    },
    { versionKey: false }
  )
);
