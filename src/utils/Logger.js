import moment from "moment";
import chalk from "chalk";
import util from "util";

/**
 * @typedef {object} LogOptions
 * @property {string}  [color] Chalk colour name.
 * @property {string}  [tag]   Bracketed category, e.g. `"Startup"`.
 * @property {boolean} [error] Route to stderr instead of stdout.
 */

/**
 * Timestamped, colour-coded console logger.
 *
 * Static by design: logging is process-global and needs no instance state.
 * Non-string values are inspected rather than coerced, so an Error keeps its
 * stack and an object keeps its shape instead of becoming "[object Object]".
 */
export default class Logger {
    /**
     * @param {*} content
     * @param {LogOptions} [options]
     * @returns {void}
     */
    static log(content, {color = "blue", tag = "Log"} = {}) {
        this.write(content, {color, tag});
    }

    /**
     * @param {*} content
     * @param {LogOptions} [options]
     * @returns {void}
     */
    static warn(content, {color = "yellow", tag = "Warn"} = {}) {
        this.write(content, {color, tag});
    }

    /**
     * Writes to stderr so failures survive stdout redirection.
     *
     * @param {*} content
     * @param {LogOptions} [options]
     * @returns {void}
     */
    static error(content, {color = "red", tag = "Error"} = {}) {
        this.write(content, {color, tag, error: true});
    }

    /**
     * Formats and emits a single log line.
     *
     * Unknown colour names fall back to white rather than throwing: a logger
     * that crashes on a bad colour turns a minor cosmetic mistake into a failed
     * operation, and it is usually invoked while reporting another problem.
     *
     * @param {*} content
     * @param {LogOptions} [options]
     * @returns {void}
     */
    static write(content, {color = "grey", tag = "Log", error = false} = {}) {
        const timestamp = chalk.cyan(
            `[${moment().format("DD-MM-YYYY kk:mm:ss")}]:`
        );
        const levelTag = chalk.bold(`[${tag}]`);
        const colorFn = typeof chalk[color] === "function" ? chalk[color] : chalk.white;
        const text = colorFn(this.clean(content));
        const stream = error ? process.stderr : process.stdout;
        stream.write(`${timestamp} ${levelTag} ${text}\n`);
    }

    /**
     * Renders any value as readable text, preserving stacks and nested shape.
     *
     * @param   {*} item
     * @returns {string}
     */
    static clean(item) {
        if (typeof item === "string") return item;
        const cleaned = util.inspect(item, {depth: Infinity});
        return cleaned;
    }
};
