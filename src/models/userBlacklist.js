import {Schema, model} from "mongoose";

export default model(
    "UBlacklist",
    new Schema(
        {
            userId: String,
            reason: String,
            time: Number,
        },
        
    )
);