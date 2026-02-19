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
import { CyberpunkCyberwareSheet } from "./item/cyberware-sheet.js";
import { CyberpunkChatMessage } from "./chat-message.js";
import { CyberpunkCombat } from "./combat.js";
import { processFormulaRoll } from "./dice.js";
import { CYBERPUNK_CONDITIONS, CONDITION_EFFECTS } from "./conditions.js";
import { CyberpunkTokenRuler } from "./canvas/token-ruler.js";
import { CreateItemDialog } from "./dialog/create-item-dialog.js";

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
    CONFIG.statusEffects = CYBERPUNK_CONDITIONS;

    // Register custom token ruler for color-coded movement
    CONFIG.Token.rulerClass = CyberpunkTokenRuler;

    // Override the Items sidebar "Create Item" button with our custom dialog
    class CyberpunkItemDirectory extends ItemDirectory {
      _onCreateEntry(event) {
        event.preventDefault();
        event.stopPropagation();
        new CreateItemDialog().render(true);
      }
    }
    CONFIG.ui.items = CyberpunkItemDirectory;

    // Register sheets, unregister original core sheets
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("cyberpunk", CyberpunkActorSheet, { makeDefault: true });
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("cyberpunk", CyberpunkItemSheet, { makeDefault: true });
    Items.registerSheet("cyberpunk", CyberpunkRoleSheet, {
        types: ["role"],
        makeDefault: true,
        label: "CYBERPUNK.RoleSheet"
    });
    Items.registerSheet("cyberpunk", CyberpunkSkillSheet, {
        types: ["skill"],
        makeDefault: true,
        label: "CYBERPUNK.SkillSheet"
    });
    Items.registerSheet("cyberpunk", CyberpunkCommoditySheet, {
        types: ["misc"],
        makeDefault: true,
        label: "CYBERPUNK.CommoditySheet"
    });
    Items.registerSheet("cyberpunk", CyberpunkOutfitSheet, {
        types: ["armor"],
        makeDefault: true,
        label: "CYBERPUNK.OutfitSheet"
    });
    Items.registerSheet("cyberpunk", CyberpunkAmmoSheet, {
        types: ["ammo"],
        makeDefault: true,
        label: "CYBERPUNK.AmmoSheet"
    });
    Items.registerSheet("cyberpunk", CyberpunkWeaponSheet, {
        types: ["weapon"],
        makeDefault: true,
        label: "CYBERPUNK.WeaponSheet"
    });
    Items.registerSheet("cyberpunk", CyberpunkOrdnanceSheet, {
        types: ["ordnance"],
        makeDefault: true,
        label: "CYBERPUNK.OrdnanceSheet"
    });
    Items.registerSheet("cyberpunk", CyberpunkToolSheet, {
        types: ["tool"],
        makeDefault: true,
        label: "CYBERPUNK.ToolSheet"
    });
    Items.registerSheet("cyberpunk", CyberpunkDrugSheet, {
        types: ["drug"],
        makeDefault: true,
        label: "CYBERPUNK.DrugSheet"
    });
    Items.registerSheet("cyberpunk", CyberpunkProgramSheet, {
        types: ["program"],
        makeDefault: true,
        label: "CYBERPUNK.ProgramSheet"
    });
    Items.registerSheet("cyberpunk", CyberpunkCyberwareSheet, {
        types: ["cyberware"],
        makeDefault: true,
        label: "CYBERPUNK.CyberwareSheet"
    });

    // Register System Settings
    registerSystemSettings();

    registerHandlebarsHelpers();

    // Register and preload templates with Foundry. See templates.js for usage
    preloadHandlebarsTemplates();
});

/**
 * Localize condition names in CONFIG.statusEffects after language files are loaded.
 * Foundry v13 uses 'name' for display text in status effects.
 */
Hooks.once("setup", function() {
    CONFIG.statusEffects = CONFIG.statusEffects.map(effect => {
        if (effect.name?.startsWith("CYBERPUNK.")) {
            return {
                ...effect,
                name: game.i18n.localize(effect.name)
            };
        }
        return effect;
    });
});

/**
 * Ensure condition ActiveEffects are created with localized names.
 * Foundry v13 uses 'name' for display text in status effects.
 */
Hooks.on("preCreateActiveEffect", (effect, data, options, userId) => {
    // Get the status ID from the effect
    const statusId = effect.statuses?.first();

    // Localize name if it contains a translation key
    if (effect.name?.includes("CYBERPUNK.")) {
        effect.updateSource({ name: game.i18n.localize(effect.name) });
    }

    // Apply condition effect changes if defined
    if (statusId && CONDITION_EFFECTS[statusId]) {
        const conditionEffect = CONDITION_EFFECTS[statusId];
        if (conditionEffect.changes?.length > 0) {
            effect.updateSource({ changes: conditionEffect.changes });
        }
    }
});

/**
 * Migrate existing ActiveEffects to use localized condition names.
 * This fixes effects created before proper localization was added.
 */
async function _migrateConditionNames() {
    // Build a map of status ID to localized name from CONFIG.statusEffects
    const statusNameMap = new Map();
    for (const effect of CONFIG.statusEffects) {
        if (effect.statuses?.length) {
            statusNameMap.set(effect.statuses[0], effect.name);
        }
    }

    // Helper to migrate effects on an actor
    async function migrateActorEffects(actor) {
        const updates = [];
        for (const effect of actor.effects) {
            const statusId = effect.statuses?.first();
            if (statusId && statusNameMap.has(statusId)) {
                const localizedName = statusNameMap.get(statusId);
                // Check if name contains unlocalized translation key
                if (effect.name?.includes("CYBERPUNK.")) {
                    updates.push({ _id: effect.id, name: localizedName });
                }
            }
        }
        if (updates.length > 0) {
            await actor.updateEmbeddedDocuments("ActiveEffect", updates);
            console.log(`CYBERPUNK: Migrated ${updates.length} condition names on ${actor.name}`);
        }
    }

    // Migrate world actors
    for (const actor of game.actors) {
        await migrateActorEffects(actor);
    }

    // Migrate unlinked tokens in all scenes
    for (const scene of game.scenes) {
        for (const token of scene.tokens) {
            if (!token.actorLink && token.actor) {
                await migrateActorEffects(token.actor);
            }
        }
    }
}

/**
 * Check whether a data migration is needed when the world is ready.
 */
Hooks.once("ready", async function() {
    // Determine whether a system migration is required and feasible
    if ( !game.user.isGM ) return;

    // Reconcile skill mappings with current defaults (add new, remove obsolete)
    migrateSkillMappings();

    // Fix any existing ActiveEffects with unlocalized condition names
    _migrateConditionNames();

    const lastMigrateVersion = game.settings.get("cyberpunk", "systemMigrationVersion");
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
        Hooks.callAll("cyberpunk.targetChanged");
    }
});

/**
 * Broadcast token selection changes to chat messages for reactive UI updates
 */
Hooks.on("controlToken", (token, controlled) => {
    Hooks.callAll("cyberpunk.selectionChanged");
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
    const newContent = await foundry.applications.handlebars.renderTemplate(
        "systems/cyberpunk/templates/chat/formula-roll.hbs",
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
 * - If Burning: deal damage (2d10 first turn, 1d10 second, 1d6 third)
 * - If Acid: reduce armor SP or deal wounds
 * - Handle timed conditions (blinded, deafened, shocked from microwave)
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

    // Reset action count at start of turn
    await actor.unsetFlag("cyberpunk", "actionCount");

    // Reset movement tracking for cumulative distance
    await actor.unsetFlag("cyberpunk", "movementActionRegistered");
    await actor.setFlag("cyberpunk", "cumulativeDistance", 0);

    // Store starting position for movement tracking
    const token = combatant.token?.object;
    if (token) {
        await actor.setFlag("cyberpunk", "lastPosition", {
            x: token.document.x,
            y: token.document.y
        });
    }

    // Check if the actor has the Shocked condition (and is not Dead)
    if (actor.statuses.has("shocked") && !actor.statuses.has("dead")) {
        // Get the modifier from the character sheet
        const modifier = actor.system.stunSaveMod || 0;
        // Auto-roll Shock Save at the start of their turn
        await actor.rollStunSave(modifier);
    }

    // Check if Mortally Wounded (woundState >= 4) and NOT Stabilized and NOT Dead
    if (actor.getWoundLevel() >= 4 &&
        !actor.statuses.has("stabilized") &&
        !actor.statuses.has("dead")) {
        const modifier = actor.system.deathSaveMod || 0;
        await actor.rollDeathSave(modifier);
    }

    // Handle Burning damage (2d10 first turn, 1d10 second, 1d6 third)
    if (actor.statuses.has("burning")) {
        const duration = actor.getFlag("cyberpunk", "burningDuration") || 0;
        if (duration > 0) {
            // Roll burning damage based on remaining duration
            let damageFormula;
            if (duration === 3) damageFormula = "2d10";      // First turn
            else if (duration === 2) damageFormula = "1d10"; // Second turn
            else damageFormula = "1d6";                       // Third turn

            const damageRoll = await new Roll(damageFormula).evaluate();
            const damage = damageRoll.total;

            // Apply damage (ignores armor)
            const currentDamage = actor.system.damage || 0;
            await actor.update({ "system.damage": Math.min(currentDamage + damage, 40) });

            // Post to chat with expandable roll details
            const speaker = ChatMessage.getSpeaker({ actor });
            const rollData = processFormulaRoll(damageRoll);
            const content = await foundry.applications.handlebars.renderTemplate("systems/cyberpunk/templates/chat/condition-damage.hbs", {
                label: game.i18n.localize("CYBERPUNK.BurningDamage"),
                icon: "fire",
                formula: rollData.formula,
                diceGroups: rollData.diceGroups,
                total: rollData.total,
                displayValue: damage
            });
            ChatMessage.create({
                speaker,
                rolls: [damageRoll],
                sound: "sounds/dice.wav",
                content
            });

            // Decrement duration
            const newDuration = duration - 1;
            if (newDuration <= 0) {
                await actor.toggleStatusEffect("burning", { active: false });
                await actor.unsetFlag("cyberpunk", "burningDuration");
            } else {
                await actor.setFlag("cyberpunk", "burningDuration", newDuration);
            }
        }
    }

    // Handle Acid SP reduction (1d6 per turn for 3 turns)
    if (actor.statuses.has("acid")) {
        const duration = actor.getFlag("cyberpunk", "acidDuration") || 0;
        const hitLocation = actor.getFlag("cyberpunk", "acidLocation");

        if (duration > 0 && hitLocation) {
            const spReductionRoll = await new Roll("1d6").evaluate();
            const spReduction = spReductionRoll.total;

            // Find armor at hit location
            const armor = actor.items.filter(i =>
                i.type === "armor" &&
                i.system.equipped &&
                i.system.coverage?.[hitLocation]?.stoppingPower > 0
            );

            const speaker = ChatMessage.getSpeaker({ actor });

            // Process roll for template display
            const rollData = processFormulaRoll(spReductionRoll);

            if (armor.length > 0) {
                // Reduce SP on all armor at location
                for (const item of armor) {
                    const currentSP = item.system.coverage[hitLocation].stoppingPower || 0;
                    const newSP = Math.max(0, currentSP - spReduction);
                    await item.update({ [`system.coverage.${hitLocation}.stoppingPower`]: newSP });
                }
                const content = await foundry.applications.handlebars.renderTemplate("systems/cyberpunk/templates/chat/condition-damage.hbs", {
                    label: game.i18n.localize("CYBERPUNK.AcidDamage"),
                    icon: "acid",
                    formula: rollData.formula,
                    diceGroups: rollData.diceGroups,
                    total: rollData.total,
                    displayValue: `-${spReduction} SP`
                });
                ChatMessage.create({
                    speaker,
                    rolls: [spReductionRoll],
                    sound: "sounds/dice.wav",
                    content
                });
            } else {
                // No armor - deal wound damage instead
                const currentDamage = actor.system.damage || 0;
                await actor.update({ "system.damage": Math.min(currentDamage + spReduction, 40) });
                const content = await foundry.applications.handlebars.renderTemplate("systems/cyberpunk/templates/chat/condition-damage.hbs", {
                    label: game.i18n.localize("CYBERPUNK.AcidWounds"),
                    icon: "acid",
                    formula: rollData.formula,
                    diceGroups: rollData.diceGroups,
                    total: rollData.total,
                    displayValue: spReduction
                });
                ChatMessage.create({
                    speaker,
                    rolls: [spReductionRoll],
                    sound: "sounds/dice.wav",
                    content
                });
            }

            // Decrement duration
            const newDuration = duration - 1;
            if (newDuration <= 0) {
                await actor.toggleStatusEffect("acid", { active: false });
                await actor.unsetFlag("cyberpunk", "acidDuration");
                await actor.unsetFlag("cyberpunk", "acidLocation");
            } else {
                await actor.setFlag("cyberpunk", "acidDuration", newDuration);
            }
        }
    }

    // Handle timed conditions from microwave (blinded, deafened, shocked)
    for (const conditionId of ["blinded", "deafened", "shocked"]) {
        const flagKey = `${conditionId}Duration`;
        const duration = actor.getFlag("cyberpunk", flagKey);
        if (duration && duration > 0) {
            const newDuration = duration - 1;
            if (newDuration <= 0) {
                await actor.toggleStatusEffect(conditionId, { active: false });
                await actor.unsetFlag("cyberpunk", flagKey);
            } else {
                await actor.setFlag("cyberpunk", flagKey, newDuration);
            }
        }
    }
});

/**
 * Track token movement during combat and register as action if exceeds walk distance
 */
Hooks.on("updateToken", async (tokenDocument, change, options, userId) => {
    // Only process for GM to avoid duplicate tracking
    if (!game.user.isGM) return;

    // Only track during combat
    if (!game.combat) return;

    // Only track position changes
    if (!change.x && !change.y) return;

    // Get the actor
    const actor = tokenDocument.actor;
    if (!actor) return;

    // Only track for current combatant
    const currentCombatant = game.combat.combatant;
    if (!currentCombatant || currentCombatant.actorId !== actor.id) return;

    // Get last position from previous move
    const lastPos = actor.getFlag("cyberpunk", "lastPosition");
    if (!lastPos) return; // No last position recorded

    // Get current position (after this move)
    const currentX = change.x ?? tokenDocument.x;
    const currentY = change.y ?? tokenDocument.y;

    // Get token dimensions for center point
    const gridSize = canvas.grid.size;
    const width = tokenDocument.width || 1;
    const height = tokenDocument.height || 1;

    const lastCenter = {
        x: lastPos.x + (width * gridSize) / 2,
        y: lastPos.y + (height * gridSize) / 2
    };
    const currentCenter = {
        x: currentX + (width * gridSize) / 2,
        y: currentY + (height * gridSize) / 2
    };

    // Calculate distance of THIS move
    const path = canvas.grid.measurePath([lastCenter, currentCenter], { gridSpaces: false });
    const moveDistance = path.distance;

    // Add to cumulative distance
    const previousCumulative = actor.getFlag("cyberpunk", "cumulativeDistance") || 0;
    const newCumulative = previousCumulative + moveDistance;
    await actor.setFlag("cyberpunk", "cumulativeDistance", newCumulative);

    // Update last position for next move
    await actor.setFlag("cyberpunk", "lastPosition", { x: currentX, y: currentY });

    // Get walk distance from actor
    const walkDistance = actor.system.stats?.ma?.total ?? 0;

    // Check if we've already registered movement as an action this turn
    const movementRegistered = actor.getFlag("cyberpunk", "movementActionRegistered");

    // If cumulative distance exceeds walk distance and haven't registered yet, register as action
    if (newCumulative > walkDistance && !movementRegistered) {
        const { registerAction } = await import("./action-tracker.js");
        await registerAction(actor, `movement (${Math.round(newCumulative)}m > ${walkDistance}m walk)`);
        // Mark that we've registered movement this turn
        await actor.setFlag("cyberpunk", "movementActionRegistered", true);
    }
});
