import { ammoTypes, weaponToAmmoType } from "../lookups.js";

/**
 * Reload Dialog — select ammo type to load into a weapon.
 * Shows compatible ammo items grouped by ammo type with available quantities.
 */
export class ReloadDialog extends Dialog {

  /**
   * @param {Actor} actor   The owning actor
   * @param {Item}  weapon  The weapon item to reload
   */
  constructor(actor, weapon) {
    const ammoWT = weaponToAmmoType[weapon.system.weaponType];
    const weaponCaliber = weapon.system.caliber || "";

    // Find compatible ammo on the actor
    const ammoItems = (actor.itemTypes.ammo || []).filter(a => {
      if (a.system.weaponType !== ammoWT) return false;
      // For weapon types with caliber, must match
      if (weaponCaliber && a.system.caliber !== weaponCaliber) return false;
      return (Number(a.system.quantity) || 0) > 0;
    });

    // Group by ammo type, sum quantities
    const grouped = {};
    for (const a of ammoItems) {
      const at = a.system.ammoType || "standard";
      if (!grouped[at]) {
        grouped[at] = { ammoType: at, totalQty: 0, items: [] };
      }
      grouped[at].totalQty += Number(a.system.quantity) || 0;
      grouped[at].items.push(a);
    }

    const groups = Object.values(grouped);
    const hasAmmo = groups.length > 0;

    // Build content HTML
    let content = `<div class="reload-dialog">`;
    if (!hasAmmo) {
      content += `<p class="reload-empty">${game.i18n.localize("CYBERPUNK.ReloadNoAmmo")}</p>`;
    } else {
      content += `<p class="reload-hint">${game.i18n.localize("CYBERPUNK.ReloadSelectAmmo")}</p>`;
      for (const g of groups) {
        const label = ammoTypes[g.ammoType]
          ? game.i18n.localize(`CYBERPUNK.${ammoTypes[g.ammoType]}`)
          : g.ammoType;
        const roundsLabel = game.i18n.format("CYBERPUNK.ReloadRoundsAvailable", { count: g.totalQty });
        content += `
          <div class="reload-row" data-ammo-type="${g.ammoType}">
            <span class="reload-ammo-name">${label.toUpperCase()}</span>
            <span class="reload-ammo-qty">${roundsLabel}</span>
          </div>`;
      }
    }
    content += `</div>`;

    super({
      title: game.i18n.localize("CYBERPUNK.ReloadTitle"),
      content,
      buttons: hasAmmo ? {
        apply: {
          label: game.i18n.localize("CYBERPUNK.ReloadApply"),
          callback: (html) => this._onApply(html)
        }
      } : {
        close: {
          label: game.i18n.localize("CYBERPUNK.OK")
        }
      },
      default: hasAmmo ? "apply" : "close"
    });

    this.actor = actor;
    this.weapon = weapon;
    this.groups = groups;
    this._selectedAmmoType = groups.length ? groups[0].ammoType : null;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Highlight first row by default
    if (this._selectedAmmoType) {
      html.find(`.reload-row[data-ammo-type="${this._selectedAmmoType}"]`).addClass("selected");
    }

    // Row selection
    html.find('.reload-row').click(ev => {
      html.find('.reload-row').removeClass('selected');
      const row = ev.currentTarget;
      row.classList.add('selected');
      this._selectedAmmoType = row.dataset.ammoType;
    });
  }

  /**
   * Apply the reload: set weapon shots, loadedAmmoType, deduct ammo from actor items.
   */
  async _onApply(html) {
    if (!this._selectedAmmoType) return;

    const group = this.groups.find(g => g.ammoType === this._selectedAmmoType);
    if (!group) return;

    const maxShots = Number(this.weapon.system.shots) || 0;
    const available = group.totalQty;
    const loadCount = Math.min(maxShots, available);
    let roundsNeeded = loadCount;

    // Update weapon — load only what's available
    await this.actor.updateEmbeddedDocuments("Item", [{
      _id: this.weapon.id,
      "system.shotsLeft": loadCount,
      "system.loadedAmmoType": this._selectedAmmoType
    }]);

    // Deduct rounds from ammo items (oldest first — use array order)
    const updates = [];
    const deletes = [];

    for (const ammoItem of group.items) {
      if (roundsNeeded <= 0) break;
      const qty = Number(ammoItem.system.quantity) || 0;
      const deduct = Math.min(qty, roundsNeeded);
      const remaining = qty - deduct;
      roundsNeeded -= deduct;

      if (remaining <= 0) {
        deletes.push(ammoItem.id);
      } else {
        updates.push({ _id: ammoItem.id, "system.quantity": remaining });
      }
    }

    if (updates.length) {
      await this.actor.updateEmbeddedDocuments("Item", updates);
    }
    if (deletes.length) {
      await this.actor.deleteEmbeddedDocuments("Item", deletes);
    }
  }
}
