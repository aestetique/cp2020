import { localize } from "../utils.js";
import { getSkillsForCategory, meleeDamageBonus, ramBaseDamage } from "../lookups.js";
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
    const martialKeys = { Kick: "kick", Disarm: "disarm", Sweep: "sweep", Grapple: "grapple", Hold: "hold", Break: "hold", Choke: "choke", Crush: "choke", Throw: "throw", Ram: "ram" };
    this._martialKey = martialKeys[actionKey] || "strike";
    const noDamageActions = ["Disarm", "Sweep", "Grapple", "Hold"];
    // Break, Choke, and Crush use same base damage as Punch, but Crush multiplies by 2
    const baseDmg = noDamageActions.includes(actionKey) ? null
      : actionKey === "Kick" ? actor.system.kickBaseDamage
      : actionKey === "Ram" ? ramBaseDamage(actor.system.stats.bt.total)
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
                      && this._actionKey !== "Throw"
                      && this._actionKey !== "Ram";

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
    // Special handling for Ram attack (movement-based)
    if (this._actionKey === "Ram") {
      return this._executeRamRoll();
    }

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

    // Register action for unarmed attacks AFTER executing
    const { registerAction } = await import("../action-tracker.js");
    await registerAction(this.actor, `unarmed: ${this._actionLabel}`);
  }

  /**
   * Execute Ram attack with movement-based mechanics
   */
  async _executeRamRoll() {
    const system = this.actor.system;

    // Spend luck if any was used
    if (this._luckToSpend > 0) {
      const currentSpent = system.stats.luck.spent || 0;
      const currentSpentAt = system.stats.luck.spentAt;
      await this.actor.update({
        "system.stats.luck.spent": currentSpent + this._luckToSpend,
        "system.stats.luck.spentAt": currentSpentAt || Date.now()
      });
    }

    // Close dialog
    this.close();

    // Minimize all open windows
    Object.values(ui.windows).forEach(w => w.minimize());

    // Get starting position
    const actorToken = this.actor.getActiveTokens()?.[0];
    if (!actorToken) {
      ui.notifications.error(localize("NoTokenForRam"));
      return;
    }

    const startPos = { x: actorToken.center.x, y: actorToken.center.y };

    // Show movement ruler and get destination
    let destination;
    try {
      destination = await this._placeRamDestination(actorToken);
    } catch (e) {
      return; // User cancelled
    }

    // Move token to destination (convert center position to top-left corner)
    await actorToken.document.update({
      x: destination.x - (actorToken.document.width * canvas.grid.size) / 2,
      y: destination.y - (actorToken.document.height * canvas.grid.size) / 2
    });

    // Calculate distance moved (in meters)
    const distanceMoved = canvas.grid.measureDistance(
      startPos,
      destination,
      { gridSpaces: false }
    );

    // Calculate distance-based modifiers
    const runDistance = system.stats.ma.run;
    const walkDistance = system.stats.ma.total;

    const quarterRun = runDistance / 4;
    const thirdRun = runDistance / 3;
    const halfRun = runDistance / 2;

    let distancePenalty = 0;
    let distanceBonus = 0;

    if (distanceMoved >= halfRun) {
      distancePenalty = -6;
      distanceBonus = Math.floor(walkDistance / 2);
    } else if (distanceMoved >= thirdRun) {
      distancePenalty = -4;
      distanceBonus = Math.floor(walkDistance / 3);
    } else if (distanceMoved >= quarterRun) {
      distancePenalty = -2;
      distanceBonus = Math.floor(walkDistance / 4);
    }
    // else: no penalty, no bonus

    // === ATTACK ROLL ===
    const isBlinded = this.actor.statuses.has("blinded");
    const attackStat = isBlinded ? "luck" : "ref";

    const extraMod = (this._conditions.prepared ? 2 : 0)
                   + (this._conditions.ambush ? 5 : 0)
                   + (this._conditions.distracted ? -2 : 0)
                   + (this._conditions.indirect ? -5 : 0)
                   + distancePenalty  // Ram distance penalty
                   + this._luckToSpend;

    const attackTerms = [`@stats.${attackStat}.total`];

    // Add skill value and martial bonus
    let skillValue = 0;
    let martialBonus = 0;
    if (this._selectedSkill) {
      skillValue = this._selectedSkill.value;
      if (skillValue) attackTerms.push(skillValue);

      // Martial bonus (only if Ram aspect > 0)
      if (this._selectedSkill.martialBonus) {
        martialBonus = this._selectedSkill.martialBonus;
        attackTerms.push(martialBonus);
      }
    }

    if (extraMod) attackTerms.push(extraMod);

    // Status penalties (no grappling exception for Ram)
    if (this.actor.statuses.has("fast-draw")) attackTerms.push(-3);
    if (this.actor.statuses.has("action-surge")) attackTerms.push(-3);
    if (this.actor.statuses.has("restrained")) attackTerms.push(-2);
    if (this.actor.statuses.has("grappling")) attackTerms.push(-2);
    if (this.actor.statuses.has("prone")) attackTerms.push(-2);

    const attackRoll = await buildD10Roll(attackTerms, system).evaluate();

    // Trigger Dice So Nice
    if (game.dice3d) {
      await game.dice3d.showForRoll(attackRoll, game.user, true);
    }

    // Check for fumble
    const isNatural1 = attackRoll.dice[0]?.results?.[0]?.result === 1;
    if (isNatural1) {
      await this.actor.rollFumble();
    }

    // === DAMAGE ROLL ===
    const baseDamageFormula = this._baseDamage;  // Already set to ramBaseDamage in constructor
    const baseDamageRoll = await new Roll(baseDamageFormula).evaluate();

    if (game.dice3d && baseDamageRoll.dice.length > 0) {
      await game.dice3d.showForRoll(baseDamageRoll, game.user, true);
    }

    // Total damage: base + martial skill (if Ram aspect > 0) + distance bonus
    const martialDamageBonus = (martialBonus > 0) ? skillValue : 0;
    const totalDamage = Math.floor(baseDamageRoll.total) + martialDamageBonus + distanceBonus;

    // Build clean display formula
    const displayParts = [baseDamageFormula];
    if (martialDamageBonus) displayParts.push(String(martialDamageBonus));
    if (distanceBonus) displayParts.push(String(distanceBonus));
    const displayFormula = displayParts.join(' + ');

    // Random location roll
    const locationRoll = await rollLocation(null, null);
    const hitLocation = locationRoll.areaHit;

    // Build areaDamages
    const areaDamages = {};
    areaDamages[hitLocation] = [{
      damage: totalDamage,
      formula: displayFormula,
      dice: baseDamageRoll.dice.map(term => ({
        faces: term.faces,
        results: term.results.map(r => ({ result: r.result, exploded: r.exploded }))
      })),
      ignoreArmor: false  // Ram does NOT ignore armor
    }];

    // === CHAT MESSAGE ===
    const templateData = {
      actionIcon: "ref",
      fireModeLabel: localize("Ram"),
      attackRoll: attackRoll,
      hasDamage: true,
      hasApply: true,
      areaDamages: areaDamages,
      weaponName: localize("UnarmedAttack"),
      weaponImage: "systems/cyberpunk/img/ui/unarmed.svg",
      weaponType: "Melee · 1 m",
      loadedAmmoType: "standard",
      damageType: "blunt",
      weaponEffect: "",
      hasEffect: false,
      effectIcon: null,
      effectLabel: null,
      hitLocation: hitLocation
    };

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    new RollBundle(localize("Ram"))
      .execute(speaker, "systems/cyberpunk/templates/chat/melee-hit.hbs", templateData);

    // Register action for Ram attack AFTER executing
    const { registerAction } = await import("../action-tracker.js");
    await registerAction(this.actor, `unarmed: Ram`);
  }

  /**
   * Place destination for Ram attack using movement ruler
   * @param {Token} actorToken - The actor's token
   * @returns {Promise<{x: number, y: number}>} Destination position
   */
  async _placeRamDestination(actorToken) {
    return new Promise((resolve, reject) => {
      const handlers = {};
      let hoveredPos = null;
      let ruler = null;

      // Create ruler visualization
      const startPos = actorToken.center;

      // Get movement distances for color coding
      const walkDistance = this.actor.system.stats?.ma?.total ?? 0;
      const runDistance = this.actor.system.stats?.ma?.run ?? (walkDistance * 3);

      // Mouse move - show ruler to cursor
      handlers.mm = (event) => {
        event.stopPropagation();
        const pos = event.getLocalPosition(canvas.tokens);
        const snapped = canvas.grid.getSnappedPosition(pos.x, pos.y, 2);
        hoveredPos = snapped;

        // Calculate distance for color coding
        const distance = canvas.grid.measureDistance(startPos, snapped, { gridSpaces: false });

        // Determine color based on distance (same as CyberpunkTokenRuler)
        let color;
        if (distance <= walkDistance) {
          color = 0x1A804D;  // Green - within walk range
        } else if (distance <= runDistance) {
          color = 0xB8A46A;  // Yellow - requires running
        } else {
          color = 0xB60F3C;  // Red - exceeds run distance
        }

        // Update ruler visualization
        if (!ruler) {
          ruler = new PIXI.Graphics();
          canvas.controls.addChild(ruler);
        }

        ruler.clear();
        ruler.lineStyle(5, color, 0.8);
        ruler.moveTo(startPos.x, startPos.y);
        ruler.lineTo(snapped.x, snapped.y);
      };

      // Left click - confirm destination
      handlers.lc = (event) => {
        if (hoveredPos) {
          cleanup();
          resolve(hoveredPos);
        }
      };

      // Right click - cancel
      handlers.rc = (event) => {
        event.preventDefault();
        cleanup();
        reject(new Error("cancelled"));
      };

      // Escape key - cancel
      handlers.esc = (event) => {
        if (event.key === "Escape") {
          cleanup();
          reject(new Error("cancelled"));
        }
      };

      function cleanup() {
        canvas.stage.off("pointermove", handlers.mm);
        canvas.stage.off("pointerdown", handlers.lc);
        canvas.app.view.removeEventListener("contextmenu", handlers.rc);
        document.removeEventListener("keydown", handlers.esc);
        if (ruler) {
          canvas.controls.removeChild(ruler);
          ruler.destroy();
        }
      }

      canvas.stage.on("pointermove", handlers.mm);
      canvas.stage.once("pointerdown", handlers.lc);
      canvas.app.view.addEventListener("contextmenu", handlers.rc);
      document.addEventListener("keydown", handlers.esc);

      ui.notifications.info(localize("ClickRamDestination"));
    });
  }

  /** @override */
  close(options) {
    $(document).off('click.punchDialogDropdown');
    return super.close(options);
  }
}
