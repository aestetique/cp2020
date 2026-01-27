import { getStatNames } from "../lookups.js";
import { CyberpunkItemSheet } from "./item-sheet-base.js";

/**
 * Skill Item Sheet with custom card design
 * @extends {CyberpunkItemSheet}
 */
export class CyberpunkSkillSheet extends CyberpunkItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cyberpunk", "sheet", "item", "skill-sheet"],
      template: "systems/cp2020/templates/item/skill-sheet.hbs"
    });
  }

  /** @override */
  getData() {
    const data = super.getData();

    // Get stat options for dropdown
    data.statOptions = getStatNames()
      .filter(stat => ["int", "ref", "tech", "cool", "attr", "bt", "emp"].includes(stat))
      .map(stat => ({
        value: stat,
        label: stat === "bt" ? "BODY" : stat.toUpperCase(),
        selected: data.system.stat === stat
      }));

    // Difficulty multiplier options (x1 minimum)
    data.difficultyOptions = [
      { value: 1, label: "×1", selected: Number(data.system.diffMod) === 1 },
      { value: 2, label: "×2", selected: Number(data.system.diffMod) === 2 },
      { value: 3, label: "×3", selected: Number(data.system.diffMod) === 3 }
    ];

    data.selectedStatLabel = data.system.stat === "bt" ? "BODY" : (data.system.stat?.toUpperCase() || "REF");
    data.selectedDifficultyLabel = `×${data.system.diffMod ?? 1}`;

    return data;
  }
}
