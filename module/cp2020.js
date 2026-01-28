import { CyberpunkActor } from "./actor/actor.js";
import { CyberpunkActorSheet } from "./actor/actor-sheet.js";
import { CyberpunkItem } from "./item/item.js";
import { CyberpunkItemSheet } from "./item/item-sheet.js";
import { CyberpunkRoleSheet } from "./item/role-sheet.js";
import { CyberpunkSkillSheet } from "./item/skill-sheet.js";
import { CyberpunkCommoditySheet } from "./item/commodity-sheet.js";
import { CyberpunkOutfitSheet } from "./item/outfit-sheet.js";
import { CyberpunkAmmoSheet } from "./item/ammo-sheet.js";
import { CyberpunkWeaponSheet } from "./item/weapon-sheet.js";
import { CyberpunkOrdnanceSheet } from "./item/ordnance-sheet.js";
import { CyberpunkToolSheet } from "./item/tool-sheet.js";
import { CyberpunkDrugSheet } from "./item/drug-sheet.js";
import { CyberpunkProgramSheet } from "./item/program-sheet.js";
import { CyberpunkChatMessage } from "./chat-message.js";
import { CyberpunkCombat } from "./combat.js";
import { processFormulaRoll } from "./dice.js";
import { CP2020_CONDITIONS } from "./conditions.js";

import { preloadHandlebarsTemplates } from "./templates.js";
import { registerHandlebarsHelpers } from "./handlebars-helpers.js"
import * as migrations from "./migrate.js";
import { registerSystemSettings, migrateSkillMappings } from "./settings.js"

Hooks.once('init', async function () {

    // Place classes in system namespace for later reference.
    game.cyberpunk = {
        entities: {
            CyberpunkActor,
            CyberpunkItem,
        },
        // A manual migrateworld.
        migrateWorld: migrations.migrateWorld
    };

    // Define custom Document classes
    CONFIG.Actor.documentClass = CyberpunkActor;
    CONFIG.Item.documentClass = CyberpunkItem;
    CONFIG.ChatMessage.documentClass = CyberpunkChatMessage;
    CONFIG.Combat.documentClass = CyberpunkCombat;

    // Register system conditions (status effects)
    CONFIG.statusEffects = CP2020_CONDITIONS;

    // Register sheets, unregister original core sheets
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("cp2020", CyberpunkActorSheet, { makeDefault: true });
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("cp2020", CyberpunkItemSheet, { makeDefault: true });
    Items.registerSheet("cp2020", CyberpunkRoleSheet, {
        types: ["role"],
        makeDefault: true,
        label: "CYBERPUNK.RoleSheet"
    });
    Items.registerSheet("cp2020", CyberpunkSkillSheet, {
        types: ["skill"],
        makeDefault: true,
        label: "CYBERPUNK.SkillSheet"
    });
    Items.registerSheet("cp2020", CyberpunkCommoditySheet, {
        types: ["misc"],
        makeDefault: true,
        label: "CYBERPUNK.CommoditySheet"
    });
    Items.registerSheet("cp2020", CyberpunkOutfitSheet, {
        types: ["armor"],
        makeDefault: true,
        label: "CYBERPUNK.OutfitSheet"
    });
    Items.registerSheet("cp2020", CyberpunkAmmoSheet, {
        types: ["ammo"],
        makeDefault: true,
        label: "CYBERPUNK.AmmoSheet"
    });
    Items.registerSheet("cp2020", CyberpunkWeaponSheet, {
        types: ["weapon"],
        makeDefault: true,
        label: "CYBERPUNK.WeaponSheet"
    });
    Items.registerSheet("cp2020", CyberpunkOrdnanceSheet, {
        types: ["ordnance"],
        makeDefault: true,
        label: "CYBERPUNK.OrdnanceSheet"
    });
    Items.registerSheet("cp2020", CyberpunkToolSheet, {
        types: ["tool"],
        makeDefault: true,
        label: "CYBERPUNK.ToolSheet"
    });
    Items.registerSheet("cp2020", CyberpunkDrugSheet, {
        types: ["drug"],
        makeDefault: true,
        label: "CYBERPUNK.DrugSheet"
    });
    Items.registerSheet("cp2020", CyberpunkProgramSheet, {
        types: ["program"],
        makeDefault: true,
        label: "CYBERPUNK.ProgramSheet"
    });

    // Register System Settings
    registerSystemSettings();

    registerHandlebarsHelpers();

    // Register and preload templates with Foundry. See templates.js for usage
    preloadHandlebarsTemplates();
});

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration (nabbed from Foundry's 5e module and adapted)
 */
Hooks.once("ready", function() {
    // Determine whether a system migration is required and feasible
    if ( !game.user.isGM ) return;

    // Reconcile skill mappings with current defaults (add new, remove obsolete)
    migrateSkillMappings();

    const lastMigrateVersion = game.settings.get("cp2020", "systemMigrationVersion");
    // We do need to try migrating if we haven't run before - as it stands, previous worlds didn't use this setting, or by default had it set to current version

    // The version migrations need to begin - if you make a change from 0.1 to 0.2, this should be 0.2
    const NEEDS_MIGRATION_VERSION = "0.3.0";
    console.log("CYBERPUNK: Last migrated in version: " + lastMigrateVersion);
    const needsMigration = foundry.utils.isNewerVersion(NEEDS_MIGRATION_VERSION, lastMigrateVersion);
    if ( !needsMigration ) return;
    migrations.migrateWorld();
});

/**
 * Broadcast target changes to chat messages for reactive UI updates
 */
Hooks.on("targetToken", (user, token, targeted) => {
    // Only react to current user's targeting
    if (user.id === game.user.id) {
        Hooks.callAll("cp2020.targetChanged");
    }
});

/**
 * Broadcast token selection changes to chat messages for reactive UI updates
 */
Hooks.on("controlToken", (token, controlled) => {
    Hooks.callAll("cp2020.selectionChanged");
});

/**
 * Intercept basic /roll commands and restyle them with our formula-roll template.
 * Uses preCreateChatMessage to capture speaker from selected token before message is created.
 */
Hooks.on("preCreateChatMessage", async (message, data, options, userId) => {
    // Only process messages with rolls that don't already have our styling
    if (!message.rolls?.length) return;
    if (message.content?.includes("cyberpunk-card")) return;

    // Process the first roll (basic /roll commands only have one)
    const roll = message.rolls[0];
    if (!roll) return;

    // Build template data using our helper
    const templateData = processFormulaRoll(roll);

    // Render the new content
    const newContent = await renderTemplate(
        "systems/cp2020/templates/chat/formula-roll.hbs",
        templateData
    );

    // Get speaker from selected token - this captures selection at roll time
    const speaker = ChatMessage.getSpeaker();

    // Update the message data before it's created
    message.updateSource({
        content: newContent,
        speaker: speaker
    });
});

/**
 * Handle combat turn changes - auto-roll saves for Shocked and Mortally Wounded combatants
 * When a combatant's turn starts:
 * - If Shocked: roll Shock Save to determine if they recover
 * - If Mortally Wounded (woundState >= 4) and NOT Stabilized and NOT Dead: roll Death Save
 * When a combatant's turn ends:
 * - Remove Fast Draw and Action Surge conditions (they only last one turn)
 */
Hooks.on("combatTurnChange", async (combat, prior, current) => {
    // Only run for GM to avoid duplicate rolls/updates
    if (!game.user.isGM) return;

    // Handle turn END for the previous combatant
    if (prior?.combatantId) {
        const previousCombatant = combat.combatants.get(prior.combatantId);
        if (previousCombatant?.actor) {
            const prevActor = previousCombatant.actor;

            // Remove Fast Draw at turn end
            if (prevActor.statuses.has("fast-draw")) {
                await prevActor.toggleStatusEffect("fast-draw", { active: false });
            }

            // Remove Action Surge at turn end
            if (prevActor.statuses.has("action-surge")) {
                await prevActor.toggleStatusEffect("action-surge", { active: false });
            }
        }
    }

    // Handle turn START for the current combatant
    const combatant = combat.combatants.get(current.combatantId);
    if (!combatant?.actor) return;

    const actor = combatant.actor;

    // Check if the actor has the Shocked condition (and is not Dead)
    if (actor.statuses.has("shocked") && !actor.statuses.has("dead")) {
        // Get the modifier from the character sheet
        const modifier = actor.system.stunSaveMod || 0;
        // Auto-roll Shock Save at the start of their turn
        await actor.rollStunSave(modifier);
    }

    // Check if Mortally Wounded (woundState >= 4) and NOT Stabilized and NOT Dead
    if (actor.woundState() >= 4 &&
        !actor.statuses.has("stabilized") &&
        !actor.statuses.has("dead")) {
        const modifier = actor.system.deathSaveMod || 0;
        await actor.rollDeathSave(modifier);
    }
});
