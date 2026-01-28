/**
 * Default skill mappings for the Cyberpunk 2020 system.
 * All categories start empty - users must configure their own mappings.
 *
 * Structure:
 * {
 *   categoryKey: {
 *     labelKey: "SETTINGS.CategoryLabel",
 *     skills: []
 *   }
 * }
 */
export const DEFAULT_SKILL_MAPPINGS = {
  pistols: {
    labelKey: "SETTINGS.SkillMapPistols",
    singleSkill: true,
    skills: []
  },
  rifles: {
    labelKey: "SETTINGS.SkillMapRifles",
    singleSkill: true,
    skills: []
  },
  shotguns: {
    labelKey: "SETTINGS.SkillMapShotguns",
    singleSkill: true,
    skills: []
  },
  submachineGuns: {
    labelKey: "SETTINGS.SkillMapSMGs",
    singleSkill: true,
    skills: []
  },
  heavyWeapons: {
    labelKey: "SETTINGS.SkillMapHeavy",
    singleSkill: true,
    skills: []
  },
  throw: {
    labelKey: "SETTINGS.SkillMapThrow",
    singleSkill: true,
    skills: []
  },
  bows: {
    labelKey: "SETTINGS.SkillMapBows",
    singleSkill: true,
    skills: []
  },
  crossbows: {
    labelKey: "SETTINGS.SkillMapCrossbows",
    singleSkill: true,
    skills: []
  },
  meleeAttacks: {
    labelKey: "SETTINGS.SkillMapMelee",
    skills: []
  },
  unarmedAttacks: {
    labelKey: "SETTINGS.SkillMapUnarmed",
    skills: []
  },
  escapeSkills: {
    labelKey: "SETTINGS.SkillMapEscape",
    skills: []
  },
  stabilisationSkills: {
    labelKey: "SETTINGS.SkillMapStabilisation",
    skills: []
  }
};

/**
 * Maps weapon types from lookups.js to skill mapping categories.
 */
export const WEAPON_TYPE_TO_CATEGORY = {
  "Pistol": "pistols",
  "SMG": "submachineGuns",
  "Shotgun": "shotguns",
  "Rifle": "rifles",
  "Heavy": "heavyWeapons",
  "Bow": "bows",
  "Crossbow": "crossbows",
  "Melee": "meleeAttacks",
  "Exotic": null
};
