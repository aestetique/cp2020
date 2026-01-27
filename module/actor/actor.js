import { makeD10Roll, Multiroll } from "../dice.js";
import { SortOrders, sortSkills } from "./skill-sort.js";
import { btmFromBT } from "../lookups.js";
import { properCase, localize } from "../utils.js"
import { WOUND_CONDITION_IDS, WOUND_STATE_TO_CONDITION } from "../conditions.js"

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class CyberpunkActor extends Actor {


  /** @override */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    if (data.type === "character") {
      this.updateSource({
        img: "systems/cp2020/img/svg/placeholder-character.svg",
        "prototypeToken.texture.src": "systems/cp2020/img/svg/placeholder-character.svg",
        "prototypeToken.actorLink": true,
        "prototypeToken.sight.enabled": true,
        "system.icon": "systems/cp2020/img/svg/placeholder-character.svg",
        "system.skillsSortedBy": "Name"
      });
    }
  }

  /**
   * Augment the basic actor data with additional dynamic data - the stuff that's calculated from other data
   */
  prepareData() {
    super.prepareData();
    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    switch ( this.type ) {
      // NPCs are exactly the same as characters at the moment, but don't get vision or default actorlink
      case "npc":
      case "character":
        this._prepareCharacterData(this.system);
        break;
    }
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(system) {
    const stats = system.stats;
    // Calculate stat totals using base+temp
    for(const stat of Object.values(stats)) {
      stat.total = stat.base + stat.tempMod;
    }
    // A lookup for translating hit rolls to names of hit locations
    // I know that for ranges there are better data structures to lookup, but we're using d10s for hit locations, so it's no issue
    system.hitLocLookup = {};
    for(const hitLoc in system.hitLocations) {
      let area = system.hitLocations[hitLoc]
      area.stoppingPower = 0;
      let [start, end] = area.location;
      // Just one die number that'll hit the location
      if(!end) {
        system.hitLocLookup[start] = hitLoc;
      }
      // A range of die numbers that'll hit the location
      else {
        for(let i = start; i <= end; i++) {
          system.hitLocLookup[i] = hitLoc;
        }
      }
    }
    
    // Sort through this now so we don't have to later
    let equippedItems = this.items.contents.filter(item => {
      return item.system.equipped;
    });

    // Reflex is affected by encumbrance values too
    stats.ref.armorMod = 0;
    equippedItems.filter(i => i.type === "armor").forEach(armor => {
      let armorData = armor.system;
      if(armorData.encumbrance != null) {
        stats.ref.armorMod -= armorData.encumbrance;
      }

      // While we're looping through armor, might as well modify hit locations' armor
      // I. Version of the direct addition of armor. In the future, can add it as an additional option in the settings
      // for(let armorArea in armorData.coverage) {
      //   let location = system.hitLocations[armorArea];
      //   if(location !== undefined) {
      //     armorArea = armorData.coverage[armorArea];
      //     // Converting both values to numbers before adding
      //     location.stoppingPower = Number(location.stoppingPower) + Number(armorArea.stoppingPower);
      //   }
      // }
      
      // II. The version of the addition of armor according to the rule book
      for(let armorArea in armorData.coverage) {
        let location = system.hitLocations[armorArea];
        if(location !== undefined) {
          let armorCoverage = armorData.coverage[armorArea];
            let armorMaxSP = Number(armorCoverage.stoppingPower) || 0;
            let armorAblation = Number(armorCoverage.ablation) || 0;
            let locationStoppingPower = Number(location.stoppingPower);
            let armorStoppingPower = Math.max(0, armorMaxSP - armorAblation);

            // If there is no armor on one of the zones, just add armor
            if(locationStoppingPower === 0 || armorStoppingPower === 0) {
                location.stoppingPower = locationStoppingPower + armorStoppingPower;
            } else {
                // If the armor is already on, we count it according to the modification table
                let difference = Math.abs(locationStoppingPower - armorStoppingPower);
                let maxValue = Math.max(locationStoppingPower, armorStoppingPower);
                let modifier = 0;

                if (difference >= 27) modifier = 0;
                else if (difference >= 21) modifier = 2;
                else if (difference >= 15) modifier = 3;
                else if (difference >= 9) modifier = 3;
                else if (difference >= 5) modifier = 4;
                else modifier = 5;

                // Adding the modifier to the highest value
                location.stoppingPower = maxValue + modifier;
            }
        }
      }

    });
    stats.ref.total = stats.ref.base + stats.ref.tempMod + stats.ref.armorMod;

    const move = stats.ma;
    move.run = move.total * 3;
    move.leap = Math.floor(move.run / 4); 

    const body = stats.bt;
    body.carry = body.total * 10;
    body.lift = body.total * 40;
    body.modifier = btmFromBT(body.total);
    system.carryWeight = 0;
    equippedItems.forEach(item => {
      let weight = item.system.weight || 0;
      system.carryWeight += parseFloat(weight);
    });

    // Apply wound effects
    // Change stat total, but leave a record of the difference in stats.[statName].woundMod
    // Modifies the very-end-total, idk if this'll need to change in the future
    let woundState = this.woundState();
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
    // calculate and configure the humanity
    const emp = stats.emp;
    emp.humanity = {base: emp.base * 10};
    // calculate total HL from cyberware
    let hl = 0;
    equippedItems.filter(i => i.type === "cyberware").forEach(cyberware => {
      const cyber = cyberware.system;
      hl += (cyber.humanityLoss) ? cyber.humanityLoss : 0;
    });

    emp.humanity.loss = hl;
    // calculate current Humanity and current EMP
    emp.humanity.total = emp.humanity.base - emp.humanity.loss;
    emp.total = emp.base + emp.tempMod - Math.floor(emp.humanity.loss/10);

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

      // Determine state for background image
      let state;
      if (isLost) {
        state = 'lost';
      } else if (hasCyber) {
        state = sp === 0 ? 'cyber-exposed' : (hasHardArmor ? 'cyber-hard' : 'cyber-soft');
      } else {
        state = sp === 0 ? 'exposed' : (hasHardArmor ? 'hard' : 'soft');
      }

      armorState[loc] = {
        sp,
        state,
        hasCyber,
        cyberSdp: cyberlimb?.sdp || 0
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
   * @param {string} sortOrder The order to sort skills by. Options are in skill-sort.js's SortOrders. "Name" or "Stat". Default "Name".
   */
  sortSkills(sortOrder = "Name") {
    let allSkills = this.itemTypes.skill;
    sortOrder = sortOrder || Object.keys(SortOrders)[0];
    console.log(`Sorting skills by ${sortOrder}`);
    let sortedView = sortSkills(allSkills, SortOrders[sortOrder]).map(skill => skill.id);

    // Technically UI info, but we don't wanna calc every time we open a sheet so store it in the actor.
    this.update({
      // Why is it that when storing Item: {data: {data: {innerdata}}}, it comes out as {data: {innerdata}}
      "system.sortedSkillIDs": sortedView,
      "system.skillsSortedBy": sortOrder
    });
  }

  /**
   * Get a body type modifier from the body type stat (body)
   * I couldn't figure out a single formula that'd work for it (cos of the weird widths of BT values)
   */
  static btm(body) {
    
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
  woundState() {
    const damage = this.system.damage;
    if (damage === 0) return 0;
    // Wound slots are 4 wide, so divide by 4, ceil the result, cap at 10
    return Math.min(Math.ceil(damage / 4), 10);
  }


  stunThreshold() {
    const body = this.system.stats.bt.total;
    // +1 as Light has no penalty, but is 1 from woundState()
    return body - this.woundState() + 1;
  }

  deathThreshold() {
    // The first wound state to penalise is Mortal 1 instead of Serious.
    return this.stunThreshold() + 3;
  }

  /**
   * Synchronize the wound condition on this actor's token(s) based on current damage.
   * Removes any existing wound condition and applies the appropriate one.
   * Called automatically when damage changes.
   */
  async syncWoundCondition() {
    const state = this.woundState();
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
      await this.syncWoundCondition();
    }
  }

  trainedMartials() {
    return this.itemTypes.skill
      .filter(skill => skill.name.startsWith(localize("Martial")))
      .filter(martial => martial.system.level > 0)
      .map(martial => martial.name);
  }

  // TODO: Make this doable with just skill name
  static realSkillValue(skill) {
    // Sometimes we use this to sort raw item data before it becomes a full-fledged item. So we use either system or data, as needed
    if (!skill) return 0;
    const data = skill.system ?? skill;
    let value = Number(data.level) || 0;
    if (data.isChipped) value = Number(data.chipLevel) || 0;
    return value;
  }

  getSkillVal(skillName) {
    console.log("SkillName:", skillName);
    console.log("SkillName_localize:", localize("Skill"+skillName));
    console.log("lang:", game.i18n);

    const nameLoc = localize("Skill" + skillName);
    // Localization may return the original key, so we check both options
    const targetName = nameLoc.includes("Skill") ? skillName : nameLoc;

    const skillItem = this.itemTypes.skill.find(s => s.name === targetName);
    if (!skillItem) return 0; // ← no skill — return 0 instead of undefined
    return CyberpunkActor.realSkillValue(skillItem);
  }

  /**
   * Skill check with Advantage / Disadvantage taken into account
   * @param {string}  skillId
   * @param {number}  extraMod
   * @param {boolean} advantage
   * @param {boolean} disadvantage
   */
  rollSkill(skillId, extraMod = 0, advantage = false, disadvantage = false) {
    const skill = this.items.get(skillId);
    if (!skill) return;

    // Action Surge: -3 penalty on all skill rolls
    const actionSurgePenalty = this.statuses.has("action-surge") ? -3 : 0;

    // generate the list of modifiers
    const parts = [
      CyberpunkActor.realSkillValue(skill),
      skill.system.stat ? `@stats.${skill.system.stat}.total` : null,
      skill.name === localize("SkillAwarenessNotice") ? "@CombatSenseMod" : null,
      extraMod || null,
      actionSurgePenalty || null
    ].filter(Boolean);

    const makeRoll = () => makeD10Roll(parts, this.system);   // d10 + parts

    // if both are accidentally marked — ignore
    if (advantage && disadvantage) { advantage = disadvantage = false; }

    // Advantage / Disadvantage
    if (advantage || disadvantage) {
      const r1 = makeRoll();
      const r2 = makeRoll();

      Promise.all([
        r1.evaluate(),
        r2.evaluate()
      ]).then(() => {
        const chosen = advantage
          ? (r1.total >= r2.total ? r1 : r2)   // best
          : (r1.total <= r2.total ? r1 : r2);  // worst

        new Multiroll(skill.name)
          .addRoll(chosen)
          .defaultExecute({ statIcon: skill.system.stat }, this);
      });
      return;
    }

    // normal roll
    new Multiroll(skill.name)
      .addRoll(makeRoll())
      .defaultExecute({ statIcon: skill.system.stat }, this);
  }

  rollStat(statName) {
    let fullStatName = localize(properCase(statName) + "Full");

    // Action Surge: -3 penalty on all stat rolls
    const actionSurgePenalty = this.statuses.has("action-surge") ? -3 : 0;

    const parts = [`@stats.${statName}.total`];
    if (actionSurgePenalty) parts.push(actionSurgePenalty);

    let roll = new Multiroll(fullStatName);
    roll.addRoll(makeD10Roll(parts, this.system));
    roll.defaultExecute({ statIcon: statName }, this);
  }

  /*
   * Adds this actor to the current encounter - if there isn't one, this just shows an error - and rolls their initiative
   */
  async addToCombatAndRollInitiative(modificator, options = {createCombatants: true}) {
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
    const threshold = this.stunThreshold();
    const roll = await new Roll(modifier ? `1d10 + ${modifier}` : "1d10").evaluate();
    const success = roll.total < threshold;

    const speaker = ChatMessage.getSpeaker({ actor: this });

    new Multiroll(localize("ShockSave"))
      .addRoll(roll, { name: localize("Save") })
      .execute(speaker, "systems/cp2020/templates/chat/save-roll.hbs", {
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
   * Roll a Death Save
   * Must roll UNDER the threshold to succeed
   * On failure, applies the Dead condition
   * @param {number} modifier - Optional modifier to the roll
   */
  async rollDeathSave(modifier = 0) {
    const threshold = this.deathThreshold();
    const roll = await new Roll(modifier ? `1d10 + ${modifier}` : "1d10").evaluate();
    const success = roll.total < threshold;

    const speaker = ChatMessage.getSpeaker({ actor: this });

    new Multiroll(localize("DeathSave"))
      .addRoll(roll, { name: localize("Save") })
      .execute(speaker, "systems/cp2020/templates/chat/save-roll.hbs", {
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
   * Roll Initiative and display in chat
   * Uses REF stat + 1d10
   */
  async rollInitiativeChat() {
    const ref = this.system.stats.ref.total;
    const roll = await new Roll(`1d10 + ${ref}`).evaluate();

    const speaker = ChatMessage.getSpeaker({ actor: this });

    new Multiroll(localize("InitiativeRoll"))
      .addRoll(roll, { name: "1d10" })
      .execute(speaker, "systems/cp2020/templates/chat/initiative.hbs", {
        refValue: ref
      });

    return roll.total;
  }
}
