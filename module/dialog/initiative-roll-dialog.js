import { localize } from "../utils.js";

/**
 * Initiative Roll Dialog — select Fast Draw and Luck before rolling initiative.
 */
export class InitiativeRollDialog extends Application {

  /**
   * @param {Actor} actor        The owning actor
   * @param {Combatant} combatant The combatant in combat
   * @param {Combat} combat      The combat encounter
   * @param {Function} callback  Callback to execute the roll with options
   */
  constructor(actor, combatant, combat, callback) {
    super();
    this.actor = actor;
    this.combatant = combatant;
    this.combat = combat;
    this.callback = callback;

    // Fast Draw toggle
    this._fastDraw = false;

    // Luck spending
    this._luckToSpend = 0;
    this._availableLuck = actor.system.stats.luck?.effective ??
                          actor.system.stats.luck?.total ?? 0;

    // Track if roll was executed (vs cancelled)
    this._rolled = false;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "initiative-roll-dialog",
      classes: ["cp2020", "initiative-roll-dialog"],
      template: "systems/cp2020/templates/dialog/initiative-roll.hbs",
      width: 300,
      height: "auto",
      popOut: true,
      minimizable: false,
      resizable: false
    });
  }

  /** @override */
  get title() {
    return localize("InitiativeRoll");
  }

  /** @override */
  getData() {
    return {
      title: localize("InitiativeRoll"),
      fastDraw: this._fastDraw,
      luckToSpend: this._luckToSpend,
      availableLuck: this._availableLuck,
      canIncreaseLuck: this._luckToSpend < this._availableLuck,
      canDecreaseLuck: this._luckToSpend > 0,
      hasAnyLuck: this._availableLuck > 0
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

    // Fast Draw toggle button
    html.find('.condition-btn[data-condition="fast-draw"]').click(ev => {
      this._fastDraw = !this._fastDraw;
      ev.currentTarget.classList.toggle('selected', this._fastDraw);
    });

    // Luck plus button
    html.find('.luck-plus-btn').click(() => {
      if (this._luckToSpend < this._availableLuck) {
        this._luckToSpend++;
        this._updateLuckDisplay(html);
      }
    });

    // Luck minus button
    html.find('.luck-minus-btn').click(() => {
      if (this._luckToSpend > 0) {
        this._luckToSpend--;
        this._updateLuckDisplay(html);
      }
    });

    // Roll button
    html.find('.roll-btn').click(() => {
      this._executeRoll();
    });
  }

  /**
   * Update the luck display and button states
   * @param {jQuery} html - The dialog HTML element
   */
  _updateLuckDisplay(html) {
    html.find('.luck-value').text(this._luckToSpend);

    const minusDisabled = this._luckToSpend <= 0;
    const plusDisabled = this._luckToSpend >= this._availableLuck;

    html.find('.luck-minus-btn').toggleClass('disabled', minusDisabled);
    html.find('.luck-plus-btn').toggleClass('disabled', plusDisabled);

    // Swap icons based on disabled state
    html.find('.luck-minus-btn img').attr('src',
      `systems/cp2020/img/chat/${minusDisabled ? 'minus-disabled' : 'minus'}.svg`);
    html.find('.luck-plus-btn img').attr('src',
      `systems/cp2020/img/chat/${plusDisabled ? 'plus-disabled' : 'plus'}.svg`);
  }

  /**
   * Execute roll with selected options
   */
  async _executeRoll() {
    // Apply Fast Draw condition if selected
    if (this._fastDraw) {
      await this.actor.toggleStatusEffect("fast-draw", { active: true });
    }

    // Spend luck if any was used
    if (this._luckToSpend > 0) {
      const currentSpent = this.actor.system.stats.luck.spent || 0;
      const currentSpentAt = this.actor.system.stats.luck.spentAt;
      await this.actor.update({
        "system.stats.luck.spent": currentSpent + this._luckToSpend,
        "system.stats.luck.spentAt": currentSpentAt || Date.now()
      });
    }

    this._rolled = true;
    this.close();

    // Execute the callback with the luck modifier
    if (this.callback) {
      this.callback(this._luckToSpend);
    }
  }

  /**
   * Static method to show the dialog and return a Promise
   * @param {Actor} actor
   * @param {Combatant} combatant
   * @param {Combat} combat
   * @returns {Promise<number|null>} Resolves with luck modifier, or null if cancelled
   */
  static async show(actor, combatant, combat) {
    return new Promise((resolve) => {
      const dialog = new InitiativeRollDialog(actor, combatant, combat, (luckMod) => {
        resolve(luckMod);
      });
      dialog.render(true);

      // Override close to handle cancellation
      const originalClose = dialog.close.bind(dialog);
      dialog.close = async (options) => {
        if (!dialog._rolled) {
          resolve(null); // Cancelled
        }
        return originalClose(options);
      };
    });
  }
}
