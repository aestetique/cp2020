import { localize } from "../utils.js";
import { getSkillsForCategory, meleeDamageBonus } from "../lookups.js";
import { buildD10Roll, RollBundle } from "../dice.js";
import { rollLocation } from "../utils.js";

/**
 * Punch Dialog — attack configuration for unarmed Punch.
 * Combines the MeleeAttackDialog layout (conditions, location, luck)
 * with a skill selector from DefenceRollDialog (using unarmedAttacks mapping).
 */
export class PunchDialog extends Application {

  /**
   * @param {Actor} actor  The attacking actor
   */
  constructor(actor, { actionKey = "Punch" } = {}) {
    super();
    this.actor = actor;
    this._actionKey = actionKey;
    const martialKeys = { Kick: "kick", Disarm: "disarm", Sweep: "sweep", Grapple: "grapple", Hold: "hold", Break: "hold", Choke: "choke", Crush: "choke", Throw: "throw" };
    this._martialKey = martialKeys[actionKey] || "strike";
    const noDamageActions = ["Disarm", "Sweep", "Grapple", "Hold"];
    // Break, Choke, and Crush use same base damage as Punch, but Crush multiplies by 2
    const baseDmg = noDamageActions.includes(actionKey) ? null
      : actionKey === "Kick" ? actor.system.kickBaseDamage
      : actor.system.unarmedBaseDamage;

    // Crush doubles the base damage
    this._baseDamage = actionKey === "Crush"
      ? this._multiplyDiceFormula(baseDmg, 2)
      : baseDmg;

    const effectMap = { Sweep: "prone", Grapple: "grapple", Hold: "hold", Throw: "throw" };
    this._weaponEffect = effectMap[actionKey] || "";

    // Skill selector
    this._dropdownOpen = false;
    this._selectedSkill = null;
    this._skillOptions = this._buildSkillOptions();
    if (this._skillOptions.length > 0) {
      this._selectedSkill = this._skillOptions[0];
    }

    // Condition toggles
    this._conditions = {
      prepared: false,
      ambush: false,
      distracted: false,
      indirect: false
    };

    // Location targeting
    this._selectedLocation = null;

    // Choke always targets Head
    if (actionKey === "Choke") {
      this._selectedLocation = "Head";
    }

    // Crush always targets Torso
    if (actionKey === "Crush") {
      this._selectedLocation = "Torso";
    }

    // Luck spending
    this._luckToSpend = 0;
    this._availableLuck = actor.system.stats.luck?.effective ?? actor.system.stats.luck?.total ?? 0;
  }

  /**
   * Helper method to multiply dice formula
   * @param {string} formula - Dice formula like "1d3" or "2d6"
   * @param {number} multiplier - Multiplier for dice count
   * @returns {string} - Multiplied formula like "2d3" or "4d6"
   */
  _multiplyDiceFormula(formula, multiplier) {
    if (!formula) return null;
    const match = formula.match(/^(\d+)d(\d+)$/);
    if (match) {
      const count = Number(match[1]);
      const size = match[2];
      return `${count * multiplier}d${size}`;
    }
    return formula; // Fallback if format doesn't match
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "punch-dialog",
      classes: ["cyberpunk", "melee-attack-dialog"],
      template: "systems/cyberpunk/templates/dialog/punch-attack.hbs",
      width: 300,
      height: "auto",
      popOut: true,
      minimizable: false,
      resizable: false
    });
  }

  /**
   * Build skill options from the unarmedAttacks skill mapping.
   * Martial bonus uses the key stored in this._martialKey.
   */
  _buildSkillOptions() {
    const mappedNames = new Set();
    for (const name of getSkillsForCategory("unarmedAttacks")) {
      mappedNames.add(name);
    }

    const options = [];
    for (const skillName of mappedNames) {
      const skill = this.actor.itemTypes.skill.find(s => s.name === skillName);
      if (!skill) continue;

      const skillValue = this.actor.resolveSkillTotal(skillName);
      if (skillValue <= 0) continue;

      let martialBonus = 0;
      if (skill.system.isMartial && skill.system.martial) {
        martialBonus = Number(skill.system.martial[this._martialKey]) || 0;
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
    const noDamageActions = ["Disarm", "Sweep", "Grapple", "Hold"];
    // Choke and Crush hide location selector (target Head/Torso automatically)
    const showLocation = !noDamageActions.includes(this._actionKey)
                      && this._actionKey !== "Choke"
                      && this._actionKey !== "Crush"
                      && this._actionKey !== "Throw";

    // Break: show location with Head/Torso disabled, location required
    const isBreak = this._actionKey === "Break";
    const locationRequired = isBreak;
    const disabledLocations = isBreak ? ["Head", "Torso"] : [];

    return {
      actionLabel: localize(this._actionKey),
      skills: this._skillOptions,
      hasSkills,
      selectedSkillLabel: this._selectedSkill?.label || localize("NoSkillsBonus"),
      noSkillsLabel: localize("NoSkillsBonus"),
      showLocation,
      locationRequired,
      disabledLocations,
      // Luck data
      luckToSpend: this._luckToSpend,
      availableLuck: this._availableLuck,
      canIncreaseLuck: this._luckToSpend < this._availableLuck,
      canDecreaseLuck: this._luckToSpend > 0,
      hasAnyLuck: this._availableLuck > 0,
      luckDisabled: this._availableLuck <= 0
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
    $(document).on('click.punchDialogDropdown', (ev) => {
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

    // Location button selection
    html.find('.location-btn').click(ev => {
      const btn = ev.currentTarget;

      // Ignore clicks on disabled buttons
      if (btn.disabled || btn.classList.contains('disabled')) {
        return;
      }

      const location = btn.dataset.location;

      if (this._selectedLocation === location) {
        this._selectedLocation = null;
        btn.classList.remove('selected');
      } else {
        html.find('.location-btn').removeClass('selected');
        this._selectedLocation = location;
        btn.classList.add('selected');
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
   * Execute the punch attack — roll attack, damage, location, post chat message.
   */
  async _executeRoll() {
    // Validate: Break requires location selection
    if (this._actionKey === "Break" && !this._selectedLocation) {
      ui.notifications.warn(localize("MustSelectLimbForBreak"));
      return;
    }

    const system = this.actor.system;

    // Spend luck if any was used
    if (this._luckToSpend > 0) {
      const currentSpent = system.stats.luck.spent || 0;
      const currentSpentAt = system.stats.luck.spentAt;
      this.actor.update({
        "system.stats.luck.spent": currentSpent + this._luckToSpend,
        "system.stats.luck.spentAt": currentSpentAt || Date.now()
      });
    }

    this.close();

    // === ATTACK ROLL ===
    const isBlinded = this.actor.statuses.has("blinded");
    const attackStat = isBlinded ? "luck" : "ref";

    const extraMod = (this._conditions.prepared ? 2 : 0)
                   + (this._conditions.ambush ? 5 : 0)
                   + (this._conditions.distracted ? -2 : 0)
                   + (this._conditions.indirect ? -5 : 0)
                   + (this._selectedLocation && this._actionKey !== "Break" && this._actionKey !== "Choke" && this._actionKey !== "Crush" ? -4 : 0)
                   + this._luckToSpend;

    const attackTerms = [`@stats.${attackStat}.total`];

    // Add skill value
    let skillValue = 0;
    if (this._selectedSkill) {
      skillValue = this._selectedSkill.value;
      if (skillValue) attackTerms.push(skillValue);

      // Martial bonus
      if (this._selectedSkill.martialBonus) {
        attackTerms.push(this._selectedSkill.martialBonus);
      }
    }

    if (extraMod) attackTerms.push(extraMod);

    // Status penalties
    if (this.actor.statuses.has("fast-draw")) attackTerms.push(-3);
    if (this.actor.statuses.has("action-surge")) attackTerms.push(-3);

    // Grappling/Restrained penalties don't apply to grappling actions
    const grapplingActions = ["Hold", "Break", "Choke", "Crush", "Throw"];
    const isGrapplingAction = grapplingActions.includes(this._actionKey);

    if (this.actor.statuses.has("restrained") && !isGrapplingAction) attackTerms.push(-2);
    if (this.actor.statuses.has("grappling") && !isGrapplingAction) attackTerms.push(-2);
    if (this.actor.statuses.has("prone")) attackTerms.push(-2);

    const attackRoll = await buildD10Roll(attackTerms, system).evaluate();

    // Trigger Dice So Nice for attack roll
    if (game.dice3d) {
      await game.dice3d.showForRoll(attackRoll, game.user, true);
    }

    // Check for fumble (natural 1)
    const isNatural1 = attackRoll.dice[0]?.results?.[0]?.result === 1;
    if (isNatural1) {
      await this.actor.rollFumble();
    }

    // === DAMAGE & LOCATION ROLLS (skip for damageless actions like Disarm) ===
    let areaDamages = {};
    let hitLocation = "";

    if (this._baseDamage) {
      let baseDamageFormula = this._baseDamage;
      const mult = system.unarmedDamageMultiplier;
      if (mult > 1) {
        // Parse formula and multiply dice count
        const diceMatch = baseDamageFormula.match(/^(\d+)d(\d+)$/);
        if (diceMatch) {
          const diceCount = Number(diceMatch[1]);
          const diceSize = diceMatch[2];
          baseDamageFormula = `${diceCount * mult}d${diceSize}`;
        } else {
          // Fallback for complex formulas (shouldn't happen with new system)
          baseDamageFormula = `(${baseDamageFormula})*${mult}`;
        }
      }

      const baseDamageRoll = await new Roll(baseDamageFormula).evaluate();

      if (game.dice3d && baseDamageRoll.dice.length > 0) {
        await game.dice3d.showForRoll(baseDamageRoll, game.user, true);
      }

      const strengthBonus = meleeDamageBonus(system.stats.bt.total);
      const martialDamageBonus = this._selectedSkill?.isMartial ? this._selectedSkill.value : 0;
      const totalDamage = Math.floor(baseDamageRoll.total) + strengthBonus + martialDamageBonus;

      // Build clean display formula (no floor wrapper, omit zero bonuses)
      const displayParts = [baseDamageFormula];
      if (strengthBonus) displayParts.push(String(strengthBonus));
      if (martialDamageBonus) displayParts.push(String(martialDamageBonus));
      const displayFormula = displayParts.join(' + ');

      // Location roll
      const locationRoll = await rollLocation(null, this._selectedLocation);
      hitLocation = locationRoll.areaHit;

      // Build areaDamages
      areaDamages = {};
      areaDamages[hitLocation] = [{
        damage: totalDamage,
        formula: displayFormula,
        dice: baseDamageRoll.dice.map(term => ({
          faces: term.faces,
          results: term.results.map(r => ({ result: r.result, exploded: r.exploded }))
        })),
        ignoreArmor: this._actionKey === "Break" || this._actionKey === "Choke" || this._actionKey === "Crush" || this._actionKey === "Throw"
      }];
    }

    // === CHAT MESSAGE ===
    const templateData = {
      actionIcon: "ref",
      fireModeLabel: localize(this._actionKey),
      attackRoll: attackRoll,
      hasDamage: !!this._baseDamage,
      hasApply: !!this._baseDamage || !!this._weaponEffect,
      areaDamages: areaDamages,
      weaponName: localize("UnarmedAttack"),
      weaponImage: "systems/cyberpunk/img/ui/unarmed.svg",
      weaponType: "Melee · 1 m",
      loadedAmmoType: "standard",
      damageType: "blunt",
      weaponEffect: this._weaponEffect,
      hasEffect: !!this._weaponEffect,
      effectIcon: { prone: "prone", grapple: "restrained", hold: "immobilized", throw: "prone" }[this._weaponEffect] || null,
      effectLabel: { prone: localize("Conditions.Prone"), grapple: localize("Conditions.Restrained"), hold: localize("Conditions.Immobilized"), throw: localize("Conditions.Prone") }[this._weaponEffect] || null,
      hitLocation: hitLocation
    };

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    new RollBundle(localize(this._actionKey))
      .execute(speaker, "systems/cyberpunk/templates/chat/melee-hit.hbs", templateData);
  }

  /** @override */
  close(options) {
    $(document).off('click.punchDialogDropdown');
    return super.close(options);
  }
}
