/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function() {
    // Path to partial from foundry path. For cyberpunk, is "systems/cp2020/templates/actor/parts/___.hbs". Is .hbs as they're handlebars files
    return loadTemplates([
        "systems/cp2020/templates/actor/parts/statsrow.hbs",
        "systems/cp2020/templates/actor/parts/woundtracker.hbs",
        "systems/cp2020/templates/actor/parts/skills.hbs",
        "systems/cp2020/templates/actor/parts/gear.hbs",
        "systems/cp2020/templates/actor/parts/cyberware.hbs",
        "systems/cp2020/templates/actor/parts/combat.hbs",
        "systems/cp2020/templates/actor/parts/armor-display.hbs",
        "systems/cp2020/templates/actor/parts/skill.hbs",
        "systems/cp2020/templates/actor/parts/netrunning.hbs",

        // Shared templates
        "systems/cp2020/templates/fields/string.hbs",
        "systems/cp2020/templates/fields/number.hbs",
        "systems/cp2020/templates/fields/boolean.hbs",
        "systems/cp2020/templates/fields/select.hbs",

        // Roll templates
        "systems/cp2020/templates/chat/default-roll.hbs",
        "systems/cp2020/templates/chat/weapon-roll.hbs",
        "systems/cp2020/templates/chat/multi-hit.hbs",
        "systems/cp2020/templates/chat/initiative.hbs",
        "systems/cp2020/templates/chat/save-roll.hbs",
        "systems/cp2020/templates/chat/suppressive.hbs",
        "systems/cp2020/templates/chat/formula-roll.hbs",

        // Chat card partials
        "systems/cp2020/templates/chat/partials/card-header.hbs",
        "systems/cp2020/templates/chat/partials/section-bar.hbs",
        "systems/cp2020/templates/chat/partials/weapon-line.hbs",
        "systems/cp2020/templates/chat/partials/formula-bar.hbs",
        "systems/cp2020/templates/chat/partials/roll-details.hbs",
        "systems/cp2020/templates/chat/partials/result-row.hbs",
        "systems/cp2020/templates/chat/partials/damage-grid.hbs",

        // Item sheet
        "systems/cp2020/templates/item/item-sheet.hbs",

        // Weapon parts
        "systems/cp2020/templates/item/parts/weapon/summary.hbs",
        "systems/cp2020/templates/item/parts/weapon/settings.hbs",
        // Armor parts
        "systems/cp2020/templates/item/parts/armor/summary.hbs",
        "systems/cp2020/templates/item/parts/armor/settings.hbs",
        // Cyberware (old item sheet parts)
        "systems/cp2020/templates/item/parts/cyberware/summary.hbs",
        "systems/cp2020/templates/item/parts/cyberware/settings.hbs",
        // Cyberware card partials
        "systems/cp2020/templates/item/parts/cyberware/tab-description.hbs",
        "systems/cp2020/templates/item/parts/cyberware/tab-details.hbs",
        "systems/cp2020/templates/item/parts/cyberware/tab-effect.hbs",
        "systems/cp2020/templates/item/parts/cyberware/tab-weapon.hbs",
        "systems/cp2020/templates/item/parts/cyberware/tab-armor.hbs",
        // Vehicle
        "systems/cp2020/templates/item/parts/vehicle/summary.hbs",
        "systems/cp2020/templates/item/parts/vehicle/settings.hbs",
        // Skill
        "systems/cp2020/templates/item/parts/skill/summary.hbs",
        "systems/cp2020/templates/item/parts/skill/settings.hbs",

        // Commodity
        "systems/cp2020/templates/item/parts/commodity/summary.hbs",
        "systems/cp2020/templates/item/parts/commodity/settings.hbs",

        // Weapon settings dialog
        "systems/cp2020/templates/dialog/modifiers.hbs",

        // Program
        "systems/cp2020/templates/item/parts/program/summary.hbs",
        "systems/cp2020/templates/item/parts/program/settings.hbs",

        // Role
        "systems/cp2020/templates/item/role-sheet.hbs",
        "systems/cp2020/templates/item/parts/role/summary.hbs",
        "systems/cp2020/templates/item/parts/role/settings.hbs",

        // Settings
        "systems/cp2020/templates/settings/skill-mapping-config.hbs",

    ]);
  };
  