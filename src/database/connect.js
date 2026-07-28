import mongoose from "mongoose";
import Logger from "../utils/Logger.js";

const { connect, connection, set } = mongoose;

let shutdownRegistered = false;
let shuttingDown = false;

/**
 * Installs SIGINT/SIGTERM handlers that shut the process down cleanly.
 *
 * Registration is idempotent and the handler itself is re-entrant-safe, so a
 * second signal during shutdown cannot start a competing teardown.
 *
 * @param   {?import("discord.js").Client} client Destroyed before the DB closes.
 * @returns {void}
 */
function registerGracefulShutdown(client) {
    if (shutdownRegistered) {
        return;
    }

    shutdownRegistered = true;

    const shutdown = async (signal) => {
        if (shuttingDown) {
            return;
        }

        shuttingDown = true;

        try {
            /*
             * Tear the gateway down first so Discord sees a clean disconnect
             * instead of timing the session out.
             */
            if (client) {
                await client.destroy();
                Logger.log(`Destroyed the Discord client after ${signal}.`, { color: "red", tag: "Shutdown" });
            }

            if (connection.readyState !== 0) {
                await connection.close(false);
            }

            Logger.log(`Closed MongoDB connection after ${signal}.`, { color: "red", tag: "Shutdown" });
            process.exit(0);
        } catch (error) {
            Logger.error(`Failed to shut down cleanly after ${signal}.\n${error.stack ?? error}`, {
                color: "red",
                tag: "Error",
            });
            process.exit(1);
        }
    };

    process.once("SIGINT", async () => {
        await shutdown("SIGINT");
    });

    process.once("SIGTERM", async () => {
        await shutdown("SIGTERM");
    });
}

/**
 * Connects to MongoDB, reusing an existing connection when present.
 *
 * @param   {string} uri      MongoDB connection string.
 * @param   {import("discord.js").Client} [client] Enables gateway teardown on shutdown.
 * @returns {Promise<import("mongoose").Connection>}
 * @throws  {Error} When `uri` is empty, or the connection attempt fails.
 */
export default async function connectDatabase(uri, client) {
    if (!uri) {
        throw new Error("MONGO connection string is required.");
    }

    set("strictQuery", true);
    registerGracefulShutdown(client);

    if (connection.readyState === 1 || connection.readyState === 2) {
        return connection;
    }

    await connect(uri);
    return connection;
}
