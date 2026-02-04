/**
 * Cyberpunk 2020 Conditions System
 * Defines status effects for wounds, shock, and death
 */

/**
 * All condition IDs that represent wound states (for easy iteration)
 */
export const WOUND_CONDITION_IDS = [
    "lightly-wounded",
    "seriously-wounded",
    "critically-wounded",
    "mortally-wounded-0",
    "mortally-wounded-1",
    "mortally-wounded-2",
    "mortally-wounded-3",
    "mortally-wounded-4",
    "mortally-wounded-5",
    "mortally-wounded-6"
];

/**
 * Map wound state (1-10) to condition ID
 */
export const WOUND_STATE_TO_CONDITION = {
    1: "lightly-wounded",
    2: "seriously-wounded",
    3: "critically-wounded",
    4: "mortally-wounded-0",
    5: "mortally-wounded-1",
    6: "mortally-wounded-2",
    7: "mortally-wounded-3",
    8: "mortally-wounded-4",
    9: "mortally-wounded-5",
    10: "mortally-wounded-6"
};

/**
 * Condition definitions for CONFIG.statusEffects
 * These appear in the token HUD and can be toggled on tokens
 */
export const CP2020_CONDITIONS = [
    {
        id: "lightly-wounded",
        name: "CYBERPUNK.Conditions.LightlyWounded",
        icon: "systems/cp2020/img/conditions/light.svg",
        statuses: ["lightly-wounded"]
    },
    {
        id: "seriously-wounded",
        name: "CYBERPUNK.Conditions.SeriouslyWounded",
        icon: "systems/cp2020/img/conditions/serious.svg",
        statuses: ["seriously-wounded"]
    },
    {
        id: "critically-wounded",
        name: "CYBERPUNK.Conditions.CriticallyWounded",
        icon: "systems/cp2020/img/conditions/critical.svg",
        statuses: ["critically-wounded"]
    },
    {
        id: "mortally-wounded-0",
        name: "CYBERPUNK.Conditions.MortallyWounded0",
        icon: "systems/cp2020/img/conditions/mortal0.svg",
        statuses: ["mortally-wounded-0"]
    },
    {
        id: "mortally-wounded-1",
        name: "CYBERPUNK.Conditions.MortallyWounded1",
        icon: "systems/cp2020/img/conditions/mortal1.svg",
        statuses: ["mortally-wounded-1"]
    },
    {
        id: "mortally-wounded-2",
        name: "CYBERPUNK.Conditions.MortallyWounded2",
        icon: "systems/cp2020/img/conditions/mortal2.svg",
        statuses: ["mortally-wounded-2"]
    },
    {
        id: "mortally-wounded-3",
        name: "CYBERPUNK.Conditions.MortallyWounded3",
        icon: "systems/cp2020/img/conditions/mortal3.svg",
        statuses: ["mortally-wounded-3"]
    },
    {
        id: "mortally-wounded-4",
        name: "CYBERPUNK.Conditions.MortallyWounded4",
        icon: "systems/cp2020/img/conditions/mortal4.svg",
        statuses: ["mortally-wounded-4"]
    },
    {
        id: "mortally-wounded-5",
        name: "CYBERPUNK.Conditions.MortallyWounded5",
        icon: "systems/cp2020/img/conditions/mortal5.svg",
        statuses: ["mortally-wounded-5"]
    },
    {
        id: "mortally-wounded-6",
        name: "CYBERPUNK.Conditions.MortallyWounded6",
        icon: "systems/cp2020/img/conditions/mortal6.svg",
        statuses: ["mortally-wounded-6"]
    },
    {
        id: "shocked",
        name: "CYBERPUNK.Conditions.Shocked",
        icon: "systems/cp2020/img/conditions/shocked.svg",
        statuses: ["shocked"]
    },
    {
        id: "dead",
        name: "CYBERPUNK.Conditions.Dead",
        icon: "systems/cp2020/img/conditions/dead.svg",
        statuses: ["dead"]
    },
    {
        id: "stabilized",
        name: "CYBERPUNK.Conditions.Stabilized",
        icon: "systems/cp2020/img/conditions/stabilized.svg",
        statuses: ["stabilized"]
    },
    {
        id: "lost-left-arm",
        name: "CYBERPUNK.Conditions.LostLeftArm",
        icon: "systems/cp2020/img/conditions/lost-left-arm.svg",
        statuses: ["lost-left-arm"]
    },
    {
        id: "lost-right-arm",
        name: "CYBERPUNK.Conditions.LostRightArm",
        icon: "systems/cp2020/img/conditions/lost-right-arm.svg",
        statuses: ["lost-right-arm"]
    },
    {
        id: "lost-left-leg",
        name: "CYBERPUNK.Conditions.LostLeftLeg",
        icon: "systems/cp2020/img/conditions/lost-left-leg.svg",
        statuses: ["lost-left-leg"]
    },
    {
        id: "lost-right-leg",
        name: "CYBERPUNK.Conditions.LostRightLeg",
        icon: "systems/cp2020/img/conditions/lost-right-leg.svg",
        statuses: ["lost-right-leg"]
    },
    {
        id: "fast-draw",
        name: "CYBERPUNK.Conditions.FastDraw",
        icon: "systems/cp2020/img/conditions/fast-draw.svg",
        statuses: ["fast-draw"]
    },
    {
        id: "action-surge",
        name: "CYBERPUNK.Conditions.ActionSurge",
        icon: "systems/cp2020/img/conditions/action-surge.svg",
        statuses: ["action-surge"]
    },
    {
        id: "poisoned",
        name: "CYBERPUNK.Conditions.Poisoned",
        icon: "systems/cp2020/img/conditions/poisoned.svg",
        statuses: ["poisoned"]
    },
    {
        id: "confused",
        name: "CYBERPUNK.Conditions.Confused",
        icon: "systems/cp2020/img/conditions/confused.svg",
        statuses: ["confused"]
    },
    {
        id: "tearing",
        name: "CYBERPUNK.Conditions.Tearing",
        icon: "systems/cp2020/img/conditions/tearing.svg",
        statuses: ["tearing"]
    },
    {
        id: "unconscious",
        name: "CYBERPUNK.Conditions.Unconscious",
        icon: "systems/cp2020/img/conditions/unconscious.svg",
        statuses: ["unconscious"]
    },
    {
        id: "burning",
        name: "CYBERPUNK.Conditions.Burning",
        icon: "systems/cp2020/img/conditions/burning.svg",
        statuses: ["burning"]
    },
    {
        id: "acid",
        name: "CYBERPUNK.Conditions.Acid",
        icon: "systems/cp2020/img/conditions/acid.svg",
        statuses: ["acid"]
    },
    {
        id: "blinded",
        name: "CYBERPUNK.Conditions.Blinded",
        icon: "systems/cp2020/img/conditions/blinded.svg",
        statuses: ["blinded"]
    },
    {
        id: "shorted",
        name: "CYBERPUNK.Conditions.Shorted",
        icon: "systems/cp2020/img/conditions/microwave.svg",
        statuses: ["shorted"]
    },
    {
        id: "deafened",
        name: "CYBERPUNK.Conditions.Deafened",
        icon: "systems/cp2020/img/conditions/deafened.svg",
        statuses: ["deafened"]
    },
    {
        id: "grappled",
        name: "CYBERPUNK.Conditions.Grappled",
        icon: "systems/cp2020/img/conditions/grappled.svg",
        statuses: ["grappled"]
    },
    {
        id: "prone",
        name: "CYBERPUNK.Conditions.Prone",
        icon: "systems/cp2020/img/conditions/prone.svg",
        statuses: ["prone"]
    }
];

/**
 * Active Effect changes for each condition
 * These define the mechanical penalties applied by each condition
 */
export const CONDITION_EFFECTS = {
    "lightly-wounded": {
        // No mechanical effect
        changes: []
    },
    "seriously-wounded": {
        // REF -2
        changes: [
            { key: "system.stats.ref.value", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-2" }
        ]
    },
    "critically-wounded": {
        // REF, INT, COOL reduced by half
        changes: [
            { key: "system.stats.ref.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.5" },
            { key: "system.stats.int.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.5" },
            { key: "system.stats.cool.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.5" }
        ]
    },
    "mortally-wounded-0": {
        // REF, INT, COOL reduced to 1/3
        changes: [
            { key: "system.stats.ref.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.int.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.cool.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" }
        ]
    },
    "mortally-wounded-1": {
        changes: [
            { key: "system.stats.ref.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.int.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.cool.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" }
        ]
    },
    "mortally-wounded-2": {
        changes: [
            { key: "system.stats.ref.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.int.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.cool.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" }
        ]
    },
    "mortally-wounded-3": {
        changes: [
            { key: "system.stats.ref.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.int.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.cool.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" }
        ]
    },
    "mortally-wounded-4": {
        changes: [
            { key: "system.stats.ref.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.int.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.cool.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" }
        ]
    },
    "mortally-wounded-5": {
        changes: [
            { key: "system.stats.ref.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.int.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.cool.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" }
        ]
    },
    "mortally-wounded-6": {
        changes: [
            { key: "system.stats.ref.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.int.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" },
            { key: "system.stats.cool.value", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: "0.33" }
        ]
    },
    "shocked": {
        // Cannot act - no stat changes, handled via combat logic
        changes: []
    },
    "dead": {
        // Cannot act - no stat changes, handled via combat logic
        changes: []
    },
    "stabilized": {
        // Prevents Death Save at turn start - no stat changes
        changes: []
    },
    "lost-left-arm": {
        // Limb loss - no automatic stat changes
        changes: []
    },
    "lost-right-arm": {
        // Limb loss - no automatic stat changes
        changes: []
    },
    "lost-left-leg": {
        // Limb loss - no automatic stat changes
        changes: []
    },
    "lost-right-leg": {
        // Limb loss - no automatic stat changes
        changes: []
    },
    "fast-draw": {
        // +3 initiative, -3 to all rolls - applied manually in rolls
        changes: []
    },
    "action-surge": {
        // -3 on all rolls - applied manually in rolls
        changes: []
    },
    "poisoned": {
        // REF -4
        changes: [
            { key: "system.stats.ref.tempMod", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-4" }
        ]
    },
    "confused": {
        // INT -4
        changes: [
            { key: "system.stats.int.tempMod", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-4" }
        ]
    },
    "tearing": {
        // REF -2
        changes: [
            { key: "system.stats.ref.tempMod", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-2" }
        ]
    },
    "unconscious": {
        // No vision, -8 to Awareness/Notice rolls, can't act - handled in combat/skill logic
        changes: []
    },
    "burning": {
        // Damage over time: 2d10 (turn 1), 1d10 (turn 2), 1d6 (turn 3) - handled in combat logic
        changes: []
    },
    "acid": {
        // Armor damage 1d6 SP per round for 3 rounds - handled in combat logic
        changes: []
    },
    "blinded": {
        // No vision, -4 to Awareness/Notice rolls - handled in skill logic
        changes: []
    },
    "shorted": {
        // REF -3
        changes: [
            { key: "system.stats.ref.tempMod", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-3" }
        ]
    },
    "deafened": {
        // -2 to Awareness/Notice rolls - handled in skill logic
        changes: []
    },
    "grappled": {
        // Movement reduced to 0 - handled in movement logic
        changes: []
    },
    "prone": {
        // Movement reduced to 0 - handled in movement logic
        changes: []
    }
};

/**
 * Get the condition ID for a given wound state
 * @param {number} woundState - The wound state (0-10)
 * @returns {string|null} The condition ID, or null if uninjured
 */
export function getConditionForWoundState(woundState) {
    return WOUND_STATE_TO_CONDITION[woundState] || null;
}

/**
 * Check if a condition ID is a wound condition (vs shocked/dead)
 * @param {string} conditionId - The condition ID to check
 * @returns {boolean}
 */
export function isWoundCondition(conditionId) {
    return WOUND_CONDITION_IDS.includes(conditionId);
}
