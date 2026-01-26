import { SkillMappingConfig } from "./settings/skill-mapping-config.js";
import { DEFAULT_SKILL_MAPPINGS } from "./settings/skill-mapping-defaults.js";

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
