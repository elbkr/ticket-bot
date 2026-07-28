const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_TTL_MS = 15 * 60 * 1000;

/**
 * Bounded, lazily-expiring LRU cache.
 *
 * Entries are evicted when either the TTL elapses (checked on read) or the
 * entry count exceeds `max` (least-recently-used first). Expiry is deliberately
 * lazy: no timers are registered, so the cache never holds the event loop open.
 *
 * Exposes the `get`/`set`/`delete`/`clear` surface of discord.js `Collection`
 * so it can be swapped in without changing call sites.
 */
export default class TtlCache {
    /**
     * @param {object} [options]
     * @param {number} [options.max=1000]     Maximum entries before LRU eviction.
     * @param {number} [options.ttl=900000]   Entry lifetime in milliseconds.
     */
    constructor({ max = DEFAULT_MAX_ENTRIES, ttl = DEFAULT_TTL_MS } = {}) {
        this.max = max;
        this.ttl = ttl;
        this.store = new Map();
    }

    /**
     * Reads a key, refreshing its recency.
     *
     * @param   {*} key
     * @returns {*} `undefined` when absent or expired.
     */
    get(key) {
        const entry = this.store.get(key);
        if (!entry) {
            return undefined;
        }

        if (entry.expiresAt <= Date.now()) {
            this.store.delete(key);
            return undefined;
        }

        /* Refresh recency — Map iterates in insertion order. */
        this.store.delete(key);
        this.store.set(key, entry);

        return entry.value;
    }

    /**
     * Stores a value and restarts its TTL.
     *
     * @param   {*} key
     * @param   {*} value
     * @returns {this}
     */
    set(key, value) {
        if (this.store.has(key)) {
            this.store.delete(key);
        }

        this.store.set(key, { value, expiresAt: Date.now() + this.ttl });
        this.evict();

        return this;
    }

    /**
     * @param   {*} key
     * @returns {boolean} `true` when an entry was removed.
     */
    delete(key) {
        return this.store.delete(key);
    }

    /**
     * @returns {void}
     */
    clear() {
        this.store.clear();
    }

    /**
     * @returns {number} Entry count, including any not yet lazily expired.
     */
    get size() {
        return this.store.size;
    }

    /**
     * Drops least-recently-used entries until the size cap is satisfied.
     *
     * @returns {void}
     */
    evict() {
        while (this.store.size > this.max) {
            const oldestKey = this.store.keys().next().value;
            if (oldestKey === undefined) {
                break;
            }
            this.store.delete(oldestKey);
        }
    }
}
