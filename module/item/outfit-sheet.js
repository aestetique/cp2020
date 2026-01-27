import { availability } from "../lookups.js";
import { CyberpunkItemSheet } from "./item-sheet-base.js";

/**
 * Outfit (Armor) Item Sheet with custom card design and tabs
 * @extends {CyberpunkItemSheet}
 */
export class CyberpunkOutfitSheet extends CyberpunkItemSheet {

  /**
   * Active tab state
   * @type {string}
   */
  _activeTab = "description";

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cyberpunk", "sheet", "item", "outfit-sheet"],
      template: "systems/cp2020/templates/item/outfit-sheet.hbs"
    });
  }

  /** @override */
  getData() {
    const data = super.getData();
    data.activeTab = this._activeTab;

    // Availability options for dropdown
    data.availabilityOptions = Object.entries(availability).map(([value, labelKey]) => ({
      value,
      label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
      selected: data.system.availability === value
    }));

    // Selected availability label for locked mode
    const selectedAvail = availability[data.system.availability] || "Common";
    data.selectedAvailabilityLabel = game.i18n.localize(`CYBERPUNK.${selectedAvail}`);

    // Armor type options
    data.armorTypeOptions = [
      { value: "soft", label: game.i18n.localize("CYBERPUNK.SoftArmor"), selected: data.system.armorType === "soft" },
      { value: "hard", label: game.i18n.localize("CYBERPUNK.HardArmor"), selected: data.system.armorType === "hard" }
    ];

    // Selected armor type label for locked mode
    data.selectedArmorTypeLabel = data.system.armorType === "hard"
      ? game.i18n.localize("CYBERPUNK.HardArmor")
      : game.i18n.localize("CYBERPUNK.SoftArmor");

    // Coverage data for the SP grid
    const locationOrder = [
      { key: "lArm", label: "Left Arm" },
      { key: "Head", label: "Head" },
      { key: "rArm", label: "Right Arm" },
      { key: "lLeg", label: "Left Leg" },
      { key: "Torso", label: "Torso" },
      { key: "rLeg", label: "Right Leg" }
    ];

    data.coverageRows = [
      locationOrder.slice(0, 3),
      locationOrder.slice(3, 6)
    ].map(row => row.map(loc => {
      const cov = data.system.coverage?.[loc.key] || { stoppingPower: 0, ablation: 0 };
      const maxSP = Number(cov.stoppingPower) || 0;
      const ablation = Number(cov.ablation) || 0;
      const currentSP = Math.max(0, maxSP - ablation);
      return {
        key: loc.key,
        label: loc.label,
        currentSP,
        maxSP,
        isDamaged: currentSP < maxSP
      };
    }));

    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Tab switching
    html.find('.tab-header').click(ev => {
      ev.preventDefault();
      const tab = ev.currentTarget.dataset.tab;
      if (tab && tab !== this._activeTab) {
        this._activeTab = tab;
        this.render(false);
      }
    });

    if (this._isLocked) return;

    // Current SP input — convert to ablation on change
    html.find('.sp-current-input').change(async ev => {
      const input = ev.currentTarget;
      const key = input.dataset.key;
      const maxSP = Number(input.dataset.max) || 0;
      const newCurrent = Math.max(0, Math.min(maxSP, Number(input.value) || 0));
      const ablation = maxSP - newCurrent;
      await this.item.update({ [`system.coverage.${key}.ablation`]: ablation });
    });
  }
}
