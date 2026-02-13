/**
 * Preload Handlebars partials for the Cyberpunk system.
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function() {
    // Path to partial from foundry path. For cyberpunk, is "systems/cyberpunk/templates/actor/parts/___.hbs". Is .hbs as they're handlebars files
    return loadTemplates([
        "systems/cyberpunk/templates/actor/parts/statsrow.hbs",
        "systems/cyberpunk/templates/actor/parts/woundtracker.hbs",
        "systems/cyberpunk/templates/actor/parts/skills.hbs",
        "systems/cyberpunk/templates/actor/parts/gear.hbs",
        "systems/cyberpunk/templates/actor/parts/cyberware.hbs",
        "systems/cyberpunk/templates/actor/parts/combat.hbs",
        "systems/cyberpunk/templates/actor/parts/armor-display.hbs",
        "systems/cyberpunk/templates/actor/parts/skill.hbs",
        "systems/cyberpunk/templates/actor/parts/netrunning.hbs",

        // Shared templates
        "systems/cyberpunk/templates/fields/string.hbs",
        "systems/cyberpunk/templates/fields/number.hbs",
        "systems/cyberpunk/templates/fields/boolean.hbs",
        "systems/cyberpunk/templates/fields/select.hbs",

        // Roll templates
        "systems/cyberpunk/templates/chat/default-roll.hbs",
        "systems/cyberpunk/templates/chat/weapon-roll.hbs",
        "systems/cyberpunk/templates/chat/multi-hit.hbs",
        "systems/cyberpunk/templates/chat/initiative.hbs",
        "systems/cyberpunk/templates/chat/save-roll.hbs",
        "systems/cyberpunk/templates/chat/suppressive.hbs",
        "systems/cyberpunk/templates/chat/formula-roll.hbs",
        "systems/cyberpunk/templates/chat/humanity-roll.hbs",
        "systems/cyberpunk/templates/chat/condition-damage.hbs",
        "systems/cyberpunk/templates/chat/skill-check.hbs",
        "systems/cyberpunk/templates/chat/fumble.hbs",
        "systems/cyberpunk/templates/chat/melee-execute.hbs",
        "systems/cyberpunk/templates/chat/melee-hit.hbs",

        // Chat card partials
        "systems/cyberpunk/templates/chat/partials/card-header.hbs",
        "systems/cyberpunk/templates/chat/partials/section-bar.hbs",
        "systems/cyberpunk/templates/chat/partials/weapon-line.hbs",
        "systems/cyberpunk/templates/chat/partials/formula-bar.hbs",
        "systems/cyberpunk/templates/chat/partials/roll-details.hbs",
        "systems/cyberpunk/templates/chat/partials/result-row.hbs",
        "systems/cyberpunk/templates/chat/partials/damage-grid.hbs",

        // Item sheet
        "systems/cyberpunk/templates/item/item-sheet.hbs",

        // Weapon parts
        "systems/cyberpunk/templates/item/parts/weapon/summary.hbs",
        "systems/cyberpunk/templates/item/parts/weapon/settings.hbs",
        // Armor parts
        "systems/cyberpunk/templates/item/parts/armor/summary.hbs",
        "systems/cyberpunk/templates/item/parts/armor/settings.hbs",
        // Cyberware (old item sheet parts)
        "systems/cyberpunk/templates/item/parts/cyberware/summary.hbs",
        "systems/cyberpunk/templates/item/parts/cyberware/settings.hbs",
        // Cyberware card partials
        "systems/cyberpunk/templates/item/parts/cyberware/tab-description.hbs",
        "systems/cyberpunk/templates/item/parts/cyberware/tab-details.hbs",
        "systems/cyberpunk/templates/item/parts/cyberware/tab-effect.hbs",
        "systems/cyberpunk/templates/item/parts/cyberware/tab-weapon.hbs",
        "systems/cyberpunk/templates/item/parts/cyberware/tab-armor.hbs",
        // Vehicle
        "systems/cyberpunk/templates/item/parts/vehicle/summary.hbs",
        "systems/cyberpunk/templates/item/parts/vehicle/settings.hbs",
        // Skill
        "systems/cyberpunk/templates/item/parts/skill/summary.hbs",
        "systems/cyberpunk/templates/item/parts/skill/settings.hbs",
        // Skill card partials
        "systems/cyberpunk/templates/item/parts/skill/tab-description.hbs",
        "systems/cyberpunk/templates/item/parts/skill/tab-details.hbs",
        "systems/cyberpunk/templates/item/parts/skill/tab-martial.hbs",

        // Commodity
        "systems/cyberpunk/templates/item/parts/commodity/summary.hbs",
        "systems/cyberpunk/templates/item/parts/commodity/settings.hbs",

        // Weapon settings dialog
        "systems/cyberpunk/templates/dialog/modifiers.hbs",
        "systems/cyberpunk/templates/dialog/skill-roll.hbs",
        "systems/cyberpunk/templates/dialog/initiative-roll.hbs",
        "systems/cyberpunk/templates/dialog/melee-attack.hbs",
        "systems/cyberpunk/templates/dialog/defence-roll.hbs",

        // Program
        "systems/cyberpunk/templates/item/parts/program/summary.hbs",
        "systems/cyberpunk/templates/item/parts/program/settings.hbs",

        // Role
        "systems/cyberpunk/templates/item/role-sheet.hbs",
        "systems/cyberpunk/templates/item/parts/role/summary.hbs",
        "systems/cyberpunk/templates/item/parts/role/settings.hbs",

        // Settings
        "systems/cyberpunk/templates/settings/skill-mapping-config.hbs",

    ]);
  };
  