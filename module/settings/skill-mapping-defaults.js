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
    skills: []
  },
  rifles: {
    labelKey: "SETTINGS.SkillMapRifles",
    skills: []
  },
  shotguns: {
    labelKey: "SETTINGS.SkillMapShotguns",
    skills: []
  },
  submachineGuns: {
    labelKey: "SETTINGS.SkillMapSMGs",
    skills: []
  },
  heavyWeapons: {
    labelKey: "SETTINGS.SkillMapHeavy",
    skills: []
  },
  bows: {
    labelKey: "SETTINGS.SkillMapBows",
    skills: []
  },
  crossbows: {
    labelKey: "SETTINGS.SkillMapCrossbows",
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
  defenceSkills: {
    labelKey: "SETTINGS.SkillMapDefence",
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
  "Melee": "meleeAttacks",
  "Exotic": null
};
