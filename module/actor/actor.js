import { buildD10Roll, RollBundle } from "../dice.js";
import { SortModes, sortSkills } from "./skill-sort.js";
import { bodyTypeModifier } from "../lookups.js";
import { toTitleCase, localize, stackArmorSP, buildHitLocationIndex } from "../utils.js"
import { WOUND_CONDITION_IDS, WOUND_STATE_TO_CONDITION } from "../conditions.js"

/**
 * Actor document for Cyberpunk 2020 characters.
 * @extends {Actor}
 */
export class CyberpunkActor extends Actor {


  /** @override */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    if (data.type === "character") {
      this.updateSource({
        img: "systems/cyberpunk/img/svg/placeholder-character.svg",
        "prototypeToken.texture.src": "systems/cyberpunk/img/svg/placeholder-character.svg",
        "prototypeToken.actorLink": true,
        "prototypeToken.sight.enabled": true,
        "system.icon": "systems/cyberpunk/img/svg/placeholder-character.svg",
        "system.skillsSortedBy": "Name"
      });
    }
  }

  /**
   * Augment the basic actor data with additional dynamic data - the stuff that's calculated from other data
   */
  prepareData() {
    super.prepareData();
    switch ( this.type ) {
      // Both types share the same preparation logic
      case "npc":
      case "character":
        this._computeDerivedStats(this.system);
        break;
    }
  }

  /**
   * Prepare Character type specific data
   */
  _computeDerivedStats(system) {
    const stats = system.stats;
    // Calculate stat totals using base+temp
    for(const stat of Object.values(stats)) {
      stat.total = stat.base + stat.tempMod;
    }
    system.hitLocLookup = buildHitLocationIndex(system.hitLocations);
    
    // Sort through this now so we don't have to later
    let equippedItems = this.items.contents.filter(item => {
      return item.system.equipped;
    });

    // Initialize unarmed combat properties BEFORE applying bonuses
    system.unarmedBaseDamage = "1d3";
    system.unarmedDamageMultiplier = 1;

    // Apply bonuses from equipped tools, drugs, and cyberware
    // For cyberware options, verify base cyberware is also equipped
    const equippedWithBonuses = equippedItems.filter(i => {
      if (i.type === "tool" || i.type === "drug") return true;
      if (i.type === "cyberware") {
        // For cyberware options, check if base is also equipped
        if (i.system.isOption) {
          const baseId = i.getFlag('cyberpunk', 'attachedTo');
          if (baseId) {
            const base = this.items.get(baseId);
            // Option only applies if base exists and is equipped
            return base && base.system.equipped;
          }
          // No base reference = don't apply
          return false;
        }
        // Non-option cyberware always applies if equipped
        return true;
      }
      return false;
    });
    equippedWithBonuses.forEach(item => {
      const bonuses = item.system.bonuses || [];
      bonuses.forEach(bonus => {
        if (bonus.type === "property" && bonus.property) {
          // Property bonuses modify stats directly
          // Format: "stats.int.tempMod", "initiativeMod", etc.
          const parts = bonus.property.split('.');
          if (parts[0] === "stats" && parts.length === 3) {
            // e.g., "stats.int.tempMod"
            const statKey = parts[1];
            if (stats[statKey]) {
              stats[statKey].tempMod = (stats[statKey].tempMod || 0) + (bonus.value || 0);
            }
          } else if (parts.length === 1) {
            // Direct property like "initiativeMod" or "unarmedDamageMultiplier"
            system[bonus.property] = (system[bonus.property] || 0) + (bonus.value || 0);
          }
        }
        // Note: Skill bonuses require separate handling during skill rolls
      });
    });

    // Recalculate stat totals after applying bonuses
    for (const stat of Object.values(stats)) {
      stat.total = stat.base + (stat.tempMod || 0);
    }

    // Check luck recovery (8 hours = 28,800,000 ms)
    const LUCK_RECOVERY_MS = 8 * 60 * 60 * 1000;
    if (stats.luck.spentAt && Date.now() - stats.luck.spentAt >= LUCK_RECOVERY_MS) {
      // Reset spent luck (will be persisted on next update)
      this.update({
        "system.stats.luck.spent": 0,
        "system.stats.luck.spentAt": null
      });
      stats.luck.spent = 0;
      stats.luck.spentAt = null;
    }

    // Calculate effective luck (what's actually available to spend)
    stats.luck.effective = Math.max(0, stats.luck.total - (stats.luck.spent || 0));

    // Reflex is affected by encumbrance values too
    stats.ref.armorMod = 0;
    equippedItems.filter(i => i.type === "armor").forEach(armor => {
      let armorData = armor.system;
      if(armorData.encumbrance != null) {
        stats.ref.armorMod -= armorData.encumbrance;
      }

      // Layered armor stacking per CP2020 rules
      for (const armorArea in armorData.coverage) {
        const location = system.hitLocations[armorArea];
        if (location !== undefined) {
          const cov = armorData.coverage[armorArea];
          const layerSP = Math.max(0, (Number(cov.stoppingPower) || 0) - (Number(cov.ablation) || 0));
          location.stoppingPower = stackArmorSP(Number(location.stoppingPower), layerSP);
        }
      }
    });

    // Add cyberarmor SP to hit locations (same stacking rules)
    equippedItems.filter(i => i.type === "cyberware" && i.system.isArmor).forEach(cyber => {
      const coverage = (cyber.system.armor || {}).coverage || {};
      for (const armorArea in coverage) {
        const location = system.hitLocations[armorArea];
        if (location !== undefined) {
          const cov = coverage[armorArea];
          const layerSP = Math.max(0, (Number(cov.stoppingPower) || 0) - (Number(cov.ablation) || 0));
          location.stoppingPower = stackArmorSP(Number(location.stoppingPower), layerSP);
        }
      }
    });

    stats.ref.total = stats.ref.base + stats.ref.tempMod + stats.ref.armorMod;

    const move = stats.ma;
    // Immobilized and prone conditions reduce movement to 0
    if (this.statuses.has("immobilized") || this.statuses.has("prone")) {
      move.total = 0;
    }
    move.run = move.total * 3;
    move.leap = Math.floor(move.run / 4); 

    const body = stats.bt;
    body.carry = body.total * 10;
    body.lift = body.total * 40;
    body.modifier = bodyTypeModifier(body.total);
    system.carryWeight = 0;
    equippedItems.forEach(item => {
      let weight = item.system.weight || 0;
      system.carryWeight += parseFloat(weight);
    });

    // Apply wound penalties to stats, tracking the delta in stat.woundMod
    let woundState = this.getWoundLevel();
    let woundStat = function(stat, totalChange) {
        let newTotal = totalChange(stat.total)
        stat.woundMod = -(stat.total - newTotal);
        stat.total = newTotal;
    }
    if(woundState >= 4) {
      [stats.ref, stats.int, stats.cool].forEach(stat => woundStat(stat, total => Math.ceil(total/3)));
    } 
    else if(woundState == 3) {
      [stats.ref, stats.int, stats.cool].forEach(stat => woundStat(stat, total => Math.ceil(total/2)));
    }
    else if(woundState == 2) {
      woundStat(stats.ref, total => total - 2);
    }
    // Calculate and configure humanity
    // Humanity damage is PERMANENT (only restored through therapy)
    const emp = stats.emp;
    const humanityDamage = emp.humanityDamage || 0;

    emp.humanity = {
      base: emp.base * 10,           // Max humanity = EMP × 10
      damage: humanityDamage,        // Permanent damage (from cyberware + other sources)
      total: (emp.base * 10) - humanityDamage  // Current humanity
    };

    // EMP reduction: -1 per 10 humanity lost
    emp.total = emp.base + emp.tempMod - Math.floor(humanityDamage / 10);

    // Calculate cyberlimb data from equipped cyberware items
    const subtypeToLocation = {
      'leftArm': 'lArm',
      'rightArm': 'rArm',
      'leftLeg': 'lLeg',
      'rightLeg': 'rLeg'
    };

    // Initialize cyberlimbs data
    system.cyberlimbs = {
      lArm: { hasCyberlimb: false, sdp: 0, maxSdp: 0, disablesAt: 0, isBroken: false, itemId: null },
      rArm: { hasCyberlimb: false, sdp: 0, maxSdp: 0, disablesAt: 0, isBroken: false, itemId: null },
      lLeg: { hasCyberlimb: false, sdp: 0, maxSdp: 0, disablesAt: 0, isBroken: false, itemId: null },
      rLeg: { hasCyberlimb: false, sdp: 0, maxSdp: 0, disablesAt: 0, isBroken: false, itemId: null }
    };

    // Find equipped cyberlimbs (only specific subtypes count)
    const equippedCyberlimbs = equippedItems.filter(i =>
      i.type === 'cyberware' &&
      i.system.cyberwareType === 'cyberlimb' &&
      !i.system.isOption &&
      Object.keys(subtypeToLocation).includes(i.system.cyberwareSubtype)
    );

    for (const limb of equippedCyberlimbs) {
      const loc = subtypeToLocation[limb.system.cyberwareSubtype];
      if (!loc) continue;

      // Only take the first active cyberlimb per location
      if (system.cyberlimbs[loc].hasCyberlimb) continue;

      const current = limb.system.structure?.current ?? 0;
      const baseMax = limb.system.structure?.max ?? 0;
      const baseDisablesAt = limb.system.disablesAt ?? 0;

      // Find attached options and sum their SDP bonuses
      const attachedOptions = this.items.filter(i =>
        i.type === 'cyberware' &&
        i.system.isOption &&
        i.getFlag('cyberpunk', 'attachedTo') === limb.id
      );

      const sdpBonusTotal = attachedOptions.reduce((sum, opt) => {
        return sum + (opt.system.sdpBonus || 0);
      }, 0);

      // Add SDP bonus to both maxSdp and disablesAt
      const max = baseMax + sdpBonusTotal;
      const disablesAt = baseDisablesAt + sdpBonusTotal;

      const isBroken = current > 0 && current <= disablesAt;

      system.cyberlimbs[loc] = {
        hasCyberlimb: true,
        sdp: current,
        maxSdp: max,
        disablesAt: disablesAt,
        isBroken: isBroken,
        itemId: limb.id
      };
    }

    // Helper function to check if cyberlimb is structurally broken
    const isCyberlimbBroken = (limb) => {
      const current = limb.system.structure?.current ?? 0;
      const baseDisablesAt = limb.system.disablesAt ?? 0;

      // Find attached options and sum their SDP bonuses
      const attachedOptions = this.items.filter(i =>
        i.type === 'cyberware' &&
        i.system.isOption &&
        i.getFlag('cyberpunk', 'attachedTo') === limb.id
      );
      const sdpBonusTotal = attachedOptions.reduce((sum, opt) => sum + (opt.system.sdpBonus || 0), 0);
      const disablesAt = baseDisablesAt + sdpBonusTotal;

      return current > 0 && current <= disablesAt;
    };

    // Cyberarm/cyberleg upgrade unarmed damage (only if equipped and not broken)
    const hasCyberarm = equippedItems.some(i =>
      i.type === 'cyberware' &&
      i.system.cyberwareType === 'cyberlimb' &&
      !i.system.isOption &&
      ['leftArm', 'rightArm', 'extraArm'].includes(i.system.cyberwareSubtype) &&
      !isCyberlimbBroken(i)
    );
    const hasCyberleg = equippedItems.some(i =>
      i.type === 'cyberware' &&
      i.system.cyberwareType === 'cyberlimb' &&
      !i.system.isOption &&
      ['leftLeg', 'rightLeg'].includes(i.system.cyberwareSubtype) &&
      !isCyberlimbBroken(i)
    );
    if (hasCyberarm) system.unarmedBaseDamage = "1d6";
    system.kickBaseDamage = hasCyberleg ? "2d6" : "1d6";

    // Determine armor state per location (for visual display)
    const armorState = {};
    const locations = ['Head', 'Torso', 'lArm', 'rArm', 'lLeg', 'rLeg'];
    const limbConditionMap = {
      lArm: 'lost-left-arm',
      rArm: 'lost-right-arm',
      lLeg: 'lost-left-leg',
      rLeg: 'lost-right-leg'
    };

    for (const loc of locations) {
      const hitLoc = system.hitLocations[loc];
      const sp = hitLoc?.stoppingPower || 0;
      const isLimb = ['lArm', 'rArm', 'lLeg', 'rLeg'].includes(loc);

      // Check for limb loss condition
      const isLost = isLimb && this.statuses?.has(limbConditionMap[loc]);

      // Check for cyberlimb (only for limbs)
      const cyberlimb = system.cyberlimbs?.[loc];
      const hasCyber = isLimb && cyberlimb?.hasCyberlimb;

      // Determine highest armor type covering this location
      let hasHardArmor = false;
      equippedItems.filter(i => i.type === "armor").forEach(armor => {
        const coverage = armor.system.coverage?.[loc];
        if (coverage?.stoppingPower > 0 && armor.system.armorType === "hard") {
          hasHardArmor = true;
        }
      });

      // Also check cyberarmor type
      equippedItems.filter(i => i.type === "cyberware" && i.system.isArmor).forEach(cyber => {
        const coverage = cyber.system.armor?.coverage?.[loc];
        if (coverage?.stoppingPower > 0 && cyber.system.armor?.armorType === "hard") {
          hasHardArmor = true;
        }
      });

      // Determine state for background image
      let state;
      if (isLost) {
        state = 'lost';
      } else if (hasCyber) {
        const isBroken = cyberlimb?.isBroken || false;
        if (sp === 0) {
          // Exposed: use broken variant when cyberlimb is broken
          state = isBroken ? 'cyber-exposed-broken' : 'cyber-exposed';
        } else if (hasHardArmor) {
          state = isBroken ? 'cyber-hard-broken' : 'cyber-hard';
        } else {
          state = isBroken ? 'cyber-soft-broken' : 'cyber-soft';
        }
      } else {
        state = sp === 0 ? 'exposed' : (hasHardArmor ? 'hard' : 'soft');
      }

      armorState[loc] = {
        sp,
        state,
        hasCyber,
        isBroken: cyberlimb?.isBroken || false,
        cyberSdp: cyberlimb?.sdp || 0,
        cyberMaxSdp: cyberlimb?.maxSdp || 0,
        cyberItemId: cyberlimb?.itemId || null
      };
    }

    system.armorState = armorState;
  }

  /**
   * Override getRollData to add condition-based modifiers
   * @override
   */
  getRollData() {
    const data = super.getRollData();
    // Fast Draw: +3 to initiative
    data.fastDrawMod = this.statuses.has("fast-draw") ? 3 : 0;
    return data;
  }

  /**
   *
   * @param {string} sortOrder The order to sort skills by. Options are in skill-sort.js's SortModes. "Name" or "Stat". Default "Name".
   */
  reorderSkills(sortOrder = "Name") {
    let allSkills = this.itemTypes.skill;
    sortOrder = sortOrder || Object.keys(SortModes)[0];
    console.log(`Sorting skills by ${sortOrder}`);
    let sortedView = sortSkills(allSkills, SortModes[sortOrder]).map(skill => skill.id);

    this.update({
      "system.sortedSkillIDs": sortedView,
      "system.skillsSortedBy": sortOrder
    });
  }

  /**
   * Get a body type modifier from the body type stat (body)
   * @param {number} body - Body stat value
   * @returns {number} Body Type Modifier
   */
  static btm(body) {
    return bodyTypeModifier(body);
  }

  /**
   * Maximum health points (40 = 10 wound states × 4 boxes)
   * @type {number}
   */
  get maxHealth() {
    return 40;
  }

  /**
   * Current health points (maxHealth - damage)
   * @type {number}
   */
  get currentHealth() {
    return Math.max(0, this.maxHealth - (this.system.damage || 0));
  }

  /**
   * Current wound state. 0 for uninjured, going up by 1 for each new wound level.
   * 1 = Light, 2 = Serious, 3 = Critical, 4-10 = Mortal 0-6
   * @returns {number} Wound state from 0 (uninjured) to 10 (Mortal 6)
   */
  getWoundLevel() {
    const damage = this.system.damage;
    if (damage === 0) return 0;
    // Wound slots are 4 wide, so divide by 4, ceil the result, cap at 10
    return Math.min(Math.ceil(damage / 4), 10);
  }


  getStunThreshold() {
    const body = this.system.stats.bt.total;
    // +1 as Light has no penalty, but is 1 from getWoundLevel()
    return body - this.getWoundLevel() + 1;
  }

  getDeathThreshold() {
    // The first wound state to penalise is Mortal 1 instead of Serious.
    return this.getStunThreshold() + 3;
  }

  /**
   * Synchronize the wound condition on this actor's token(s) based on current damage.
   * Removes any existing wound condition and applies the appropriate one.
   * Called automatically when damage changes.
   */
  async updateWoundStatus() {
    const state = this.getWoundLevel();
    const newConditionId = WOUND_STATE_TO_CONDITION[state] || null;

    // Get current wound condition (if any)
    let currentWoundCondition = null;
    for (const id of WOUND_CONDITION_IDS) {
      if (this.statuses.has(id)) {
        currentWoundCondition = id;
        break;
      }
    }

    // If wound state hasn't changed, do nothing
    if (currentWoundCondition === newConditionId) return;

    // Remove current wound condition if present
    if (currentWoundCondition) {
      await this.toggleStatusEffect(currentWoundCondition, { active: false });
    }

    // Apply new wound condition if wounded
    if (newConditionId) {
      await this.toggleStatusEffect(newConditionId, { active: true });
    }
  }

  /** @override */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);

    // Sync wound condition when damage changes
    if (changed.system?.damage !== undefined) {
      await this.updateWoundStatus();
    }
  }

  getLearnedMartialArts() {
    return this.itemTypes.skill
      .filter(skill => skill.name.startsWith(localize("Martial")))
      .filter(martial => martial.system.level > 0)
      .map(martial => martial.name);
  }

  // TODO: Make this doable with just skill name
  static effectiveSkillLevel(skill) {
    // Sometimes we use this to sort raw item data before it becomes a full-fledged item. So we use either system or data, as needed
    if (!skill) return 0;
    const data = skill.system ?? skill;
    let value = Number(data.level) || 0;
    if (data.isChipped) value = Number(data.chipLevel) || 0;
    return value;
  }

  resolveSkillTotal(skillName) {
    const nameLoc = localize("Skill" + skillName);
    // Localization may return the original key, so we check both options
    const targetName = nameLoc.includes("Skill") ? skillName : nameLoc;

    let skillItem = this.itemTypes.skill.find(s => s.name === targetName);
    // Fallback: try original name if localized name didn't match (e.g. martial art sub-types)
    if (!skillItem && targetName !== skillName) {
      skillItem = this.itemTypes.skill.find(s => s.name === skillName);
    }
    if (!skillItem) return 0;

    // Check if this skill is chipped by equipped chipware
    const equippedChipware = this.items.contents.filter(i =>
      i.type === "cyberware" &&
      i.system.cyberwareType === "chipware" &&
      i.system.equipped
    );

    let chipValue = null;
    for (const chip of equippedChipware) {
      const bonuses = chip.system.bonuses || [];
      for (const bonus of bonuses) {
        if (bonus.type === "skill" &&
            bonus.skillName?.toLowerCase() === skillItem.name.toLowerCase() &&
            bonus.value) {
          if (chipValue === null || bonus.value > chipValue) {
            chipValue = bonus.value;
          }
        }
      }
    }

    if (chipValue !== null) return chipValue;

    // Base level + IP-earned level
    const baseLevel = Number(skillItem.system.level) || 0;
    const ipLevel = Number(skillItem.system.ipLevel) || 0;
    const totalLevel = baseLevel + ipLevel;

    // Add skill bonuses from equipped tools, drugs, and cyberware
    let skillBonus = 0;
    const equippedItems = this.items.contents.filter(i =>
      (i.type === "tool" || i.type === "drug" || i.type === "cyberware") && i.system.equipped
    );
    for (const item of equippedItems) {
      const bonuses = item.system.bonuses || [];
      for (const bonus of bonuses) {
        if (bonus.type === "skill" && bonus.value) {
          const matchByUuid = bonus.skillUuid && bonus.skillUuid === skillItem.uuid;
          const matchByName = bonus.skillName &&
            bonus.skillName.toLowerCase() === skillItem.name.toLowerCase();
          if (matchByUuid || matchByName) {
            skillBonus += bonus.value;
          }
        }
      }
    }

    return totalLevel + skillBonus;
  }

  /**
   * Skill check with Advantage / Disadvantage taken into account
   * @param {string}  skillId
   * @param {number}  extraMod
   * @param {boolean} advantage
   * @param {boolean} disadvantage
   */
  async performSkillRoll(skillId, extraMod = 0, advantage = false, disadvantage = false) {
    // Handle virtual skills (from equipped chipware)
    if (skillId.startsWith('virtual-')) {
      return this._rollVirtualSkill(skillId, extraMod, advantage, disadvantage);
    }

    const skill = this.items.get(skillId);
    if (!skill) return;

    // Action Surge: -3 penalty on all skill rolls
    const actionSurgePenalty = this.statuses.has("action-surge") ? -3 : 0;

    // Fast Draw: -3 penalty on all rolls
    const fastDrawPenalty = this.statuses.has("fast-draw") ? -3 : 0;

    // Restrained: -2 penalty on all checks
    const restrainedPenalty = this.statuses.has("restrained") ? -2 : 0;
    // Grappling: -2 penalty on all checks
    const grapplingPenalty = this.statuses.has("grappling") ? -2 : 0;

    // Awareness/Notice condition penalties (Unconscious -8, Blinded -4, Deafened -2)
    let awarenessConditionPenalty = 0;
    const awarenessSkillName = localize("SkillAwarenessNotice");
    if (skill.name === awarenessSkillName) {
      if (this.statuses.has("unconscious")) awarenessConditionPenalty -= 8;
      if (this.statuses.has("blinded")) awarenessConditionPenalty -= 4;
      if (this.statuses.has("deafened")) awarenessConditionPenalty -= 2;
    }

    // Check if this skill is chipped by equipped chipware
    const equippedChipware = this.items.contents.filter(i =>
      i.type === "cyberware" &&
      i.system.cyberwareType === "chipware" &&
      i.system.equipped
    );

    let chipValue = null;
    for (const chip of equippedChipware) {
      const bonuses = chip.system.bonuses || [];
      for (const bonus of bonuses) {
        if (bonus.type === "skill" &&
            bonus.skillName?.toLowerCase() === skill.name.toLowerCase() &&
            bonus.value) {
          // Use highest chip value if multiple chips affect same skill
          if (chipValue === null || bonus.value > chipValue) {
            chipValue = bonus.value;
          }
        }
      }
    }

    const isChipped = chipValue !== null;

    // If chipped, use chip value INSTEAD of skill level
    const skillValue = isChipped
      ? chipValue
      : CyberpunkActor.effectiveSkillLevel(skill);

    // Calculate skill bonuses from equipped tools, drugs, and cyberware (NOT applied to chipped skills)
    let skillBonus = 0;
    if (!isChipped) {
      const equippedItems = this.items.contents.filter(i =>
        (i.type === "tool" || i.type === "drug" || i.type === "cyberware") && i.system.equipped
      );
      for (const item of equippedItems) {
        const bonuses = item.system.bonuses || [];
        for (const bonus of bonuses) {
          if (bonus.type === "skill" && bonus.value) {
            // Match by UUID or by name (case-insensitive)
            const matchByUuid = bonus.skillUuid && bonus.skillUuid === skill.uuid;
            const matchByName = bonus.skillName &&
              bonus.skillName.toLowerCase() === skill.name.toLowerCase();
            if (matchByUuid || matchByName) {
              skillBonus += bonus.value;
            }
          }
        }
      }
    }

    // generate the list of modifiers
    const parts = [
      skillValue,
      skill.system.stat ? `@stats.${skill.system.stat}.total` : null,
      skill.name === localize("SkillAwarenessNotice") ? "@CombatSenseMod" : null,
      extraMod || null,
      actionSurgePenalty || null,
      fastDrawPenalty || null,
      restrainedPenalty || null,
      grapplingPenalty || null,
      awarenessConditionPenalty || null,
      skillBonus || null
    ].filter(Boolean);

    const makeRoll = () => buildD10Roll(parts, this.system);   // d10 + parts

    // if both are accidentally marked — ignore
    if (advantage && disadvantage) { advantage = disadvantage = false; }

    // Advantage / Disadvantage
    if (advantage || disadvantage) {
      const r1 = makeRoll();
      const r2 = makeRoll();

      try {
        await Promise.all([r1.evaluate(), r2.evaluate()]);
        const chosen = advantage
          ? (r1.total >= r2.total ? r1 : r2)   // best
          : (r1.total <= r2.total ? r1 : r2);  // worst

        new RollBundle(skill.name)
          .addRoll(chosen)
          .defaultExecute({ statIcon: skill.system.stat }, this);
      } catch (e) {
        console.error("CyberpunkActor: Failed to evaluate advantage/disadvantage rolls", e);
      }
      return;
    }

    // normal roll
    new RollBundle(skill.name)
      .addRoll(makeRoll())
      .defaultExecute({ statIcon: skill.system.stat }, this);
  }

  /**
   * Roll a virtual skill from equipped chipware
   * Virtual skills are skills the character doesn't own but can use via chipware
   * @param {string}  virtualId - Format: "virtual-{chipwareId}-{skillName}"
   * @param {number}  extraMod
   * @param {boolean} advantage
   * @param {boolean} disadvantage
   */
  async _rollVirtualSkill(virtualId, extraMod = 0, advantage = false, disadvantage = false) {
    // Parse virtualId: "virtual-{chipwareId}-{skillName}"
    const parts = virtualId.split('-');
    const chipwareId = parts[1];
    const skillName = parts.slice(2).join('-');

    const chipware = this.items.get(chipwareId);
    if (!chipware) {
      console.warn(`CyberpunkActor: Chipware ${chipwareId} not found for virtual skill`);
      return;
    }

    // Find the skill bonus in chipware
    const bonus = chipware.system.bonuses?.find(b =>
      b.type === "skill" && b.skillName === skillName
    );
    if (!bonus) {
      console.warn(`CyberpunkActor: Skill bonus for ${skillName} not found in chipware`);
      return;
    }

    // Use stored stat or default to ref
    const stat = bonus.skillStat || 'ref';

    // Action Surge: -3 penalty on all skill rolls
    const actionSurgePenalty = this.statuses.has("action-surge") ? -3 : 0;

    // Fast Draw: -3 penalty on all rolls
    const fastDrawPenalty = this.statuses.has("fast-draw") ? -3 : 0;

    // Restrained: -2 penalty on all checks
    const restrainedPenalty = this.statuses.has("restrained") ? -2 : 0;
    // Grappling: -2 penalty on all checks
    const grapplingPenalty = this.statuses.has("grappling") ? -2 : 0;

    // Build roll parts
    const rollParts = [
      bonus.value,
      `@stats.${stat}.total`,
      extraMod || null,
      actionSurgePenalty || null,
      fastDrawPenalty || null,
      restrainedPenalty || null,
      grapplingPenalty || null
    ].filter(Boolean);

    const makeRoll = () => buildD10Roll(rollParts, this.system);

    // if both are accidentally marked — ignore
    if (advantage && disadvantage) { advantage = disadvantage = false; }

    // Advantage / Disadvantage
    if (advantage || disadvantage) {
      const r1 = makeRoll();
      const r2 = makeRoll();

      try {
        await Promise.all([r1.evaluate(), r2.evaluate()]);
        const chosen = advantage
          ? (r1.total >= r2.total ? r1 : r2)
          : (r1.total <= r2.total ? r1 : r2);

        new RollBundle(skillName)
          .addRoll(chosen)
          .defaultExecute({ statIcon: stat }, this);
      } catch (e) {
        console.error("CyberpunkActor: Failed to evaluate advantage/disadvantage rolls", e);
      }
      return;
    }

    // normal roll
    new RollBundle(skillName)
      .addRoll(makeRoll())
      .defaultExecute({ statIcon: stat }, this);
  }

  performStatRoll(statName) {
    let fullStatName = localize(toTitleCase(statName) + "Full");

    // Action Surge: -3 penalty on all stat rolls
    const actionSurgePenalty = this.statuses.has("action-surge") ? -3 : 0;

    // Fast Draw: -3 penalty on all rolls
    const fastDrawPenalty = this.statuses.has("fast-draw") ? -3 : 0;

    // Restrained: -2 penalty on all checks
    const restrainedPenalty = this.statuses.has("restrained") ? -2 : 0;
    // Grappling: -2 penalty on all checks
    const grapplingPenalty = this.statuses.has("grappling") ? -2 : 0;

    const parts = [`@stats.${statName}.total`];
    if (actionSurgePenalty) parts.push(actionSurgePenalty);
    if (fastDrawPenalty) parts.push(fastDrawPenalty);
    if (restrainedPenalty) parts.push(restrainedPenalty);
    if (grapplingPenalty) parts.push(grapplingPenalty);

    let roll = new RollBundle(fullStatName);
    roll.addRoll(buildD10Roll(parts, this.system));
    roll.defaultExecute({ statIcon: statName }, this);
  }

  /**
   * Roll a skill check against a difficulty target
   * @param {string} skillId - The skill item ID
   * @param {number} difficulty - Target number (10, 15, 20, 25, 30)
   * @param {number} extraMod - Additional modifier (conditions + luck)
   */
  async rollSkillCheck(skillId, difficulty, extraMod = 0) {
    // Handle virtual skills from chipware
    if (skillId.startsWith('virtual-')) {
      return this._rollVirtualSkillCheck(skillId, difficulty, extraMod);
    }

    const skill = this.items.get(skillId);
    if (!skill) return;

    // Action Surge: -3 penalty on all skill rolls
    const actionSurgePenalty = this.statuses.has("action-surge") ? -3 : 0;

    // Fast Draw: -3 penalty on all rolls
    const fastDrawPenalty = this.statuses.has("fast-draw") ? -3 : 0;

    // Restrained: -2 penalty on all checks
    const restrainedPenalty = this.statuses.has("restrained") ? -2 : 0;
    // Grappling: -2 penalty on all checks
    const grapplingPenalty = this.statuses.has("grappling") ? -2 : 0;

    // Awareness/Notice condition penalties (Unconscious -8, Blinded -4, Deafened -2)
    let awarenessConditionPenalty = 0;
    const awarenessSkillName = localize("SkillAwarenessNotice");
    if (skill.name === awarenessSkillName) {
      if (this.statuses.has("unconscious")) awarenessConditionPenalty -= 8;
      if (this.statuses.has("blinded")) awarenessConditionPenalty -= 4;
      if (this.statuses.has("deafened")) awarenessConditionPenalty -= 2;
    }

    // Check if this skill is chipped by equipped chipware
    const equippedChipware = this.items.contents.filter(i =>
      i.type === "cyberware" &&
      i.system.cyberwareType === "chipware" &&
      i.system.equipped
    );

    let chipValue = null;
    for (const chip of equippedChipware) {
      const bonuses = chip.system.bonuses || [];
      for (const bonus of bonuses) {
        if (bonus.type === "skill" &&
            bonus.skillName?.toLowerCase() === skill.name.toLowerCase() &&
            bonus.value) {
          if (chipValue === null || bonus.value > chipValue) {
            chipValue = bonus.value;
          }
        }
      }
    }

    const isChipped = chipValue !== null;
    const skillValue = isChipped ? chipValue : CyberpunkActor.effectiveSkillLevel(skill);

    // Calculate skill bonuses from equipped items (NOT for chipped)
    let skillBonus = 0;
    if (!isChipped) {
      const equippedItems = this.items.contents.filter(i =>
        (i.type === "tool" || i.type === "drug" || i.type === "cyberware") && i.system.equipped
      );
      for (const item of equippedItems) {
        const bonuses = item.system.bonuses || [];
        for (const bonus of bonuses) {
          if (bonus.type === "skill" && bonus.value) {
            const matchByUuid = bonus.skillUuid && bonus.skillUuid === skill.uuid;
            const matchByName = bonus.skillName &&
              bonus.skillName.toLowerCase() === skill.name.toLowerCase();
            if (matchByUuid || matchByName) {
              skillBonus += bonus.value;
            }
          }
        }
      }
    }

    // Build roll formula parts
    const parts = [
      skillValue,
      skill.system.stat ? `@stats.${skill.system.stat}.total` : null,
      skill.name === localize("SkillAwarenessNotice") ? "@CombatSenseMod" : null,
      extraMod || null,
      actionSurgePenalty || null,
      fastDrawPenalty || null,
      restrainedPenalty || null,
      grapplingPenalty || null,
      awarenessConditionPenalty || null,
      skillBonus || null
    ].filter(Boolean);

    const roll = buildD10Roll(parts, this.system);
    await roll.evaluate();

    // Check for natural 1 on the d10
    const d10Result = roll.dice[0]?.results[0]?.result;
    const isNatural1 = d10Result === 1;

    // Determine success: natural 1 always fails, otherwise compare to difficulty
    const success = !isNatural1 && roll.total >= difficulty;

    // Create chat message
    const speaker = ChatMessage.getSpeaker({ actor: this });
    new RollBundle(skill.name)
      .addRoll(roll)
      .execute(speaker, "systems/cyberpunk/templates/chat/skill-check.hbs", {
        statIcon: skill.system.stat,
        difficulty: difficulty,
        success: success
      });

    // Roll fumble on natural 1
    if (isNatural1) {
      await this.rollFumble();
    }
  }

  /**
   * Roll a virtual skill check (from chipware) against a difficulty
   * @param {string} virtualId - Format: "virtual-{chipwareId}-{skillName}"
   * @param {number} difficulty - Target number
   * @param {number} extraMod - Additional modifier
   */
  async _rollVirtualSkillCheck(virtualId, difficulty, extraMod = 0) {
    const parts = virtualId.split('-');
    const chipwareId = parts[1];
    const skillName = parts.slice(2).join('-');

    const chipware = this.items.get(chipwareId);
    if (!chipware) return;

    const bonus = chipware.system.bonuses?.find(b =>
      b.type === "skill" && b.skillName === skillName
    );
    if (!bonus) return;

    const stat = bonus.skillStat || 'ref';
    const actionSurgePenalty = this.statuses.has("action-surge") ? -3 : 0;
    const fastDrawPenalty = this.statuses.has("fast-draw") ? -3 : 0;
    const restrainedPenalty = this.statuses.has("restrained") ? -2 : 0;
    const grapplingPenalty = this.statuses.has("grappling") ? -2 : 0;

    const rollParts = [
      bonus.value,
      `@stats.${stat}.total`,
      extraMod || null,
      actionSurgePenalty || null,
      fastDrawPenalty || null,
      restrainedPenalty || null,
      grapplingPenalty || null
    ].filter(Boolean);

    const roll = buildD10Roll(rollParts, this.system);
    await roll.evaluate();

    const d10Result = roll.dice[0]?.results[0]?.result;
    const isNatural1 = d10Result === 1;
    const success = !isNatural1 && roll.total >= difficulty;

    const speaker = ChatMessage.getSpeaker({ actor: this });
    new RollBundle(skillName)
      .addRoll(roll)
      .execute(speaker, "systems/cyberpunk/templates/chat/skill-check.hbs", {
        statIcon: stat,
        difficulty: difficulty,
        success: success
      });

    // Roll fumble on natural 1
    if (isNatural1) {
      await this.rollFumble();
    }
  }

  /**
   * Roll a stat check against a difficulty target
   * @param {string} statName - The stat key (int, ref, tech, etc.)
   * @param {number} difficulty - Target number (10, 15, 20, 25, 30)
   * @param {number} extraMod - Additional modifier (conditions + luck)
   */
  async rollStatCheck(statName, difficulty, extraMod = 0) {
    const fullStatName = localize(toTitleCase(statName) + "Full");
    const actionSurgePenalty = this.statuses.has("action-surge") ? -3 : 0;
    const fastDrawPenalty = this.statuses.has("fast-draw") ? -3 : 0;
    const restrainedPenalty = this.statuses.has("restrained") ? -2 : 0;
    const grapplingPenalty = this.statuses.has("grappling") ? -2 : 0;

    const parts = [`@stats.${statName}.total`];
    if (actionSurgePenalty) parts.push(actionSurgePenalty);
    if (fastDrawPenalty) parts.push(fastDrawPenalty);
    if (restrainedPenalty) parts.push(restrainedPenalty);
    if (grapplingPenalty) parts.push(grapplingPenalty);
    if (extraMod) parts.push(extraMod);

    const roll = buildD10Roll(parts, this.system);
    await roll.evaluate();

    const d10Result = roll.dice[0]?.results[0]?.result;
    const isNatural1 = d10Result === 1;
    const success = !isNatural1 && roll.total >= difficulty;

    const speaker = ChatMessage.getSpeaker({ actor: this });
    new RollBundle(fullStatName)
      .addRoll(roll)
      .execute(speaker, "systems/cyberpunk/templates/chat/skill-check.hbs", {
        statIcon: statName,
        difficulty: difficulty,
        success: success
      });

    // Roll fumble on natural 1
    if (isNatural1) {
      await this.rollFumble();
    }
  }

  /*
   * Adds this actor to the current encounter - if there isn't one, this just shows an error - and rolls their initiative
   */
  async enterCombatWithInitiative(modificator, options = {createCombatants: true}) {
    if(!game.combat) {
      ui.notifications.error(localize("NoCombatError"));
      return;
    }
  
    console.log(modificator);
  
    const combat = game.combat;
    let combatant = combat.combatants.find(c => c.actorId === this.id);
  
    // If no combatant found and creation is allowed, add the actor to the combat
    if (!combatant && options.createCombatants) {
      await combat.createEmbeddedDocuments("Combatant", [{ actorId: this.id }]);
      combatant = combat.combatants.find(c => c.actorId === this.id);
    }    
  
    if (!combatant) {
      ui.notifications.error(localize("NoCombatantForActor"));
      return;
    }
  
    // Roll initiative for the combatant
    return combat.rollInitiative([combatant.id]);
  }  

  /**
   * Roll a Stun Save (Shock Save)
   * Must roll UNDER the threshold to succeed
   * On failure, applies the Shocked condition
   * On success, removes the Shocked condition if present
   * @param {number} modifier - Optional modifier to the roll
   */
  async rollStunSave(modifier = 0) {
    const threshold = this.getStunThreshold();
    const roll = await new Roll(modifier ? `1d10 + ${-modifier}` : "1d10").evaluate();
    const success = roll.total < threshold;

    const speaker = ChatMessage.getSpeaker({ actor: this });

    new RollBundle(localize("ShockSave"))
      .addRoll(roll, { name: localize("Save") })
      .execute(speaker, "systems/cyberpunk/templates/chat/save-roll.hbs", {
        saveType: "shock",
        saveLabel: localize("ShockSave"),
        threshold: threshold,
        success: success,
        hint: localize("UnderThresholdMessage")
      });

    // Apply or remove Shocked condition based on result
    if (success) {
      // Remove Shocked condition on success
      if (this.statuses.has("shocked")) {
        await this.toggleStatusEffect("shocked", { active: false });
      }
    } else {
      // Apply Shocked condition on failure
      await this.toggleStatusEffect("shocked", { active: true });
    }
  }

  /**
   * Roll a Poison Save
   * Must roll UNDER the threshold to succeed
   * On failure, applies the Poisoned condition (-4 REF)
   * @param {number} modifier - Optional modifier to the roll
   */
  async rollPoisonSave(modifier = 0) {
    const threshold = this.getStunThreshold(); // Same threshold as Stun (BT-based)
    const roll = await new Roll(modifier ? `1d10 + ${modifier}` : "1d10").evaluate();
    const success = roll.total < threshold;

    const speaker = ChatMessage.getSpeaker({ actor: this });

    new RollBundle(localize("PoisonSave"))
      .addRoll(roll, { name: localize("Save") })
      .execute(speaker, "systems/cyberpunk/templates/chat/save-roll.hbs", {
        saveType: "poison",
        saveLabel: localize("PoisonSave"),
        threshold: threshold,
        success: success,
        hint: localize("UnderThresholdMessage")
      });

    // Apply or remove Poisoned condition based on result
    if (success) {
      // Remove Poisoned condition on success
      if (this.statuses.has("poisoned")) {
        await this.toggleStatusEffect("poisoned", { active: false });
      }
    } else {
      // Apply Poisoned condition on failure
      await this.toggleStatusEffect("poisoned", { active: true });
    }
  }

  /**
   * Roll a Death Save
   * Must roll UNDER the threshold to succeed
   * On failure, applies the Dead condition
   * @param {number} modifier - Optional modifier to the roll
   */
  async rollDeathSave(modifier = 0) {
    const threshold = this.getDeathThreshold();
    const roll = await new Roll(modifier ? `1d10 + ${modifier}` : "1d10").evaluate();
    const success = roll.total < threshold;

    const speaker = ChatMessage.getSpeaker({ actor: this });

    new RollBundle(localize("DeathSave"))
      .addRoll(roll, { name: localize("Save") })
      .execute(speaker, "systems/cyberpunk/templates/chat/save-roll.hbs", {
        saveType: "death",
        saveLabel: localize("DeathSave"),
        threshold: threshold,
        success: success,
        hint: localize("UnderThresholdMessage")
      });

    // Apply Dead condition on failure
    if (!success) {
      await this.toggleStatusEffect("dead", { active: true });
    }
  }

  /**
   * Roll a fumble (1d10) and display the result with narrative hint.
   * Called when a natural 1 is rolled on a skill or stat check.
   * @param {string} reliability - Optional weapon reliability: "very", "standard", or "unreliable"
   */
  async rollFumble(reliability = null) {
    const roll = await new Roll("1d10").evaluate();
    const result = roll.total;

    // Severity levels: 0=stumble, 1=loss, 2=mark, 3=turningPoint
    // Determine severity based on result and weapon reliability
    // Standard: 1-4 Stumble, 5-7 Loss, 8-9 Mark, 10 Turning Point
    // Very Reliable: 1-7 Stumble, 8-9 Loss, 10 Mark (reduced severity)
    // Unreliable: 1-4 Loss, 5-7 Mark, 8-10 Turning Point (increased severity)
    let severity;

    if (reliability === "very") {
      // Very Reliable: reduced severity (no Turning Point possible)
      if (result <= 7) {
        severity = 0; // Stumble
      } else if (result <= 9) {
        severity = 1; // Loss
      } else {
        severity = 2; // Mark
      }
    } else if (reliability === "unreliable") {
      // Unreliable: increased severity (no Stumble possible)
      if (result <= 4) {
        severity = 1; // Loss
      } else if (result <= 7) {
        severity = 2; // Mark
      } else {
        severity = 3; // Turning Point
      }
    } else {
      // Standard/default fumble table
      if (result <= 4) {
        severity = 0; // Stumble
      } else if (result <= 7) {
        severity = 1; // Loss
      } else if (result <= 9) {
        severity = 2; // Mark
      } else {
        severity = 3; // Turning Point
      }
    }

    // Map severity to hint localization key
    const severityHints = [
      localize("FumbleHint1to4"),  // 0: Stumble
      localize("FumbleHint5to7"),  // 1: Loss
      localize("FumbleHint8to9"),  // 2: Mark
      localize("FumbleHint10")     // 3: Turning Point
    ];
    const fumbleHint = severityHints[severity];

    // Get effective luck for the Roll Luck button
    const effectiveLuck = this.system.stats.luck?.effective ?? this.system.stats.luck?.total ?? 0;

    const speaker = ChatMessage.getSpeaker({ actor: this });
    new RollBundle(localize("Fumble"))
      .addRoll(roll, { name: "1d10" })
      .execute(speaker, "systems/cyberpunk/templates/chat/fumble.hbs", {
        fumbleHint: fumbleHint,
        actorId: this.id,
        severity: severity,
        effectiveLuck: effectiveLuck,
        canRollLuck: effectiveLuck > 0 && severity > 0  // Can't reduce below stumble
      });
  }

  /**
   * Roll Initiative and display in chat
   * Uses REF stat + 1d10
   */
  async performInitiativeRoll() {
    const ref = this.system.stats.ref.total;
    const roll = await new Roll(`1d10 + ${ref}`).evaluate();

    const speaker = ChatMessage.getSpeaker({ actor: this });

    new RollBundle(localize("InitiativeRoll"))
      .addRoll(roll, { name: "1d10" })
      .execute(speaker, "systems/cyberpunk/templates/chat/initiative.hbs", {
        refValue: ref
      });

    return roll.total;
  }
}
