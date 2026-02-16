import { localize } from "../utils.js";
import { getSkillsForCategory } from "../lookups.js";
import { buildD10Roll, RollBundle } from "../dice.js";

/**
 * Defence Roll Dialog — lets a defender roll Parry, Dodge, or Escape against a melee attack.
 * Shows a skill dropdown (populated from skill mappings) and luck controls.
 */
export class DefenceRollDialog extends Application {

  /**
   * @param {Actor}  actor        The defending actor
   * @param {string} defenceType  "parry", "dodge", or "escape"
   * @param {number} attackTotal  The attack roll total to beat
   */
  constructor(actor, defenceType, attackTotal) {
    super();
    this.actor = actor;
    this.defenceType = defenceType;
    this.attackTotal = attackTotal;

    this._dropdownOpen = false;
    this._selectedSkill = null; // { id, name, stat, value, martialBonus }

    // Luck spending
    this._luckToSpend = 0;
    this._availableLuck = actor.system.stats.luck?.effective ?? actor.system.stats.luck?.total ?? 0;

    // Build skill options once
    this._skillOptions = this._buildSkillOptions();
    if (this._skillOptions.length > 0) {
      this._selectedSkill = this._skillOptions[0];
    }
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "defence-roll-dialog",
      classes: ["cyberpunk", "defence-roll-dialog"],
      template: "systems/cyberpunk/templates/dialog/defence-roll.hbs",
      width: 300,
      height: "auto",
      popOut: true,
      minimizable: false,
      resizable: false
    });
  }

  /** @override */
  get title() {
    return localize("DefenceRoll");
  }

  /**
   * Build the list of available skills for the defence type.
   * Parry: meleeAttacks + unarmedAttacks
   * Dodge/Escape: escapeSkills + unarmedAttacks
   */
  _buildSkillOptions() {
    const categories = this.defenceType === "parry"
      ? ["meleeAttacks", "unarmedAttacks"]
      : ["escapeSkills", "unarmedAttacks"]; // dodge and escape use same categories

    // Collect unique skill names from mapped categories
    const mappedNames = new Set();
    for (const cat of categories) {
      for (const name of getSkillsForCategory(cat)) {
        mappedNames.add(name);
      }
    }

    const options = [];
    for (const skillName of mappedNames) {
      const skill = this.actor.itemTypes.skill.find(s => s.name === skillName);
      if (!skill) continue;

      // Determine effective skill value (chip or base+ip+bonuses)
      const skillValue = this.actor.resolveSkillTotal(skillName);
      if (skillValue <= 0) continue;

      // Martial bonus (only if this is a martial art skill)
      let martialBonus = 0;
      if (skill.system.isMartial && skill.system.martial) {
        martialBonus = Number(skill.system.martial[this.defenceType]) || 0;
      }

      const totalDisplay = skillValue + martialBonus;

      options.push({
        id: skill.id,
        name: skill.name,
        stat: skill.system.stat,
        isMartial: skill.system.isMartial,
        value: skillValue,
        martialBonus,
        label: `${skill.name} +${totalDisplay}`
      });
    }

    return options;
  }

  /** @override */
  getData() {
    const hasSkills = this._skillOptions.length > 0;
    const luckDisabled = this._availableLuck <= 0;

    let defenceLabel;
    if (this.defenceType === "parry") {
      defenceLabel = localize("Parry");
    } else if (this.defenceType === "escape") {
      defenceLabel = localize("Escape");
    } else {
      defenceLabel = localize("Dodge");
    }

    return {
      defenceLabel,
      skills: this._skillOptions,
      hasSkills,
      selectedSkillLabel: this._selectedSkill?.label || localize("NoSkillsBonus"),
      noSkillsLabel: localize("NoSkillsBonus"),
      // Luck data
      luckToSpend: this._luckToSpend,
      availableLuck: this._availableLuck,
      canIncreaseLuck: this._luckToSpend < this._availableLuck,
      canDecreaseLuck: this._luckToSpend > 0,
      hasAnyLuck: this._availableLuck > 0,
      luckDisabled
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

    // Skill dropdown toggle
    html.find('.range-dropdown-btn').click(ev => {
      ev.stopPropagation();
      this._dropdownOpen = !this._dropdownOpen;
      html.find('.range-dropdown-list').toggleClass('open', this._dropdownOpen);
      html.find('.range-dropdown-btn').toggleClass('open', this._dropdownOpen);
    });

    // Skill option selection
    html.find('.range-option').click(ev => {
      const skillId = ev.currentTarget.dataset.skillId;
      const selected = this._skillOptions.find(s => s.id === skillId);
      if (selected) {
        this._selectedSkill = selected;
        this._dropdownOpen = false;

        html.find('.range-dropdown-btn .range-label').text(selected.label);
        html.find('.range-dropdown-list').removeClass('open');
        html.find('.range-dropdown-btn').removeClass('open');

        html.find('.range-option').removeClass('selected');
        ev.currentTarget.classList.add('selected');
      }
    });

    // Close dropdown when clicking outside
    $(document).on('click.defenceRollDropdown', (ev) => {
      if (!$(ev.target).closest('.range-dropdown').length) {
        this._dropdownOpen = false;
        html.find('.range-dropdown-list').removeClass('open');
        html.find('.range-dropdown-btn').removeClass('open');
      }
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

    html.find('.luck-minus-btn img').attr('src',
      `systems/cyberpunk/img/chat/${minusDisabled ? 'minus-disabled' : 'minus'}.svg`);
    html.find('.luck-plus-btn img').attr('src',
      `systems/cyberpunk/img/chat/${plusDisabled ? 'plus-disabled' : 'plus'}.svg`);
  }

  /**
   * Execute the defence roll
   */
  async _executeRoll() {
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

    // If no skill selected, roll just 1d10 vs attack total (no bonuses)
    if (!this._selectedSkill) {
      const roll = buildD10Roll(
        [this._luckToSpend || null].filter(Boolean),
        this.actor.system
      );
      await roll.evaluate();

      const d10Result = roll.dice[0]?.results[0]?.result;
      const isNatural1 = d10Result === 1;
      const success = !isNatural1 && roll.total >= this.attackTotal;

      let actionLabel;
      if (this.defenceType === "parry") {
        actionLabel = localize("Parry");
      } else if (this.defenceType === "escape") {
        actionLabel = localize("Escape");
      } else {
        actionLabel = localize("Dodge");
      }
      const speaker = ChatMessage.getSpeaker({ actor: this.actor });
      new RollBundle(actionLabel)
        .addRoll(roll)
        .execute(speaker, "systems/cyberpunk/templates/chat/skill-check.hbs", {
          statIcon: "defend",
          difficulty: this.attackTotal,
          success
        });

      if (isNatural1) {
        await this.actor.rollFumble();
      }
      return;
    }

    // Build roll formula parts following performSkillRoll pattern
    const skill = this.actor.items.get(this._selectedSkill.id);
    if (!skill) return;

    // Action Surge / Fast Draw penalties
    const actionSurgePenalty = this.actor.statuses.has("action-surge") ? -3 : 0;
    const fastDrawPenalty = this.actor.statuses.has("fast-draw") ? -3 : 0;
    const restrainedPenalty = this.actor.statuses.has("restrained") ? -2 : 0;
    const grapplingPenalty = this.actor.statuses.has("grappling") ? -2 : 0;

    // Skill value (same as resolveSkillTotal but we need it as a number for the formula)
    const skillValue = this._selectedSkill.value;

    // Martial bonus
    const martialBonus = this._selectedSkill.martialBonus;

    const parts = [
      skillValue,
      skill.system.stat ? `@stats.${skill.system.stat}.total` : null,
      martialBonus || null,
      this._luckToSpend || null,
      actionSurgePenalty || null,
      fastDrawPenalty || null,
      restrainedPenalty || null,
      grapplingPenalty || null
    ].filter(Boolean);

    const roll = buildD10Roll(parts, this.actor.system);
    await roll.evaluate();

    // Check for natural 1
    const d10Result = roll.dice[0]?.results[0]?.result;
    const isNatural1 = d10Result === 1;
    const success = !isNatural1 && roll.total >= this.attackTotal;

    let actionLabel;
    if (this.defenceType === "parry") {
      actionLabel = localize("Parry");
    } else if (this.defenceType === "escape") {
      actionLabel = localize("Escape");
    } else {
      actionLabel = localize("Dodge");
    }
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    new RollBundle(actionLabel)
      .addRoll(roll)
      .execute(speaker, "systems/cyberpunk/templates/chat/skill-check.hbs", {
        statIcon: "defend",
        difficulty: this.attackTotal,
        success
      });

    // Fumble on natural 1
    if (isNatural1) {
      await this.actor.rollFumble();
    }
  }

  /** @override */
  close(options) {
    $(document).off('click.defenceRollDropdown');
    return super.close(options);
  }
}
