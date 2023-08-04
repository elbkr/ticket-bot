import "dotenv/config";
import Types from "./src/utils/Types.js";
Types()

/* Import our client structure */
import Bot from "./src/struct/Bot.js";
export const client = new Bot();

/* Call our start function to load the bot instance */
(async () => await client.start(process.env.TOKEN))();
