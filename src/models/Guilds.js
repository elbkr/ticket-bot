import {Schema, model} from "mongoose";

export default model(
    "Guilds",
    new Schema(
        {
            _id: { type: String },
            modRoles: { type: Array, default: null },
            logsChannel: { type: String, default: null },
            transcriptChannel: { type: String, default: null },
            ticketsParent: { type: String, default: null },
        },
        {versionKey: false}
    )
);