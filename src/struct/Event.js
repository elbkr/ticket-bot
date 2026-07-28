/**
 * @typedef {object} EventOptions
 * @property {string}  name           Gateway event name, e.g. `"threadDelete"`.
 * @property {boolean} [once=false]   Bind with `once` instead of `on`.
 */

/**
 * Base class for every gateway event listener.
 *
 * The event loader identifies listeners by `instanceof` against this class and
 * binds `exec` to the emitter named by `name`.
 */
export default class Event {
    /**
     * @param {EventOptions} options
     */
    constructor(options = {}) {
        this.name = options.name || "";

        /**
         * Whether to bind with `once`. Named `type` for backward compatibility
         * with the loader, which reads it as `event.type ? "once" : "on"`.
         *
         * @type {boolean}
         */
        this.type = options.once || false;
    }

    /**
     * Handles the event. Subclasses must override.
     *
     * Receives whatever discord.js emits for `name`. Rejections are caught and
     * logged by the loader, so implementations may throw freely.
     *
     * @returns {Promise<void>}
     * @throws  {Error} Always, unless overridden.
     */
    async exec() {
        throw new Error(`${this.name} does not provide exec method !`);
    }
}
