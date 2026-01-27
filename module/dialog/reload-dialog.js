import { ammoTypes, ammoWeaponTypes, ammoCalibersByWeaponType, weaponToAmmoType } from "../lookups.js";

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

    // --- Unload remaining rounds if switching ammo type ---
    const oldAmmoType = this.weapon.system.loadedAmmoType || "standard";
    const remainingRounds = Number(this.weapon.system.shotsLeft) || 0;
    const oldSources = Array.isArray(this.weapon.system.loadedAmmoSources)
      ? this.weapon.system.loadedAmmoSources.map(s => ({ ...s }))
      : [];

    if (remainingRounds > 0 && oldAmmoType !== this._selectedAmmoType && oldSources.length > 0) {
      // Randomly subtract fired rounds across sources
      const totalLoaded = oldSources.reduce((sum, s) => sum + s.count, 0);
      let firedLeft = totalLoaded - remainingRounds;

      while (firedLeft > 0) {
        // Pick a random source that still has rounds
        const available = oldSources.filter(s => s.count > 0);
        if (available.length === 0) break;
        const pick = available[Math.floor(Math.random() * available.length)];
        pick.count--;
        firedLeft--;
      }

      // Return each source's remaining rounds to inventory
      for (const source of oldSources) {
        if (source.count <= 0) continue;
        await this._returnAmmoToSource(source.sourceUuid, source.count, oldAmmoType);
      }
    } else if (remainingRounds > 0 && oldAmmoType !== this._selectedAmmoType) {
      // Legacy weapon with no sources — generic fallback
      await this._createGenericAmmo(oldAmmoType, remainingRounds);
    }

    // --- Load new ammo ---
    const maxShots = Number(this.weapon.system.shots) || 0;
    const available = group.totalQty;
    const loadCount = Math.min(maxShots, available);
    let roundsNeeded = loadCount;

    // Deduct rounds and build sources array
    const sources = [];
    const updates = [];
    const deletes = [];

    for (const ammoItem of group.items) {
      if (roundsNeeded <= 0) break;
      const qty = Number(ammoItem.system.quantity) || 0;
      const deduct = Math.min(qty, roundsNeeded);
      const remaining = qty - deduct;
      roundsNeeded -= deduct;

      if (deduct > 0) {
        sources.push({ sourceUuid: ammoItem.system.sourceUuid || "", count: deduct });
      }

      if (remaining <= 0) {
        deletes.push(ammoItem.id);
      } else {
        updates.push({ _id: ammoItem.id, "system.quantity": remaining });
      }
    }

    // Update weapon with loaded rounds and sources
    await this.actor.updateEmbeddedDocuments("Item", [{
      _id: this.weapon.id,
      "system.shotsLeft": loadCount,
      "system.loadedAmmoType": this._selectedAmmoType,
      "system.loadedAmmoSources": sources
    }]);

    if (updates.length) {
      await this.actor.updateEmbeddedDocuments("Item", updates);
    }
    if (deletes.length) {
      await this.actor.deleteEmbeddedDocuments("Item", deletes);
    }
  }

  /**
   * Return rounds to an ammo source using the 3-tier fallback:
   * 1. Find actor ammo with matching sourceUuid → stack
   * 2. Clone from game item via fromUuid → create on actor
   * 3. Create/stack generic ammo (last resort)
   */
  async _returnAmmoToSource(sourceUuid, quantity, ammoType) {
    // 1. Find actor ammo from the same source
    if (sourceUuid) {
      const actorMatch = this.actor.items.find(i =>
        i.type === "ammo" && i.system.sourceUuid === sourceUuid
      );
      if (actorMatch) {
        const newQty = (Number(actorMatch.system.quantity) || 0) + quantity;
        await this.actor.updateEmbeddedDocuments("Item", [{
          _id: actorMatch.id,
          "system.quantity": newQty
        }]);
        return;
      }

      // 2. Clone from the original game item
      const templateItem = await fromUuid(sourceUuid);
      if (templateItem) {
        const newData = templateItem.toObject();
        newData.system.quantity = quantity;
        newData.system.packSize = 0;
        newData.system.sourceUuid = sourceUuid;
        await this.actor.createEmbeddedDocuments("Item", [newData]);
        return;
      }
    }

    // 3. Last resort: generic ammo
    await this._createGenericAmmo(ammoType, quantity);
  }

  /**
   * Create a generic ammo item when the source game item no longer exists.
   * Name format: "[Ammo Type] [Caliber] [Weapon Subtype] Rounds"
   */
  async _createGenericAmmo(ammoType, quantity) {
    const ammoWT = weaponToAmmoType[this.weapon.system.weaponType];
    const weaponCaliber = this.weapon.system.caliber || "";

    const typeLabelKey = ammoTypes[ammoType];
    const typeLabel = typeLabelKey ? game.i18n.localize(`CYBERPUNK.${typeLabelKey}`) : ammoType;
    const calLabelKey = ammoCalibersByWeaponType[ammoWT]?.[weaponCaliber];
    const calLabel = calLabelKey ? game.i18n.localize(`CYBERPUNK.${calLabelKey}`) : "";
    const wtLabelKey = ammoWeaponTypes[ammoWT];
    const wtLabel = wtLabelKey ? game.i18n.localize(`CYBERPUNK.${wtLabelKey}`) : ammoWT;

    const nameParts = [typeLabel, calLabel, wtLabel, game.i18n.localize("CYBERPUNK.Rounds")].filter(p => p);

    // Check if a generic item (no sourceUuid) of this type already exists
    const existingGeneric = this.actor.items.find(i =>
      i.type === "ammo" &&
      !i.system.sourceUuid &&
      i.system.weaponType === ammoWT &&
      i.system.caliber === weaponCaliber &&
      (i.system.ammoType || "standard") === ammoType
    );

    if (existingGeneric) {
      const newQty = (Number(existingGeneric.system.quantity) || 0) + quantity;
      await this.actor.updateEmbeddedDocuments("Item", [{
        _id: existingGeneric.id,
        "system.quantity": newQty
      }]);
    } else {
      await this.actor.createEmbeddedDocuments("Item", [{
        name: nameParts.join(" "),
        type: "ammo",
        img: "systems/cp2020/img/items/ammo.svg",
        system: {
          weaponType: ammoWT,
          caliber: weaponCaliber,
          ammoType: ammoType,
          packSize: 0,
          quantity: quantity,
          sourceUuid: ""
        }
      }]);
    }
  }
}
