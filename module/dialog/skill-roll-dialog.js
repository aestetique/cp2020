import { localize } from "../utils.js";

/**
 * Skill/Attribute Roll Dialog — select difficulty and modifiers before rolling.
 */
export class SkillRollDialog extends Application {

  /**
   * @param {Actor} actor        The owning actor
   * @param {Object} options     Configuration options
   * @param {string} options.rollType - "skill" or "stat"
   * @param {string} options.skillId  - Skill item ID (for skill rolls)
   * @param {string} options.statName - Stat key (for stat rolls)
   * @param {string} options.title    - Display title for the dialog header
   * @param {string} options.statIcon - Icon key for the section bar
   */
  constructor(actor, options = {}) {
    super();
    this.actor = actor;
    this.rollType = options.rollType || "skill";
    this.skillId = options.skillId || null;
    this.statName = options.statName || null;
    this._dialogTitle = options.title || localize("Skill");
    this.statIcon = options.statIcon || null;

    this._dropdownOpen = false;

    // Difficulty selection (default: Average / 15)
    this._selectedDifficulty = {
      key: "average",
      value: 15,
      label: localize("DifficultyAverage")
    };

    // Condition toggles (only Prepared and Distracted)
    this._conditions = {
      prepared: false,
      distracted: false
    };

    // Luck spending
    this._luckToSpend = 0;
    this._availableLuck = actor.system.stats.luck?.effective ??
                          actor.system.stats.luck?.total ?? 0;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "skill-roll-dialog",
      classes: ["cyberpunk", "skill-roll-dialog"],
      template: "systems/cyberpunk/templates/dialog/skill-roll.hbs",
      width: 300,
      height: "auto",
      popOut: true,
      minimizable: false,
      resizable: false
    });
  }

  /** @override */
  get title() {
    return this._dialogTitle;
  }

  /** @override */
  getData() {
    // Build difficulty options
    const difficultyOptions = [
      { key: "easy", value: 10, label: localize("DifficultyEasy") },
      { key: "average", value: 15, label: localize("DifficultyAverage") },
      { key: "difficult", value: 20, label: localize("DifficultyDifficult") },
      { key: "veryDifficult", value: 25, label: localize("DifficultyVeryDifficult") },
      { key: "nearlyImpossible", value: 30, label: localize("DifficultyNearlyImpossible") }
    ];

    // Mark the selected difficulty
    difficultyOptions.forEach(opt => {
      opt.selected = opt.key === this._selectedDifficulty.key;
    });

    return {
      title: this._dialogTitle,
      statIcon: this.statIcon,
      difficultyOptions,
      selectedDifficultyLabel: this._selectedDifficulty.label,
      conditions: this._conditions,
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

    // Difficulty dropdown toggle (uses same classes as range dropdown)
    html.find('.range-dropdown-btn').click(ev => {
      ev.stopPropagation();
      this._dropdownOpen = !this._dropdownOpen;
      html.find('.range-dropdown-list').toggleClass('open', this._dropdownOpen);
      html.find('.range-dropdown-btn').toggleClass('open', this._dropdownOpen);
    });

    // Difficulty option selection
    html.find('.range-option').click(ev => {
      const key = ev.currentTarget.dataset.difficulty;
      const value = Number(ev.currentTarget.dataset.value);
      const label = ev.currentTarget.textContent.trim();

      this._selectedDifficulty = { key, value, label };
      this._dropdownOpen = false;

      // Update display
      html.find('.range-dropdown-btn .range-label').text(label);
      html.find('.range-dropdown-list').removeClass('open');
      html.find('.range-dropdown-btn').removeClass('open');

      // Update visual selection
      html.find('.range-option').removeClass('selected');
      ev.currentTarget.classList.add('selected');
    });

    // Close dropdown when clicking outside
    $(document).on('click.skillRollDropdown', (ev) => {
      if (!$(ev.target).closest('.range-dropdown').length) {
        this._dropdownOpen = false;
        html.find('.range-dropdown-list').removeClass('open');
        html.find('.range-dropdown-btn').removeClass('open');
      }
    });

    // Condition button toggles
    html.find('.condition-btn').click(ev => {
      const btn = ev.currentTarget;
      const condition = btn.dataset.condition;
      this._conditions[condition] = !this._conditions[condition];
      btn.classList.toggle('selected', this._conditions[condition]);
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
      `systems/cyberpunk/img/chat/${minusDisabled ? 'minus-disabled' : 'minus'}.svg`);
    html.find('.luck-plus-btn img').attr('src',
      `systems/cyberpunk/img/chat/${plusDisabled ? 'plus-disabled' : 'plus'}.svg`);
  }

  /**
   * Execute roll with selected options
   */
  async _executeRoll() {
    // Calculate condition modifiers
    const conditionMod = (this._conditions.prepared ? 2 : 0) +
                         (this._conditions.distracted ? -2 : 0);
    const extraMod = conditionMod + this._luckToSpend;

    // Spend luck if any was used
    if (this._luckToSpend > 0) {
      const currentSpent = this.actor.system.stats.luck.spent || 0;
      const currentSpentAt = this.actor.system.stats.luck.spentAt;
      this.actor.update({
        "system.stats.luck.spent": currentSpent + this._luckToSpend,
        "system.stats.luck.spentAt": currentSpentAt || Date.now()
      });
    }

    this.close();

    // Perform the roll via actor method
    if (this.rollType === "skill") {
      this.actor.rollSkillCheck(
        this.skillId,
        this._selectedDifficulty.value,
        extraMod
      );
    } else {
      this.actor.rollStatCheck(
        this.statName,
        this._selectedDifficulty.value,
        extraMod
      );
    }

    // Register action AFTER executing
    const { registerAction } = await import("../action-tracker.js");
    const actionType = this.rollType === "skill" ? "skill roll" : "stat roll";
    await registerAction(this.actor, actionType);
  }

  /** @override */
  close(options) {
    // Clean up document click handler
    $(document).off('click.skillRollDropdown');
    return super.close(options);
  }
}
