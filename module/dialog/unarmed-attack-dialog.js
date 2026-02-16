import { PunchDialog } from "./punch-dialog.js";

/**
 * Unarmed Attack Dialog — select unarmed action to perform.
 * Shows different actions depending on whether the actor has the Grappling condition.
 */
export class UnarmedAttackDialog extends Application {

  /**
   * @param {Actor} actor  The acting actor
   */
  constructor(actor) {
    super();
    this.actor = actor;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "unarmed-attack-dialog",
      classes: ["cyberpunk", "ranged-attack-dialog"],
      template: "systems/cyberpunk/templates/dialog/unarmed-attack.hbs",
      width: 300,
      height: "auto",
      popOut: true,
      minimizable: false,
      resizable: false
    });
  }

  /** @override */
  getData() {
    const isGrappling = this.actor.statuses.has("grappling");
    const actions = isGrappling
      ? ["Hold", "Break", "Choke", "Crush", "Throw", "Release"]
      : ["Punch", "Kick", "Disarm", "Grapple", "Sweep", "Ram"];

    return {
      actions: actions.map(key => ({
        key,
        label: game.i18n.localize(`CYBERPUNK.${key}`)
      }))
    };
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

    // Action buttons
    html.find('.unarmed-action-btn').click(ev => {
      const action = ev.currentTarget.dataset.action;

      // Release executes immediately without opening dialog
      if (action === "Release") {
        this._executeRelease();
        this.close();
        return;
      }

      if (action === "Punch" || action === "Kick" || action === "Disarm" || action === "Sweep" || action === "Grapple" || action === "Hold" || action === "Break" || action === "Choke" || action === "Crush" || action === "Throw") {
        new PunchDialog(this.actor, { actionKey: action }).render(true);
        this.close();
      }
    });
  }

  /**
   * Execute Release action immediately - post chat message and apply effects.
   */
  async _executeRelease() {
    const { localize } = await import("../utils.js");
    const { RollBundle } = await import("../dice.js");

    // === CHAT MESSAGE ===
    const templateData = {
      actionIcon: "ref",
      fireModeLabel: localize("Release"),
      attackRoll: null,  // No attack roll for Release
      hasDamage: false,
      hasApply: true,    // Show Apply button for effect
      areaDamages: {},
      weaponName: localize("UnarmedAttack"),
      weaponImage: "systems/cyberpunk/img/ui/unarmed.svg",
      weaponType: "Melee · 1 m",
      loadedAmmoType: "standard",
      damageType: "blunt",
      weaponEffect: "release",
      hasEffect: true,
      effectIcon: "released",
      effectLabel: localize("Conditions.Released"),
      hitLocation: ""
    };

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    new RollBundle(localize("Release"))
      .execute(speaker, "systems/cyberpunk/templates/chat/melee-hit.hbs", templateData);
  }
}
