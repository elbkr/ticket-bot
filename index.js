import "dotenv/config";
import Bot from "./src/struct/Bot.js";
import Logger from "./src/utils/Logger.js";

process.on("unhandledRejection", (reason) => {
    Logger.error(reason, { color: "red", tag: "Error" });
});

process.on("uncaughtException", (error) => {
    Logger.error(error, { color: "red", tag: "Error" });
    process.exit(1);
});

async function bootstrap() {
    const client = new Bot();
    await client.start(process.env.TOKEN);
}

bootstrap().catch((error) => {
    Logger.error(error, { color: "red", tag: "Error" });
    process.exit(1);
});
