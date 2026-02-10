import { localize } from "../utils.js";

/**
 * Melee Attack Dialog — streamlined dialog for melee weapon strikes.
 * Shows a Strike section with a Coup De Grace / Knockout toggle,
 * Conditions, Location targeting, and Luck controls.
 */
export class MeleeAttackDialog extends Application {

  /**
   * @param {Actor} actor        The owning actor
   * @param {Item}  weapon       The weapon item
   * @param {Array} targetTokens Array of target token data
   */
  constructor(actor, weapon, targetTokens = []) {
    super();
    this.actor = actor;
    this.weapon = weapon;
    this.targetTokens = targetTokens;

    // Execute toggle (Coup De Grace / Knockout)
    this._executeSelected = false;

    // Condition toggles
    this._conditions = {
      prepared: false,
      ambush: false,
      distracted: false,
      indirect: false
    };

    // Location targeting
    this._selectedLocation = null;

    // Luck spending
    this._luckToSpend = 0;
    this._availableLuck = actor.system.stats.luck?.effective ?? actor.system.stats.luck?.total ?? 0;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "melee-attack-dialog",
      classes: ["cp2020", "melee-attack-dialog"],
      template: "systems/cp2020/templates/dialog/melee-attack.hbs",
      width: 300,
      height: "auto",
      popOut: true,
      minimizable: false,
      resizable: false
    });
  }

  /** @override */
  getData() {
    const damageType = this.weapon.system.damageType || "blunt";
    const isEdged = ["edged", "spike", "monoblade"].includes(damageType);
    const executeLabel = isEdged ? localize("CoupDeGrace") : localize("Knockout");
    const executeCondition = isEdged ? "coupDeGrace" : "knockout";

    return {
      weaponName: this.weapon.name,
      executeLabel,
      executeCondition,
      executeSelected: this._executeSelected,
      // Luck data
      luckToSpend: this._luckToSpend,
      availableLuck: this._availableLuck,
      canIncreaseLuck: this._luckToSpend < this._availableLuck && !this._executeSelected,
      canDecreaseLuck: this._luckToSpend > 0 && !this._executeSelected,
      hasAnyLuck: this._availableLuck > 0,
      luckDisabled: this._executeSelected || this._availableLuck <= 0
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

    // Execute toggle button (Coup De Grace / Knockout)
    html.find('.execute-btn').click(ev => {
      this._executeSelected = !this._executeSelected;
      ev.currentTarget.classList.toggle('selected', this._executeSelected);

      if (this._executeSelected) {
        // Reset all selections and disable controls
        this._luckToSpend = 0;
        this._updateLuckDisplay(html);
        html.find('.luck-controls').addClass('disabled');

        // Reset and disable conditions
        for (const key of Object.keys(this._conditions)) {
          this._conditions[key] = false;
        }
        html.find('.condition-btn').removeClass('selected');
        html.find('.conditions-grid').addClass('disabled');

        // Reset and disable location
        this._selectedLocation = null;
        html.find('.location-btn').removeClass('selected');
        html.find('.location-grid').addClass('disabled');
        html.find('.location-btn').each((i, btn) => {
          const loc = btn.dataset.location;
          $(btn).find('img').attr('src', `systems/cp2020/img/chat/${loc}-disabled.svg`);
        });
      } else {
        // Re-enable all controls
        html.find('.luck-controls').toggleClass('disabled', this._availableLuck <= 0);
        this._updateLuckDisplay(html);
        html.find('.conditions-grid').removeClass('disabled');
        html.find('.location-grid').removeClass('disabled');
        html.find('.location-btn').each((i, btn) => {
          const loc = btn.dataset.location;
          $(btn).find('img').attr('src', `systems/cp2020/img/chat/${loc}.svg`);
        });
      }
    });

    // Condition button toggles
    html.find('.condition-btn').click(ev => {
      if (this._executeSelected) return;
      const btn = ev.currentTarget;
      const condition = btn.dataset.condition;
      this._conditions[condition] = !this._conditions[condition];
      btn.classList.toggle('selected', this._conditions[condition]);
    });

    // Location button selection
    html.find('.location-btn').click(ev => {
      if (this._executeSelected) return;
      const btn = ev.currentTarget;
      const location = btn.dataset.location;

      // Toggle selection - clicking same location deselects it
      if (this._selectedLocation === location) {
        this._selectedLocation = null;
        btn.classList.remove('selected');
      } else {
        // Deselect previous
        html.find('.location-btn').removeClass('selected');
        // Select new
        this._selectedLocation = location;
        btn.classList.add('selected');
      }
    });

    // Luck plus button
    html.find('.luck-plus-btn').click(() => {
      if (!this._executeSelected && this._luckToSpend < this._availableLuck) {
        this._luckToSpend++;
        this._updateLuckDisplay(html);
      }
    });

    // Luck minus button
    html.find('.luck-minus-btn').click(() => {
      if (!this._executeSelected && this._luckToSpend > 0) {
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

    const minusDisabled = this._executeSelected || this._luckToSpend <= 0;
    const plusDisabled = this._executeSelected || this._luckToSpend >= this._availableLuck;

    html.find('.luck-minus-btn').toggleClass('disabled', minusDisabled);
    html.find('.luck-plus-btn').toggleClass('disabled', plusDisabled);

    // Swap icons based on disabled state
    html.find('.luck-minus-btn img').attr('src', `systems/cp2020/img/chat/${minusDisabled ? 'minus-disabled' : 'minus'}.svg`);
    html.find('.luck-plus-btn img').attr('src', `systems/cp2020/img/chat/${plusDisabled ? 'plus-disabled' : 'plus'}.svg`);
  }

  /**
   * Execute the melee action — either an execute (CdG/Knockout) or a normal strike
   */
  async _executeRoll() {
    const damageType = this.weapon.system.damageType || "blunt";
    const isEdged = ["edged", "spike", "monoblade"].includes(damageType);

    if (this._executeSelected) {
      // === EXECUTE PATH (Coup De Grace / Knockout) ===
      const conditionId = isEdged ? "coupDeGrace" : "knockout";
      const effectLabel = isEdged ? localize("CoupDeGrace") : localize("Knockout");
      const effectIcon = isEdged ? "dead" : "unconscious";

      const templateData = {
        weaponName: this.weapon.name,
        weaponImage: this.weapon.img,
        weaponType: this.weapon.system.attackType,
        effectLabel,
        effectIcon,
        conditionId
      };

      const content = await renderTemplate(
        "systems/cp2020/templates/chat/melee-execute.hbs",
        templateData
      );

      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content
      });

      this.close();
    } else {
      // === NORMAL STRIKE PATH ===
      // Spend luck if any was used
      if (this._luckToSpend > 0) {
        const currentSpent = this.actor.system.stats.luck.spent || 0;
        const currentSpentAt = this.actor.system.stats.luck.spentAt;
        this.actor.update({
          "system.stats.luck.spent": currentSpent + this._luckToSpend,
          "system.stats.luck.spentAt": currentSpentAt || Date.now()
        });
      }

      const attackMods = {
        extraMod: (this._conditions.prepared ? 2 : 0)
                + (this._conditions.ambush ? 5 : 0)
                + (this._conditions.distracted ? -2 : 0)
                + (this._conditions.indirect ? -5 : 0)
                + (this._selectedLocation ? -4 : 0)
                + this._luckToSpend,
        cyberTerminus: "NoCyberlimb",
        targetArea: this._selectedLocation || ""
      };

      this.close();
      this.weapon.__weaponRoll(attackMods, this.targetTokens);
    }
  }
}
