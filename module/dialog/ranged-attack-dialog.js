import { fireModes, weaponToAmmoType } from "../lookups.js";
import { RangeSelectionDialog } from "./range-selection-dialog.js";
import { ReloadDialog } from "./reload-dialog.js";

/**
 * Ranged Attack Dialog — select fire mode before opening attack modifiers.
 * Shows available fire modes based on weapon ROF and ammo status.
 */
export class RangedAttackDialog extends Application {

  /**
   * @param {Actor} actor        The owning actor
   * @param {Item}  weapon       The weapon item to fire
   * @param {Array} targetTokens Array of target token data
   */
  constructor(actor, weapon, targetTokens = []) {
    super();
    this.actor = actor;
    this.weapon = weapon;
    this.targetTokens = targetTokens;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "ranged-attack-dialog",
      classes: ["cp2020", "ranged-attack-dialog"],
      template: "systems/cp2020/templates/dialog/ranged-attack.hbs",
      width: 300,
      height: "auto",
      popOut: true,
      minimizable: false,
      resizable: false
    });
  }

  /** @override */
  getData() {
    const rof = Number(this.weapon.system.rof) || 1;
    const shotsLeft = Number(this.weapon.system.shotsLeft) || 0;
    const hasAmmo = this._hasCompatibleAmmo();

    return {
      showFullAuto: rof > 3 && shotsLeft > 3,
      showBurst: rof >= 3 && shotsLeft >= 3,
      showSingleShot: shotsLeft >= 1,
      outOfAmmo: shotsLeft < 1,
      showReload: hasAmmo
    };
  }

  /**
   * Check if the actor has compatible ammo for this weapon
   */
  _hasCompatibleAmmo() {
    const ammoWT = weaponToAmmoType[this.weapon.system.weaponType];
    const weaponCaliber = this.weapon.system.caliber || "";

    const ammoItems = (this.actor.itemTypes.ammo || []).filter(a => {
      if (a.system.weaponType !== ammoWT) return false;
      if (weaponCaliber && a.system.caliber !== weaponCaliber) return false;
      return (Number(a.system.quantity) || 0) > 0;
    });

    return ammoItems.length > 0;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Make header draggable
    const header = html.find('.reload-header')[0];
    if (header) {
      new Draggable(this, html, header, false);
    }

    // Close button
    html.find('.header-control.close').click(() => this.close());

    // Fire mode buttons
    html.find('.fire-mode-btn[data-mode]').click(ev => {
      const mode = ev.currentTarget.dataset.mode;
      this._openModifiersWithMode(mode);
    });

    // Reload button
    html.find('.reload-btn').click(() => {
      new ReloadDialog(this.actor, this.weapon).render(true);
      this.close();
    });
  }

  /**
   * Open the RangeSelectionDialog with a pre-selected fire mode
   * @param {string} fireMode - The fire mode key (fullAuto, threeRoundBurst, singleShot)
   */
  _openModifiersWithMode(fireMode) {
    new RangeSelectionDialog(
      this.actor,
      this.weapon,
      fireModes[fireMode],
      this.targetTokens
    ).render(true);
    this.close();
  }
}
