// This is where all the magic values go, because cyberpunk has SO many of those
// Any given string value is the same as its key in the localization file, and will be used for translation
import { getMartialKeyByName } from './translations.js'
import { localize } from './translations.js';
import { WEAPON_TYPE_TO_CATEGORY } from './settings/skill-mapping-defaults.js';

export let weaponTypes = {
    pistol: "Pistol",
    submachinegun: "SMG",
    shotgun: "Shotgun",
    rifle: "Rifle",
    heavy: "Heavy",
    bow: "Bow",
    crossbow: "Crossbow",
    melee: "Melee",
    exotic: "Exotic"
}

// Default attack skills (fallback when settings not initialized)
export const DEFAULT_ATTACK_SKILLS = {
    "Pistol": ["Handgun"],
    "SMG": ["Submachinegun"],
    "Shotgun": ["Rifle"],
    "Rifle": ["Rifle"],
    "Heavy": ["HeavyWeapons"],
    "Bow": ["Archery"],
    "Crossbow": ["Archery"],
    "Melee": ["Fencing", "Melee", "Brawling"],
    "Exotic": []
};

// --- Weapon card lookups ---

/** High-level weapon categories for the Weapon Type dropdown */
export const weaponCategories = {
    melee: "WeaponCatMelee",
    ranged: "WeaponCatRanged",
    exotic: "WeaponCatExotic"
};

/** Ranged weapon subtypes (maps to stored weaponType values) */
export const rangedSubtypes = {
    Pistol: "SubPistol",
    SMG: "SubSMG",
    Shotgun: "SubShotgun",
    Rifle: "SubRifle",
    Heavy: "SubHeavy",
    Bow: "SubBow",
    Crossbow: "SubCrossbow"
};

/** Melee damage types affecting armor penetration */
export const meleeDamageTypes = {
    blunt: "DmgBlunt",
    edged: "DmgEdged",
    spike: "DmgSpike",
    monoblade: "DmgMonoblade"
};

/** Ordnance template types (area of effect shapes) */
export const ordnanceTemplateTypes = {
    circle: "TemplateCircle",
    cone: "TemplateCone",
    beam: "TemplateBeam"
};

/** Tool bonus properties — actor property paths a tool can modify */
export const toolBonusProperties = {
    "stats.int.tempMod": "PropINT",
    "stats.ref.tempMod": "PropREF",
    "stats.tech.tempMod": "PropTECH",
    "stats.cool.tempMod": "PropCOOL",
    "stats.attr.tempMod": "PropATTR",
    "stats.luck.tempMod": "PropLUCK",
    "stats.ma.tempMod": "PropMA",
    "stats.bt.tempMod": "PropBT",
    "stats.emp.tempMod": "PropEMP",
    "initiativeMod": "PropInitiative",
    "stunSaveMod": "PropStunSave",
    "deathSaveMod": "PropDeathSave"
};

/** Program class types */
export const programClasses = {
    Intrusion: "ProgramIntrusion",
    Decryption: "ProgramDecryption",
    Detection: "ProgramDetection",
    AntiSystem: "ProgramAntiSystem",
    Stealth: "ProgramStealth",
    Protection: "ProgramProtection",
    AntiICE: "ProgramAntiICE",
    AntiPersonnel: "ProgramAntiPersonnel",
    Controller: "ProgramController",
    Utility: "ProgramUtility"
};

/** Cyberware types */
export const cyberwareTypes = {
    sensor: "CyberTypeSensor",
    cyberlimb: "CyberTypeCyberlimb",
    implant: "CyberTypeImplant",
    chipware: "CyberTypeChipware"
};

/** Cyberware subtypes by type */
export const cyberwareSubtypes = {
    sensor: {
        voice: "CyberSubVoice",
        audio: "CyberSubAudio",
        optics: "CyberSubOptics"
    },
    cyberlimb: {
        leftArm: "CyberSubLeftArm",
        rightArm: "CyberSubRightArm",
        leftLeg: "CyberSubLeftLeg",
        rightLeg: "CyberSubRightLeg",
        extraArm: "CyberSubExtraArm"
    },
    implant: {
        fashionware: "CyberSubFashionware",
        neuralware: "CyberSubNeuralware",
        bioware: "CyberSubBioware",
        nanotech: "CyberSubNanotech",
        bodyImplant: "CyberSubBodyImplant",
        bodyWeapon: "CyberSubBodyWeapon",
        bodyPlating: "CyberSubBodyPlating",
        linearFrame: "CyberSubLinearFrame"
    },
    chipware: {
        skill: "CyberSubSkillChip",
        behavior: "CyberSubBehavior",
        storage: "CyberSubStorage"
    }
};

/** Surgery codes */
export const surgeryCodes = {
    N: "SurgHarmless",
    M: "SurgNegligible",
    MA: "SurgMinor",
    CR: "SurgMajor",
    CRP: "SurgCritical"
};

/**
 * Get subtypes for a given cyberware type
 * @param {string} cyberwareType - The cyberware type (sensor, cyberlimb, implant, chipware)
 * @returns {Object} Subtypes lookup object
 */
export function getCyberwareSubtypes(cyberwareType) {
    return cyberwareSubtypes[cyberwareType] || {};
}

/**
 * Check if cyberware type can have options (slots/spaces)
 * @param {string} cyberwareType
 * @returns {boolean}
 */
export function canHaveOptions(cyberwareType) {
    return cyberwareType === "sensor" || cyberwareType === "cyberlimb";
}

/**
 * Check if cyberware type can be a weapon
 * @param {string} cyberwareType
 * @param {boolean} isOption
 * @returns {boolean}
 */
export function canBeWeapon(cyberwareType, isOption) {
    if (cyberwareType === "implant") return true;
    if ((cyberwareType === "sensor" || cyberwareType === "cyberlimb") && isOption) return true;
    return false;
}

/**
 * Check if cyberware type can be armor
 * @param {string} cyberwareType
 * @returns {boolean}
 */
export function canBeArmor(cyberwareType) {
    return cyberwareType === "implant";
}

/** Exotic weapon effects (stored only, not yet implemented in combat) */
export const exoticEffects = {
    confusion: "EffConfusion",
    poisoned: "EffPoisoned",
    tearing: "EffTearing",
    unconscious: "EffUnconscious",
    stunAt2: "EffStunAt2",
    stunAt4: "EffStunAt4",
    burning: "EffBurning",
    microwave: "EffMicrowave",
    acid: "EffAcid"
};

/**
 * Derive weapon category from stored weaponType value.
 * @param {string} weaponType - The stored weapon type (Pistol, Melee, Exotic, etc.)
 * @returns {"melee"|"ranged"|"exotic"}
 */
export function getWeaponCategory(weaponType) {
    if (weaponType === "Melee") return "melee";
    if (weaponType === "Exotic") return "exotic";
    return "ranged";
}

// --- Ammo system lookups ---

/** Weapon types that use ammunition */
export const ammoWeaponTypes = {
    pistol: "AmmoPistolSMG",
    rifle: "AmmoRifle",
    shotgun: "AmmoShotgun",
    heavy: "AmmoHeavy",
    bow: "AmmoBow",
    crossbow: "AmmoCrossbow"
};

/** Caliber options per ammo weapon type (bow/crossbow have no caliber) */
export const ammoCalibersByWeaponType = {
    pistol:   { light: "CaliberLight", medium: "CaliberMedium", heavy: "CaliberHeavy", veryHeavy: "CaliberVeryHeavy" },
    rifle:    { light: "CaliberLight", medium: "CaliberMedium", assault: "CaliberAssault", sniper: "CaliberSniper", antiMateriel: "CaliberAntiMateriel" },
    shotgun:  { light: "CaliberLight", medium: "CaliberMedium", heavy: "CaliberHeavy" },
    heavy:    { light: "CaliberLight", medium: "CaliberMedium", heavy: "CaliberHeavy", autocannon: "CaliberAutocannon" },
    bow:      { arrow: "CaliberArrow" },
    crossbow: { bolt: "CaliberBolt" }
};

/** Ammo types with localization keys */
export const ammoTypes = {
    standard: "AmmoStandard",
    armorPiercing: "AmmoArmorPiercing",
    hollowPoint: "AmmoHollowPoint",
    rubberSlug: "AmmoRubberSlug"
};

/**
 * Validity matrix: which ammo types are valid for a given weaponType + caliber.
 */
export function isAmmoTypeValid(weaponType, caliber, ammoType) {
    // Standard is always valid
    if (ammoType === "standard") return true;

    // Bow / Crossbow: standard, AP, rubber slug
    if (weaponType === "bow" || weaponType === "crossbow") {
        return ammoType === "armorPiercing" || ammoType === "rubberSlug";
    }

    // Shotgun: standard, rubber slug only
    if (weaponType === "shotgun") {
        return ammoType === "rubberSlug";
    }

    // Heavy: no hollow point
    if (weaponType === "heavy" && ammoType === "hollowPoint") return false;

    // Rifle: sniper and anti-materiel have no hollow point
    if (weaponType === "rifle" && ammoType === "hollowPoint" && ["sniper", "antiMateriel"].includes(caliber)) return false;

    // Rubber slug: pistol light/medium/heavy only (beyond shotgun/bow/crossbow above)
    if (ammoType === "rubberSlug") {
        return weaponType === "pistol" && ["light", "medium", "heavy"].includes(caliber);
    }

    // All other combinations valid (pistol AP/HP, rifle AP/HP, heavy AP)
    return true;
}

/**
 * Maps a weapon's weaponType (from weaponTypes lookup) to the ammo weaponType key.
 * Returns null for weapon types that don't use ammo (Melee, Exotic).
 */
export const weaponToAmmoType = {
    "Pistol": "pistol",
    "SMG": "pistol",
    "Shotgun": "shotgun",
    "Rifle": "rifle",
    "Heavy": "heavy",
    "Bow": "bow",
    "Crossbow": "crossbow",
    "Melee": null,
    "Exotic": null
};

/**
 * Get attack skills for a weapon type from settings
 * @param {string} weaponType - The weapon type (Pistol, SMG, etc.)
 * @returns {string[]} Array of skill names
 */
export function getAttackSkillsForWeapon(weaponType) {
    // Exotic weapons get all ranged + melee attack skills (excluding unarmed)
    if (weaponType === "Exotic") {
        const UNARMED_SKILLS = ["Brawling"];
        const allSkills = new Set();
        for (const [wType, skills] of Object.entries(DEFAULT_ATTACK_SKILLS)) {
            if (wType === "Exotic") continue;
            for (const s of skills) {
                if (!UNARMED_SKILLS.includes(s)) allSkills.add(s);
            }
        }
        try {
            const mappings = game.settings.get("cp2020", "skillMappings");
            for (const category of Object.values(mappings)) {
                if (category?.skills?.length) {
                    for (const s of category.skills) allSkills.add(s.name);
                }
            }
        } catch (e) { /* settings not yet initialized */ }
        return [...allSkills].sort();
    }

    const categoryKey = WEAPON_TYPE_TO_CATEGORY[weaponType];
    if (!categoryKey) return DEFAULT_ATTACK_SKILLS[weaponType] || [];

    try {
        const mappings = game.settings.get("cp2020", "skillMappings");
        const category = mappings[categoryKey];
        if (category?.skills?.length) {
            return category.skills.map(s => s.name);
        }
    } catch (e) {
        // Settings not yet initialized, use defaults
        console.warn("Skill mappings not available, using defaults");
    }

    return DEFAULT_ATTACK_SKILLS[weaponType] || [];
}

/**
 * Get attack skills for ordnance items.
 * Aggregates Throw + all ranged weapon skills from settings.
 * @returns {string[]} Array of skill names
 */
export function getAttackSkillsForOrdnance() {
    const skills = new Set();

    // Add Throw category
    try {
        const mappings = game.settings.get("cp2020", "skillMappings");
        const throwCat = mappings["throw"];
        if (throwCat?.skills?.length) {
            for (const s of throwCat.skills) skills.add(s.name);
        }
        // Add all ranged weapon categories
        const rangedCategories = ["pistols", "rifles", "shotguns", "submachineGuns", "heavyWeapons", "bows", "crossbows"];
        for (const catKey of rangedCategories) {
            const cat = mappings[catKey];
            if (cat?.skills?.length) {
                for (const s of cat.skills) skills.add(s.name);
            }
        }
    } catch (e) { /* settings not yet initialized */ }

    // Fallback: if nothing from settings, use defaults
    if (skills.size === 0) {
        for (const [wType, wSkills] of Object.entries(DEFAULT_ATTACK_SKILLS)) {
            if (wType !== "Melee" && wType !== "Exotic") {
                for (const s of wSkills) skills.add(s);
            }
        }
    }

    return [...skills].sort();
}

/**
 * Get skills for a specific mapping category
 * @param {string} categoryKey - The category key (defenceSkills, escapeSkills, etc.)
 * @returns {string[]} Array of skill names
 */
export function getSkillsForCategory(categoryKey) {
    try {
        const mappings = game.settings.get("cp2020", "skillMappings");
        const category = mappings[categoryKey];
        if (category?.skills?.length) {
            return category.skills.map(s => s.name);
        }
    } catch (e) {
        console.warn(`Could not get skills for category ${categoryKey}`);
    }
    return [];
}

// For backward compatibility - dynamic proxy that reads from settings
export let attackSkills = new Proxy(DEFAULT_ATTACK_SKILLS, {
    get(target, prop) {
        if (typeof prop === "string" && prop in target) {
            return getAttackSkillsForWeapon(prop);
        }
        return target[prop];
    }
})

export function getStatNames() {
  // v13+
  const docTypes = game?.system?.documentTypes?.Actor;
  if (docTypes) {
    // Format: { character: { stats: { int:{}, ref:{}, … } } }
    if (docTypes.character?.stats)
      return Object.keys(docTypes.character.stats);

    // Fallback: support legacy "templates" subnode
    if (docTypes.templates?.stats?.stats)
      return Object.keys(docTypes.templates.stats.stats);
  }

  // v11–v12
  const tpl = CONFIG?.Actor?.template;
  if (tpl?.templates?.stats?.stats)
    return Object.keys(tpl.templates.stats.stats);

  if (tpl?.character?.stats)
    return Object.keys(tpl.character.stats);

  // Fallback
  return ["int", "ref", "tech", "cool", "attr", "luck", "ma", "bt", "emp"];
}

// How a weapon attacks. Something like pistol or an SMG have rigid rules on how they can attack, but shotguns can be regular or auto shotgun, exotic can be laser, etc. So this is for weird and special stuff that isn't necessarily covered by the weapon's type or other information
// If we change attack type to be an array, we could say, have ["BEAM" "LASER"]
export let rangedAttackTypes = {
    auto: "Auto",
    // Strange ranged weapons
    paint: "Paint",
    drugs: "Drugs",
    acid: "Acid",
    taser: "Taser",
    dart: "Dart",
    squirt: "Squirt",
    throwable: "Throw",
    archer: "Archer",
    // Beam weapons
    laser: "Laser",
    microwave: "Microwave",
    // Area effect weapons
    shotgun: "Shotgun",
    autoshotgun: "Autoshotgun",
    grenade: "Grenade", // Separate entry from throwable because grenades have different throw distance
    gas: "Gas",
    flamethrow: "Flamethrow",
    landmine: "Landmine",
    claymore: "Claymore",
    rpg: "RPG", // Fired same as with other grenade launchers or shoulder mounts, so not sure if should be here,
    missile: "Missile",
    explosiveCharge: "Explocharge"
}

export let meleeAttackTypes = {
    melee: "Melee", // Regular melee bonk
    mono: "Mono", // Monokatanas, etc
    martial: "Martial", // Martial arts! Here, the chosen attack skill does not matter
    cyberbeast: "Beast"
}

// There's a lot of these, so here's a sorted one for convenience 
export let sortedAttackTypes = Object.values(rangedAttackTypes).concat(Object.values(meleeAttackTypes)).sort();

export let concealability = {
    hidden: "ConcealHidden",
    pocket: "ConcealPocket",
    jacket: "ConcealJacket",
    longcoat: "ConcealLongcoat",
    noHide: "ConcealNoHide"
}

export let availability = {
    common: "Common",
    limited: "Limited",
    exclusive: "Exclusive",
    iconic: "Iconic"
}

export let reliability = {
    very: "VeryReliable",
    standard: "Standard",
    unreliable: "Unreliable"
}

export let fireModes = {
    fullAuto: "FullAuto",
    threeRoundBurst: "ThreeRoundBurst",
    suppressive: "Suppressive",
    // Single shot is any non-auto fire with RoF of 1 or more
    singleShot: "SingleShot"
}

export let martialActions = {
    dodge: "Dodge",
    blockParry: "BlockParry",
    strike: "Strike",
    kick: "Kick",
    disarm: "Disarm",
    sweepTrip: "SweepTrip",
    grapple: "Grapple",
    hold: "Hold",
    choke: "Choke",
    throw: "Throw",
    escape: "Escape"
}

// Be warned that the localisations of these take a range parameter
export let ranges = {
    pointBlank: "RangePointBlank",
    close: "RangeClose",
    medium: "RangeMedium",
    long: "RangeLong",
    extreme: "RangeExtreme"
}
let rangeDCs = {}
rangeDCs[ranges.pointBlank] = 10;
rangeDCs[ranges.close] = 15;
rangeDCs[ranges.medium] = 20;
rangeDCs[ranges.long] = 25;
rangeDCs[ranges.extreme] = 30;
let rangeResolve = {};
rangeResolve[ranges.pointBlank] = range => 1;
rangeResolve[ranges.close] = range => range/4;
rangeResolve[ranges.medium] = range => range/2;
rangeResolve[ranges.long] = range => range;
rangeResolve[ranges.extreme] = range => range*2;
export { rangeDCs, rangeResolve }

export let defaultTargetLocations = ["Head", "Torso", "lArm", "rArm", "lLeg", "rLeg"]
export let defaultAreaLookup = {
    1: "Head",
    2: "Torso",
    3: "Torso",
    4: "Torso",
    5: "rArm",
    6: "lArm",
    7: "lLeg",
    8: "lLeg",
    9: "rLeg",
    10: "rLeg"
}

export function defaultHitLocations() {
  const actorDocs = game?.system?.documentTypes?.Actor;

  const tpl = actorDocs?.templates?.hitLocations?.hitLocations;
  if (tpl) return tpl;

  const chr = actorDocs?.character?.hitLocations;
  if (chr) return chr;

  return {
    Head: { location: [1], stoppingPower: 0, ablation: 0},
    Torso: { location: [2, 4], stoppingPower: 0, ablation: 0},
    lArm: { location: [6], stoppingPower: 0, ablation: 0},
    rArm: { location: [5], stoppingPower: 0, ablation: 0},
    lLeg: { location: [7, 8], stoppingPower: 0, ablation: 0},
    rLeg: { location: [9, 10], stoppingPower: 0, ablation: 0}
  };
}

export function rangedModifiers(weapon, targetTokens=[]) {
    let range = weapon.system.range || 50;
    let fireModes = weapon.__getFireModes() || [];
    return [
        [{
            localKey: "FireMode",
            dataPath: "fireMode",
            choices: fireModes,
            defaultValue: fireModes[0]
        },
        {
            localKey: "Range", 
            dataPath: "range", 
            defaultValue: "RangeClose",
            choices: [
                {value:"RangePointBlank", localData: {range: 1}},
                {value:"RangeClose", localData: {range: range/4}},
                {value:"RangeMedium", localData: {range: range/2}},
                {value:"RangeLong", localData: {range: range}},
                {value:"RangeExtreme", localData: {range: range*2}}
            ]
        }],
        [{
            localKey: "Aiming",
            dataPath: "aimRounds",
            defaultValue: 0,
            choices: [0,1,2,3].map(x => {
                return { value: x, localKey: "Rounds", localData: {rounds: x}}
            }),
        },
        {
            localKey: "TargetArea",
            dataPath: "targetArea",
            defaultValue: "",
            // TODO: Have this dependent on target
            choices: defaultTargetLocations,
            allowBlank: true
        },
        {localKey:"Ambush", dataPath:"ambush",defaultValue: false},
        {localKey:"Blinded", dataPath:"blinded",defaultValue: false},
        {localKey:"DualWield", dataPath:"dualWield",defaultValue: false},
        {localKey:"FastDraw", dataPath:"fastDraw",defaultValue: false},
        {localKey:"Hipfire", dataPath:"hipfire",defaultValue: false},
        {localKey:"Ricochet", dataPath:"ricochet",defaultValue: false},
        {localKey:"Running", dataPath:"running",defaultValue: false},
        {localKey:"TurnFace", dataPath:"turningToFace",defaultValue: false},
        {localKey:"FireZoneWidth",  dataPath:"zoneWidth",  dtype:"Number", defaultValue: 2},
        {localKey:"RoundsFiredLbl", dataPath:"roundsFired", dtype:"Number", defaultValue: weapon.system.rof},
        {
            localKey: "TargetsCount",
            dataPath:"targetsCount",
            dtype:"Number",
            defaultValue: Math.max(1, targetTokens.length)
        },
        ]
    ];
}

export function martialOptions(actor) {
    return [
        [{
            localKey: "Action",
            dataPath: "action",
            choices: [
                {groupName: "Defensive", choices: [
                    "Dodge",
                    "BlockParry"
                ]},
                {groupName: "Attacks", choices: [
                    "Strike",
                    "Kick",
                    "Disarm",
                    "SweepTrip"
                ]},
                {groupName: "Grapple", choices: [
                    "Grapple",
                    "Hold",
                    "Choke",
                    "Throw",
                    "Escape"
                ]}
            ]
        },
        {
            localKey: "MartialArt",
            dataPath: "martialArt",
            choices: [{value: game.i18n.localize("CYBERPUNK.SkillBrawling"), localKey: "SkillBrawling"}, ...(actor.trainedMartials().map(martialName => {
                return {value: martialName, localKey: "Skill" + getMartialKeyByName(martialName)}
            }))]
        },
        {
            localKey: "CyberTerminus",
            dataPath: "cyberTerminus",
            defaultValue: "NoCyberlimb",
            choices: [
                { value: "NoCyberlimb", localKey: "NoCyberlimb" },
                { value: "CyberTerminusX2", localKey: "CyberTerminusX2" },
                { value: "CyberTerminusX3", localKey: "CyberTerminusX3" }
            ]
        }
    ]]
}

// Needs to be a function, or every time the modifiers dialog is launched, it'll add "extra mods" on
export function meleeBonkOptions() {
    return [[
        {
            localKey: "TargetArea",
            dataPath: "targetArea",
            defaultValue: "",
            // TODO: Have this dependent on target
            choices: defaultTargetLocations,
            allowBlank: true
        },
        {
            localKey: "CyberTerminus",
            dataPath: "cyberTerminus",
            defaultValue: "NoCyberlimb",
            choices: [
                { value: "NoCyberlimb", localKey: "NoCyberlimb" },
                { value: "CyberTerminusX2", localKey: "CyberTerminusX2" },
                { value: "CyberTerminusX3", localKey: "CyberTerminusX3" }
            ]
        }
    ]]
}

/**
 * Get a body type modifier from the body type stat (body)
 * I couldn't figure out a single formula that'd work for it (cos of the weird widths of BT values)
 */
export function btmFromBT(body) {
    if(body <= 2) {
        return 0;
      }
      switch(body) {
        // Very weak
        case 2: return 0
        // Weak
        case 3: 
        case 4: return 1
        // Average
        case 5:
        case 6:
        case 7: return 2;
        // Strong
        case 8:
        case 9: return 3;
        // Very strong
        case 10: return 4;
        default: return 5;
      }
}

export function strengthDamageBonus(bt) {
    let btm = btmFromBT(bt);
    if(btm < 5)
        return btm - 2;

    switch(bt) {
        case 11:
        case 12: return 4 
        case 13:
        case 14: return 5
        default: return 8
    }
}