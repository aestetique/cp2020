import { availability, ammoWeaponTypes, ammoCalibersByWeaponType, ammoTypes, isAmmoTypeValid } from "../lookups.js";
import { CyberpunkItemSheet } from "./item-sheet-base.js";

/**
 * Ammo Item Sheet with custom card design
 * @extends {CyberpunkItemSheet}
 */
export class CyberpunkAmmoSheet extends CyberpunkItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cyberpunk", "sheet", "item", "ammo-sheet"],
      template: "systems/cp2020/templates/item/ammo-sheet.hbs"
    });
  }

  /** @override */
  getData() {
    const data = super.getData();
    const wType = data.system.weaponType || "pistol";

    // Availability options for dropdown
    data.availabilityOptions = Object.entries(availability).map(([value, labelKey]) => ({
      value,
      label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
      selected: data.system.availability === value
    }));
    const selectedAvail = availability[data.system.availability] || "Common";
    data.selectedAvailabilityLabel = game.i18n.localize(`CYBERPUNK.${selectedAvail}`);

    // Weapon type options
    data.weaponTypeOptions = Object.entries(ammoWeaponTypes).map(([value, labelKey]) => ({
      value,
      label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
      selected: wType === value
    }));
    const selectedWT = ammoWeaponTypes[wType] || "AmmoPistolSMG";
    data.selectedWeaponTypeLabel = game.i18n.localize(`CYBERPUNK.${selectedWT}`);

    // Caliber options (dependent on weapon type)
    const calibers = ammoCalibersByWeaponType[wType] || {};
    data.hasCaliber = Object.keys(calibers).length > 0;
    data.caliberOptions = Object.entries(calibers).map(([value, labelKey]) => ({
      value,
      label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
      selected: data.system.caliber === value
    }));
    const selectedCal = calibers[data.system.caliber];
    data.selectedCaliberLabel = selectedCal
      ? game.i18n.localize(`CYBERPUNK.${selectedCal}`)
      : "";

    // Ammo type options (filtered by validity matrix)
    data.ammoTypeOptions = Object.entries(ammoTypes)
      .filter(([value]) => isAmmoTypeValid(wType, data.system.caliber, value))
      .map(([value, labelKey]) => ({
        value,
        label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
        selected: data.system.ammoType === value
      }));
    const selectedAT = ammoTypes[data.system.ammoType] || "AmmoStandard";
    data.selectedAmmoTypeLabel = game.i18n.localize(`CYBERPUNK.${selectedAT}`);

    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    if (this._isLocked) return;

    // When weaponType changes, reset caliber to first valid and ammoType to standard
    html.find('select[name="system.weaponType"]').change(async ev => {
      const newWT = ev.currentTarget.value;
      const calibers = ammoCalibersByWeaponType[newWT] || {};
      const caliberKeys = Object.keys(calibers);
      const newCaliber = caliberKeys.length > 0 ? caliberKeys[0] : "";
      await this.item.update({
        "system.weaponType": newWT,
        "system.caliber": newCaliber,
        "system.ammoType": "standard"
      });
    });

    // When caliber changes, validate ammoType is still valid
    html.find('select[name="system.caliber"]').change(async ev => {
      const newCaliber = ev.currentTarget.value;
      const wType = this.item.system.weaponType;
      const currentAmmoType = this.item.system.ammoType;
      const updates = { "system.caliber": newCaliber };
      if (!isAmmoTypeValid(wType, newCaliber, currentAmmoType)) {
        updates["system.ammoType"] = "standard";
      }
      await this.item.update(updates);
    });
  }
}
