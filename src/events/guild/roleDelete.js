import Event from "../../struct/Event.js";

/**
 * Drops a deleted role from the guild's staff list.
 *
 * Prevents stale role IDs from lingering in the ACL, where they would be
 * silently unmatchable.
 *
 * @extends {Event}
 */
export default class RoleDelete extends Event {
    constructor() {
        super({
            name: "roleDelete",
            once: false,
        });
    }

    /**
     * @param   {import("discord.js").Role} role
     * @returns {Promise<void>}
     */
    async exec(role) {

        const data = await this.client.getGuild({ _id: role.guild.id });

        const isMod = data.modRoles.find((r) => r === role.id);
        if (isMod) {
            await this.client.updateGuild(role.guild.id, { $pull: { modRoles: role.id } });
            this.client.logger.warn(`Role ${role.name} (${role.id}) removed from ${role.guild.name} mod roles`, {tag: "roleDelete"});
        }

    }
};