import { SkillMappingConfig } from "./settings/skill-mapping-config.js";
import { DEFAULT_SKILL_MAPPINGS } from "./settings/skill-mapping-defaults.js";

/**
 * Reconcile saved skill mappings with current defaults.
 * Adds new categories, removes obsolete ones.
 * Should be called once on "ready" by the GM.
 */
export function migrateSkillMappings() {
  const saved = game.settings.get("cp2020", "skillMappings");
  const defaults = DEFAULT_SKILL_MAPPINGS;

  // Rebuild in the order defined by defaults, preserving saved skill assignments
  const migrated = {};
  let changed = false;

  for (const key of Object.keys(defaults)) {
    if (key in saved) {
      migrated[key] = saved[key];
    } else {
      migrated[key] = foundry.utils.deepClone(defaults[key]);
      changed = true;
    }
  }

  // Detect removed categories
  for (const key of Object.keys(saved)) {
    if (!(key in defaults)) {
      changed = true;
    }
  }

  // Also detect order changes
  const savedKeys = Object.keys(saved).filter(k => k in defaults);
  const defaultKeys = Object.keys(defaults);
  if (!changed && savedKeys.join(",") !== defaultKeys.join(",")) {
    changed = true;
  }

  if (changed) {
    game.settings.set("cp2020", "skillMappings", migrated);
    console.log("CYBERPUNK: Skill mappings migrated to match current defaults.");
  }
}

export function registerSystemSettings() {
  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("cp2020", "systemMigrationVersion", {
    name: "SETTINGS.SysMigration",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  /**
   * Skill mappings data (hidden setting that stores the actual configuration)
   */
  game.settings.register("cp2020", "skillMappings", {
    name: "SETTINGS.SkillMappings",
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_SKILL_MAPPINGS
  });

  /**
   * Settings menu button to open skill mapping configuration
   */
  game.settings.registerMenu("cp2020", "skillMappingMenu", {
    name: "SETTINGS.SkillMappingMenuName",
    label: "SETTINGS.SkillMappingMenuLabel",
    hint: "SETTINGS.SkillMappingMenuHint",
    icon: "fas fa-crosshairs",
    type: SkillMappingConfig,
    restricted: true
  });
}
