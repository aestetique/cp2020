import { martialOptions, meleeAttackTypes, meleeBonkOptions, meleeDamageTypes, rangedModifiers, weaponTypes, reliability, concealability, ammoWeaponTypes, ammoCalibersByWeaponType, ammoTypes, ammoAbbreviations, weaponToAmmoType, ordnanceTemplateTypes, exoticEffects, toolBonusProperties, cyberwareSubtypes, surgeryCodes, getCyberwareSubtypes } from "../lookups.js"
import { localize, localizeParam, tabBeautifying } from "../utils.js"
import { ModifiersDialog } from "../dialog/modifiers.js"
import { ReloadDialog } from "../dialog/reload-dialog.js"
import { SortOrders } from "./skill-sort.js";

/**
 * Extend the basic ActorSheet with custom character sheet layout
 * @extends {ActorSheet}
 */
export class CyberpunkActorSheet extends ActorSheet {

  /**
   * Lock state for the sheet (locked = view mode, unlocked = edit mode)
   * @type {boolean}
   */
  _isLocked = true;

  /**
   * Preserved scroll position for gear container
   * @type {number}
   */
  _gearScrollTop = 0;

  /**
   * Preserved scroll position for cyberware container
   * @type {number}
   */
  _cyberwareScrollTop = 0;

  /**
   * Minimized state for the sheet
   * @type {boolean}
   */
  _isMinimized = false;

  /**
   * Original dimensions before minimizing (to restore when maximizing)
   * @type {number|null}
   */
  _originalWidth = null;
  _originalHeight = null;
  _originalFoundryWidth = null;
  _originalFoundryHeight = null;

  /**
   * Static map to remember sheet heights per actor
   * @type {Map<string, number>}
   */
  static _sheetHeights = new Map();

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cyberpunk", "sheet", "actor", "character-sheet"],
      template: "systems/cp2020/templates/actor/actor-sheet.hbs",
      width: 930,
      height: 624,
      resizable: true,
      tabs: [{ navSelector: ".tab-selector", contentSelector: ".sheet-details", initial: "skills" }]
    });
  }

  /* -------------------------------------------- */

  /**
   * Override setPosition to remember the sheet height
   * @override
   */
  setPosition(position = {}) {
    // If height is being set (from resize), remember it
    if (position.height) {
      CyberpunkActorSheet._sheetHeights.set(this.actor.id, position.height);
    }
    return super.setPosition(position);
  }

  /* -------------------------------------------- */

  /**
   * Override _render to preserve scroll positions across re-renders
   * Scroll is SAVED in click handlers (before update), RESTORED here (after render)
   * @override
   */
  async _render(force = false, options = {}) {
    // Save scroll positions BEFORE re-render from the correct elements (.tab, not inner containers)
    if (this.rendered && this.element?.length) {
      const gearTab = this.element.find('.tab.gear')[0];
      const cyberTab = this.element.find('.tab.cyber')[0];
      if (gearTab) this._gearScrollTop = gearTab.scrollTop;
      if (cyberTab) this._cyberwareScrollTop = cyberTab.scrollTop;
    }

    // On first render, use remembered height or default minimum
    if (!this.rendered) {
      const rememberedHeight = CyberpunkActorSheet._sheetHeights.get(this.actor.id);
      if (rememberedHeight) {
        options.height = rememberedHeight;
      } else {
        // First time opening - use minimum height
        options.height = this.constructor.defaultOptions.height;
      }
    }

    const result = await super._render(force, options);

    // Restore scroll positions AFTER render completes
    if (this.element?.length) {
      const gearTab = this.element.find('.tab.gear')[0];
      const cyberTab = this.element.find('.tab.cyber')[0];
      if (gearTab && this._gearScrollTop) {
        gearTab.scrollTop = this._gearScrollTop;
      }
      if (cyberTab && this._cyberwareScrollTop) {
        cyberTab.scrollTop = this._cyberwareScrollTop;
      }
    }

    return result;
  }

  /* -------------------------------------------- */

  /**
   * Toggle the lock state of the sheet
   */
  toggleLock() {
    this._isLocked = !this._isLocked;
    this.render(false);
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options) {
    const sheetData = super.getData(options);
    const actor = this.actor;
    const system = actor.system;

    sheetData.system = system;

    // Lock state for template
    sheetData.isLocked = this._isLocked;

    // Only proceed with character type
    if (actor.type === 'character') {
      // Initialize transient data for skill filtering
      if (system.transient == null) {
        system.transient = { skillFilter: "" };
      }

      // Prepare character-related items and data
      this._prepareCharacterItems(sheetData);
      this._addWoundTrack(sheetData);
      this._prepareSkills(sheetData);
      this._prepareGearData(sheetData);
      this._prepareCyberwareData(sheetData);

      sheetData.weaponTypes = weaponTypes;

      // Role data for template - fetch current name from role item
      sheetData.roleUuid = system.role?.uuid || "";
      if (sheetData.roleUuid) {
        const roleItem = fromUuidSync(sheetData.roleUuid);
        sheetData.roleLabel = roleItem?.name || game.i18n.localize("CYBERPUNK.NoRoleSelected");
      } else {
        sheetData.roleLabel = game.i18n.localize("CYBERPUNK.NoRoleSelected");
      }

      // Calculate totals for the action buttons
      const refTotal = system.stats?.ref?.total || system.stats?.ref?.base || 0;
      const btTotal = system.stats?.bt?.total || system.stats?.bt?.base || 0;
      const combatSenseMod = system.CombatSenseMod || 0;
      const fastDrawMod = actor.statuses?.has("fast-draw") ? 3 : 0;

      // Initiative total: REF + Combat Sense + Initiative Mod + Fast Draw
      const initiativeMod = foundry.utils.getProperty(system, "initiativeMod") || 0;
      sheetData.initiativeMod = initiativeMod;
      sheetData.initiativeTotal = refTotal + combatSenseMod + initiativeMod + fastDrawMod;

      // Calculate effective thresholds (using actor methods)
      const stunThreshold = actor.stunThreshold();
      const deathThreshold = actor.deathThreshold();

      // Stun Save: threshold + Stun Save Mod
      const stunSaveMod = foundry.utils.getProperty(system, "stunSaveMod") || 0;
      sheetData.stunSaveMod = stunSaveMod;
      sheetData.stunSaveTotal = stunThreshold + stunSaveMod;

      // Poison Save: same threshold as Stun + Poison Save Mod
      const poisonSaveMod = foundry.utils.getProperty(system, "poisonSaveMod") || 0;
      sheetData.poisonSaveMod = poisonSaveMod;
      sheetData.poisonSaveTotal = stunThreshold + poisonSaveMod;

      // Death Save: death threshold + Death Save Mod
      const deathSaveMod = foundry.utils.getProperty(system, "deathSaveMod") || 0;
      sheetData.deathSaveMod = deathSaveMod;
      sheetData.deathSaveTotal = deathThreshold + deathSaveMod;

      // Overriding B.T to body and M.A to Move so it matches the design
      const stats = system.stats || {};
      const getStatLabel = (key) => {
        const overrides = { 'bt': 'body', 'ma': 'move' };
        return overrides[key] || game.i18n.localize(`CYBERPUNK.${key.charAt(0).toUpperCase() + key.slice(1)}`);
      };
      
      sheetData.statButtons = [
        { key: 'int', label: getStatLabel('int'), total: stats.int?.total ?? stats.int?.base ?? 0, base: stats.int?.base ?? 0, path: 'system.stats.int.base' },
        { key: 'ref', label: getStatLabel('ref'), total: stats.ref?.total ?? stats.ref?.base ?? 0, base: stats.ref?.base ?? 0, path: 'system.stats.ref.base' },
        { key: 'tech', label: getStatLabel('tech'), total: stats.tech?.total ?? stats.tech?.base ?? 0, base: stats.tech?.base ?? 0, path: 'system.stats.tech.base' },
        { key: 'cool', label: getStatLabel('cool'), total: stats.cool?.total ?? stats.cool?.base ?? 0, base: stats.cool?.base ?? 0, path: 'system.stats.cool.base' },
        { key: 'attr', label: getStatLabel('attr'), total: stats.attr?.total ?? stats.attr?.base ?? 0, base: stats.attr?.base ?? 0, path: 'system.stats.attr.base' },
        { key: 'bt', label: getStatLabel('bt'), total: stats.bt?.total ?? stats.bt?.base ?? 0, base: stats.bt?.base ?? 0, path: 'system.stats.bt.base' },
        { key: 'emp', label: getStatLabel('emp'), total: stats.emp?.total ?? stats.emp?.base ?? 0, base: stats.emp?.base ?? 0, path: 'system.stats.emp.base' },
        { key: 'ma', label: getStatLabel('ma'), total: stats.ma?.total ?? stats.ma?.base ?? 0, base: stats.ma?.base ?? 0, path: 'system.stats.ma.base' },
        { key: 'luck', label: getStatLabel('luck'), total: stats.luck?.total ?? stats.luck?.base ?? 0, base: stats.luck?.base ?? 0, path: 'system.stats.luck.base' }
      ];

      // Wound blocks data for template
      const damage = system.damage || 0;
      const woundLabels = ['light', 'serious', 'critical', 'mortal 0', 'mortal 1', 'mortal 2', 'mortal 3', 'mortal 4', 'mortal 5', 'mortal 6'];

      sheetData.woundBlocks = woundLabels.map((label, blockIndex) => {
        const blockStart = blockIndex * 4 + 1; // 1-4, 5-8, 9-12, etc.
        const hasWound = damage >= blockStart; // At least one dot filled in this block

        const dots = [];
        for (let i = 0; i < 4; i++) {
          const dotDamage = blockStart + i;
          dots.push({
            damage: dotDamage,
            state: damage >= dotDamage ? 'taken' : 'fresh'
          });
        }

        return { label, hasWound, dots };
      });

      // Humanity blocks data for template
      const emp = stats.emp || {};
      const humanityBase = (emp.base || 0) * 10; // EMP * 10 = max humanity
      const humanityTotal = emp.humanity?.total ?? humanityBase;
      const humanityLimit = humanityBase; // Max humanity based on EMP

      sheetData.humanityBlocks = [];
      for (let blockIndex = 0; blockIndex < 10; blockIndex++) {
        const blockLabel = (blockIndex + 1) * 10; // 10, 20, 30, ... 100
        const blockStart = blockIndex * 10; // 0, 10, 20, ... 90
        const active = humanityTotal > blockStart && blockStart < humanityLimit;
        const disabled = blockStart >= humanityLimit;

        const dots = [];
        for (let i = 0; i < 4; i++) {
          const dotValue = blockStart + (i + 1) * 2.5; // 2.5, 5, 7.5, 10 within each block
          let image;

          if (dotValue > humanityLimit) {
            image = 'off';
          } else if (humanityTotal >= dotValue) {
            image = '100'; // Full dot
          } else if (humanityTotal >= dotValue - 0.5) {
            image = '80';
          } else if (humanityTotal >= dotValue - 1) {
            image = '60';
          } else if (humanityTotal >= dotValue - 1.5) {
            image = '40';
          } else if (humanityTotal >= dotValue - 2) {
            image = '20';
          } else {
            image = '0'; // Empty/lost
          }

          // A dot is "lost" if it's not fully filled (any damage at all)
          // For restoration: clicking a lost dot will restore humanity to that value
          const isLost = image !== '100' && image !== 'off';

          dots.push({
            value: dotValue,
            image,
            disabled: dotValue > humanityLimit,
            lost: isLost
          });
        }

        sheetData.humanityBlocks.push({
          label: blockLabel,
          active,
          disabled,
          dots
        });
      }

      // Info blocks data for template
      const ma = stats.ma || {};
      const bt = stats.bt || {};
      const info = system.info || {};

      sheetData.infoBlocks = [
        { key: 'walk', label: 'Walk', displayValue: `${ma.total ?? 0} m`, editable: false },
        { key: 'run', label: 'Run', displayValue: `${ma.run ?? 0} m`, editable: false },
        { key: 'leap', label: 'Leap', displayValue: `${ma.leap ?? 0} m`, editable: false },
        { key: 'carry', label: 'Carry', displayValue: `${bt.carry ?? 0} kg`, editable: false },
        { key: 'lift', label: 'Lift', displayValue: `${bt.lift ?? 0} kg`, editable: false },
        { key: 'weight', label: 'Weight', displayValue: `${info.weight ?? 70} kg`, rawValue: info.weight ?? 70, path: 'system.info.weight', editable: true },
        { key: 'height', label: 'Height', displayValue: `${info.height ?? 170} cm`, rawValue: info.height ?? 170, path: 'system.info.height', editable: true },
        { key: 'age', label: 'Age', displayValue: `${info.age ?? 25}`, rawValue: info.age ?? 25, path: 'system.info.age', editable: true }
      ];

      // Character creation point tracking (for unlock mode)
      // Character Points: sum of all base attribute values
      const charPoints = Object.values(stats).reduce((sum, stat) => {
        return sum + (stat?.base ?? 0);
      }, 0);
      sheetData.charPoints = charPoints;

      // Career and Pickup points from skills
      const role = system.role;
      const allSkills = this.actor.itemTypes.skill || [];
      const careerSkillNames = new Set();
      if (role?.uuid) {
        const roleItem = fromUuidSync(role.uuid);
        if (roleItem?.system?.careerSkills) {
          roleItem.system.careerSkills.forEach(s => {
            const name = typeof s === 'string' ? s : s.name;
            careerSkillNames.add(name.toLowerCase());
          });
        }
        if (roleItem?.system?.specialSkill?.name) {
          careerSkillNames.add(roleItem.system.specialSkill.name.toLowerCase());
        }
      }

      let careerPoints = 0;
      let pickupPoints = 0;
      allSkills.forEach(skill => {
        const baseLevel = skill.system.level || 0;
        if (careerSkillNames.has(skill.name.toLowerCase())) {
          careerPoints += baseLevel;
        } else {
          pickupPoints += baseLevel;
        }
      });

      sheetData.careerPoints = careerPoints;
      sheetData.pickupPoints = pickupPoints;
      sheetData.pickupMax = (stats.int?.base ?? 0) + (stats.ref?.base ?? 0);

      // Armor blocks data for template
      const hitLocs = system.hitLocations || {};
      const armorState = system.armorState || {};
      const cyberlimbs = system.cyberlimbs || {};
      const btm = stats.bt?.modifier || 0;

      sheetData.armorBlocks = {
        lArm: {
          key: 'larm',
          sp: hitLocs.lArm?.stoppingPower || 0,
          sdp: cyberlimbs.lArm?.sdp || 0,
          maxSdp: cyberlimbs.lArm?.maxSdp || 0,
          hasCyber: cyberlimbs.lArm?.hasCyberlimb || false,
          isBroken: cyberlimbs.lArm?.isBroken || false,
          isDamaged: cyberlimbs.lArm?.sdp > 0 && cyberlimbs.lArm?.sdp < cyberlimbs.lArm?.maxSdp,
          state: armorState.lArm?.state || 'exposed',
          isLost: armorState.lArm?.state === 'lost'
        },
        lLeg: {
          key: 'lleg',
          sp: hitLocs.lLeg?.stoppingPower || 0,
          sdp: cyberlimbs.lLeg?.sdp || 0,
          maxSdp: cyberlimbs.lLeg?.maxSdp || 0,
          hasCyber: cyberlimbs.lLeg?.hasCyberlimb || false,
          isBroken: cyberlimbs.lLeg?.isBroken || false,
          isDamaged: cyberlimbs.lLeg?.sdp > 0 && cyberlimbs.lLeg?.sdp < cyberlimbs.lLeg?.maxSdp,
          state: armorState.lLeg?.state || 'exposed',
          isLost: armorState.lLeg?.state === 'lost'
        },
        Head: {
          key: 'head',
          sp: hitLocs.Head?.stoppingPower || 0,
          state: armorState.Head?.state || 'exposed'
        },
        Torso: {
          key: 'torso',
          sp: hitLocs.Torso?.stoppingPower || 0,
          state: armorState.Torso?.state || 'exposed'
        },
        btm: btm,
        rArm: {
          key: 'rarm',
          sp: hitLocs.rArm?.stoppingPower || 0,
          sdp: cyberlimbs.rArm?.sdp || 0,
          maxSdp: cyberlimbs.rArm?.maxSdp || 0,
          hasCyber: cyberlimbs.rArm?.hasCyberlimb || false,
          isBroken: cyberlimbs.rArm?.isBroken || false,
          isDamaged: cyberlimbs.rArm?.sdp > 0 && cyberlimbs.rArm?.sdp < cyberlimbs.rArm?.maxSdp,
          state: armorState.rArm?.state || 'exposed',
          isLost: armorState.rArm?.state === 'lost'
        },
        rLeg: {
          key: 'rleg',
          sp: hitLocs.rLeg?.stoppingPower || 0,
          sdp: cyberlimbs.rLeg?.sdp || 0,
          maxSdp: cyberlimbs.rLeg?.maxSdp || 0,
          hasCyber: cyberlimbs.rLeg?.hasCyberlimb || false,
          isBroken: cyberlimbs.rLeg?.isBroken || false,
          isDamaged: cyberlimbs.rLeg?.sdp > 0 && cyberlimbs.rLeg?.sdp < cyberlimbs.rLeg?.maxSdp,
          state: armorState.rLeg?.state || 'exposed',
          isLost: armorState.rLeg?.state === 'lost'
        }
      };
    }

    // Collect all programs
    const allPrograms = this.actor.items.filter(i => i.type === "program");
    allPrograms.sort((a, b) => a.name.localeCompare(b.name));
    sheetData.netrunPrograms = allPrograms;
    sheetData.programsTotalCost = allPrograms.reduce((sum, p) => sum + Number(p.system.cost || 0), 0);

    // Active programs
    const activeProgIds = this.actor.system.activePrograms || [];
    const activePrograms = allPrograms.filter(p => activeProgIds.includes(p.id));
    sheetData.netrunActivePrograms = activePrograms;

    // Interface skill
    const allSkills = this.actor.items.filter(i => i.type === "skill");
    const interfaceName = game.i18n.localize("CYBERPUNK.SkillInterface");
    let interfaceItem = allSkills.find(i => i.name === interfaceName);

    let interfaceValue = 0;
    let interfaceItemId = null;
    if (interfaceItem) {
      interfaceValue = Number(interfaceItem.system?.level || 0);
      interfaceItemId = interfaceItem.id;
    }

    sheetData.interfaceSkill = {
      value: interfaceValue,
      itemId: interfaceItemId
    };

    return sheetData;
  }

  _prepareSkills(sheetData) {
    const skills = this.actor.items.filter(i => i.type === "skill");
    const role = this.actor.system.role;

    // Stat label mapping
    const statLabels = {
      int: 'INT',
      ref: 'REF',
      tech: 'TECH',
      cool: 'COOL',
      attr: 'ATTR',
      bt: 'BODY',
      emp: 'EMP',
      ma: 'MA',
      luck: 'LUCK'
    };

    // Get career skill names and special skill from role
    const careerSkillNames = new Set();
    let specialSkillName = null;
    if (role?.uuid) {
      const roleItem = fromUuidSync(role.uuid);
      if (roleItem?.system?.careerSkills) {
        roleItem.system.careerSkills.forEach(s => {
          const name = typeof s === 'string' ? s : s.name;
          careerSkillNames.add(name.toLowerCase());
        });
      }
      if (roleItem?.system?.specialSkill?.name) {
        specialSkillName = roleItem.system.specialSkill.name.toLowerCase();
      }
    }

    // Get equipped tools, drugs, and cyberware for skill bonus calculation
    const equippedWithBonuses = this.actor.items.contents.filter(i =>
      (i.type === "tool" || i.type === "drug" || i.type === "cyberware") && i.system.equipped
    );

    // Get equipped chipware with skill effects for chipping mechanic
    const equippedChipware = this.actor.items.contents.filter(i =>
      i.type === "cyberware" &&
      i.system.cyberwareType === "chipware" &&
      i.system.equipped
    );

    // Build chipped skills map: skillName (lowercase) -> { chipValue, chipwareId, skillStat }
    const chippedSkillsMap = new Map();
    const virtualSkillsData = []; // Skills from chipware not owned by character

    for (const chip of equippedChipware) {
      const bonuses = chip.system.bonuses || [];
      for (const bonus of bonuses) {
        if (bonus.type === "skill" && bonus.skillName && bonus.value) {
          const skillNameLower = bonus.skillName.toLowerCase();
          // Check if character has this skill
          const ownedSkill = skills.find(s => s.name.toLowerCase() === skillNameLower);

          if (ownedSkill) {
            // Mark existing skill as chipped (use highest chip value if multiple)
            const existing = chippedSkillsMap.get(skillNameLower);
            if (!existing || bonus.value > existing.chipValue) {
              chippedSkillsMap.set(skillNameLower, {
                chipValue: bonus.value,
                chipwareId: chip.id,
                skillStat: bonus.skillStat || ownedSkill.system.stat || 'ref'
              });
            }
          } else {
            // Create virtual skill entry for display
            virtualSkillsData.push({
              id: `virtual-${chip.id}-${bonus.skillName}`,
              name: bonus.skillName,
              chipValue: bonus.value,
              chipwareId: chip.id,
              stat: bonus.skillStat || 'ref'
            });
          }
        }
      }
    }

    // Categorize and prepare skills
    const preparedSkills = skills.map(skill => {
      const skillNameLower = skill.name.toLowerCase();
      const isCareer = careerSkillNames.has(skillNameLower);
      // Special icon only shows if skill name matches the role's special skill
      const isSpecial = specialSkillName && skillNameLower === specialSkillName;

      // Check if this skill is chipped by equipped chipware
      const chipInfo = chippedSkillsMap.get(skillNameLower);
      const isChipped = !!chipInfo;

      // Base level (manually set) and IP-earned level
      const baseLevel = skill.system.level || 0;
      const ipLevel = skill.system.ipLevel || 0;
      const totalLevel = baseLevel + ipLevel;

      // When chipped, chip value OVERRIDES learned level entirely
      const effectiveLevel = isChipped ? chipInfo.chipValue : totalLevel;

      const diffMod = skill.system.diffMod || 1;
      // IP cost for next level: total level × 10 × difficulty mod (minimum 10 × diffMod for level 0)
      const ipCost = totalLevel === 0 ? 10 * diffMod : totalLevel * 10 * diffMod;
      const currentIp = skill.system.ip || 0;
      const canIncrease = currentIp >= ipCost;

      // Calculate skill bonus from equipped tools, drugs, and cyberware (NOT applied to chipped skills)
      let skillBonus = 0;
      if (!isChipped) {
        for (const item of equippedWithBonuses) {
          const bonuses = item.system.bonuses || [];
          for (const bonus of bonuses) {
            if (bonus.type === "skill" && bonus.value) {
              const matchByUuid = bonus.skillUuid && bonus.skillUuid === skill.uuid;
              const matchByName = bonus.skillName &&
                bonus.skillName.toLowerCase() === skillNameLower;
              if (matchByUuid || matchByName) {
                skillBonus += bonus.value;
              }
            }
          }
        }
      }
      const computedLevel = effectiveLevel + skillBonus;

      return {
        id: skill.id,
        name: skill.name,
        stat: skill.system.stat,
        statLabel: statLabels[skill.system.stat] || skill.system.stat?.toUpperCase() || 'REF',
        level: baseLevel,
        ipLevel,
        totalLevel,
        chipValue: chipInfo?.chipValue,
        isChipped,
        isVirtual: false,
        effectiveLevel,
        skillBonus,
        computedLevel,
        ip: currentIp,
        ipCost,
        diffMod,
        canIncrease,
        isCareer,
        isSpecial
      };
    });

    // Add virtual skills from chipware (skills the character doesn't own)
    for (const vs of virtualSkillsData) {
      preparedSkills.push({
        id: vs.id,
        name: vs.name,
        stat: vs.stat,
        statLabel: statLabels[vs.stat] || vs.stat?.toUpperCase() || 'REF',
        level: 0,
        ipLevel: 0,
        totalLevel: 0,
        chipValue: vs.chipValue,
        isChipped: true,
        isVirtual: true,
        effectiveLevel: vs.chipValue,
        skillBonus: 0,
        computedLevel: vs.chipValue,
        ip: 0,
        ipCost: 10,
        diffMod: 1,
        canIncrease: false,
        isCareer: false,
        isSpecial: false
      });
    }

    // Sort: special first, then career alphabetically, then rest alphabetically
    // (Chipped skills stay in their normal position)
    preparedSkills.sort((a, b) => {
      if (a.isSpecial && !b.isSpecial) return -1;
      if (!a.isSpecial && b.isSpecial) return 1;
      if (a.isCareer && !b.isCareer) return -1;
      if (!a.isCareer && b.isCareer) return 1;
      return a.name.localeCompare(b.name);
    });

    // Split into two columns evenly
    const total = preparedSkills.length;
    const leftCount = Math.ceil(total / 2);

    sheetData.skillsLeft = preparedSkills.slice(0, leftCount);
    sheetData.skillsRight = preparedSkills.slice(leftCount);

    // Keep legacy support for old template usage
    sheetData.skillsSort = this.actor.system.skillsSortedBy || "Name";
    sheetData.skillsSortChoices = Object.keys(SortOrders);
    sheetData.filteredSkillIDs = this._filterSkills(sheetData);
    sheetData.skillDisplayList = sheetData.filteredSkillIDs.map(id => this.actor.items.get(id));
  }

  _filterSkills(sheetData) {
    if(sheetData.system.transient.skillFilter == null) {
      sheetData.system.transient.skillFilter = "";
    }
    const upperSearch = sheetData.system.transient.skillFilter.toUpperCase();
    const allSkillIds = this.actor.itemTypes.skill.map(skill => skill.id);

    if(upperSearch === "") {
      return allSkillIds;
    }

    return allSkillIds.filter(id => {
      const skillName = this.actor.items.get(id).name;
      return skillName.toUpperCase().includes(upperSearch);
    });
  }

  async _updateCombatSenseMod() {
    const combatSenseLevel =
      this.actor.items.find(item => item.type === 'skill' && item.name.includes('Combat'))?.system.level
      ?? this.actor.items.find(item => item.type === 'skill' && item.name.includes('Боя'))?.system.level
      ?? 0;
    await this.actor.update({ "system.CombatSenseMod": Number(combatSenseLevel) });
  }

  _addWoundTrack(sheetData) {
    const nonMortals = ["Light", "Serious", "Critical"].map(e => game.i18n.localize("CYBERPUNK."+e));
    const mortals = Array(7).fill().map((_,index) => game.i18n.format("CYBERPUNK.Mortal", {mortality: index}));
    sheetData.woundStates = nonMortals.concat(mortals);
  }

  _gearTabItems(allItems) {
    let hideThese = new Set(["cyberware", "skill", "program"]);
    let nameSorter = new Intl.Collator();
    let showItems = allItems
      .filter((item) => !hideThese.has(item.type))
      .sort((a, b) => nameSorter.compare(a.name, b.name));
    return showItems;
  }

  _prepareGearData(sheetData) {
    const weapons = this.actor.itemTypes.weapon || [];
    const armor = this.actor.itemTypes.armor || [];
    const commodity = this.actor.itemTypes.misc || [];
    const cyberware = this.actor.itemTypes.cyberware || [];
    const ordnance = this.actor.itemTypes.ordnance || [];
    const tools = this.actor.itemTypes.tool || [];
    const drugs = this.actor.itemTypes.drug || [];

    // Filter cyberweapons (base cyberware with isWeapon=true and equipped)
    const cyberweapons = cyberware.filter(c => c.system.isWeapon && c.system.equipped && !c.system.isOption);

    // Also include cyberware OPTIONS with isWeapon=true when their parent is equipped
    const cyberweaponOptions = cyberware.filter(c => {
      if (!c.system.isWeapon || !c.system.isOption) return false;
      const parentId = c.getFlag('cp2020', 'attachedTo');
      if (!parentId) return false; // Detached options never appear in gear list
      const parent = cyberware.find(p => p.id === parentId);
      return parent && parent.system.equipped;
    });

    // Combine base cyberweapons and attached cyberweapon options
    const allCyberweapons = [...cyberweapons, ...cyberweaponOptions];

    // Helper to get loaded ammo type abbreviation
    const getLoadedAmmoLabel = (loadedAmmoType) => {
      if (!loadedAmmoType) return '';
      return ammoAbbreviations[loadedAmmoType] || '';
    };

    // Prepare weapons data with type-specific context
    const weaponsList = weapons.map(w => {
      const sys = w.system;
      const wType = sys.weaponType || '';
      const isRanged = !['Melee', 'Exotic'].includes(wType);
      const isMelee = wType === 'Melee';
      const isExotic = wType === 'Exotic';

      // Common fields
      const rel = sys.reliability && reliability[sys.reliability]
        ? game.i18n.localize("CYBERPUNK." + reliability[sys.reliability])
        : '';
      const conc = sys.concealability && concealability[sys.concealability]
        ? game.i18n.localize("CYBERPUNK." + concealability[sys.concealability])
        : '';
      const range = sys.range ? `${sys.range} m` : '';

      let context = '';
      if (isRanged) {
        // Ranged: Caliber WeaponType · Reliability · Concealability · AmmoType · Range
        const weaponTypeLabel = weaponTypes[wType] || wType || '';
        const ammoKey = weaponToAmmoType[wType];
        const calibers = ammoKey ? (ammoCalibersByWeaponType[ammoKey] || {}) : {};
        const calLabelKey = calibers[sys.caliber];
        const caliber = calLabelKey ? game.i18n.localize(`CYBERPUNK.${calLabelKey}`) : '';
        const loadedAmmoLabel = getLoadedAmmoLabel(sys.loadedAmmoType);
        // Combine caliber and weapon type as single element (no interpunct between them)
        const caliberWeaponType = [caliber, weaponTypeLabel].filter(p => p).join(' ');
        const contextParts = [caliberWeaponType, rel, conc, loadedAmmoLabel, range].filter(p => p);
        context = contextParts.join(' · ');
      } else if (isMelee) {
        // Melee: Melee · DamageType · Reliability · Concealability · Range
        const damageTypeKey = meleeDamageTypes[sys.damageType];
        const damageType = damageTypeKey ? game.i18n.localize(`CYBERPUNK.${damageTypeKey}`) : '';
        const contextParts = ['Melee', damageType, rel, conc, range].filter(p => p);
        context = contextParts.join(' · ');
      } else if (isExotic) {
        // Exotic: Exotic · Effect · Reliability · Concealability · Range
        const effectKey = exoticEffects[sys.effect];
        const effect = effectKey ? game.i18n.localize(`CYBERPUNK.${effectKey}`) : '';
        const contextParts = ['Exotic', effect, rel, conc, range].filter(p => p);
        context = contextParts.join(' · ');
      }

      return {
        id: w.id,
        img: w.img,
        name: w.name,
        context: context,
        price: sys.cost || 0,
        weight: sys.weight || 0,
        damage: sys.damage || '–',
        shotsLeft: sys.shotsLeft ?? 0,
        shots: sys.shots ?? 0,
        charges: sys.charges ?? 0,
        chargesMax: sys.chargesMax ?? 0,
        chargesDisplay: (sys.charges || sys.chargesMax) ? `${sys.charges ?? 0} / ${sys.chargesMax ?? 0}` : '–',
        rof: sys.rof ?? 0,
        canReload: (sys.shotsLeft ?? 0) < (sys.shots ?? 0),
        isCyberware: false,
        isRanged: isRanged,
        isMelee: isMelee,
        isExotic: isExotic
      };
    });

    // Prepare cyberweapons data (cyberware with embedded weapon)
    const cyberweaponsList = allCyberweapons.map(c => {
      const sys = c.system;
      const weapon = sys.weapon || {};
      const wType = weapon.weaponType || '';
      const isRanged = !['Melee', 'Exotic'].includes(wType);
      const isMelee = wType === 'Melee';
      const isExotic = wType === 'Exotic';

      const rel = weapon.reliability && reliability[weapon.reliability]
        ? game.i18n.localize("CYBERPUNK." + reliability[weapon.reliability])
        : '';
      const conc = weapon.concealability && concealability[weapon.concealability]
        ? game.i18n.localize("CYBERPUNK." + concealability[weapon.concealability])
        : '';
      const range = weapon.range ? `${weapon.range} m` : '';

      let context = '';
      if (isRanged) {
        const weaponTypeLabel = weaponTypes[wType] || wType || '';
        const ammoKey = weaponToAmmoType[wType];
        const calibers = ammoKey ? (ammoCalibersByWeaponType[ammoKey] || {}) : {};
        const calLabelKey = calibers[weapon.caliber];
        const caliber = calLabelKey ? game.i18n.localize(`CYBERPUNK.${calLabelKey}`) : '';
        const loadedAmmoLabel = getLoadedAmmoLabel(weapon.loadedAmmoType);
        // Combine caliber and weapon type as single element (no interpunct between them)
        const caliberWeaponType = [caliber, weaponTypeLabel].filter(p => p).join(' ');
        const contextParts = [caliberWeaponType, rel, conc, loadedAmmoLabel, range].filter(p => p);
        context = contextParts.join(' · ');
      } else if (isMelee) {
        const damageTypeKey = meleeDamageTypes[weapon.damageType];
        const damageType = damageTypeKey ? game.i18n.localize(`CYBERPUNK.${damageTypeKey}`) : '';
        const contextParts = ['Melee', damageType, rel, conc, range].filter(p => p);
        context = contextParts.join(' · ');
      } else if (isExotic) {
        const effectKey = exoticEffects[weapon.effect];
        const effect = effectKey ? game.i18n.localize(`CYBERPUNK.${effectKey}`) : '';
        const contextParts = ['Exotic', effect, rel, conc, range].filter(p => p);
        context = contextParts.join(' · ');
      } else {
        // Fallback for unknown type
        const contextParts = [rel, conc, range].filter(p => p);
        context = contextParts.join(' · ');
      }

      return {
        id: c.id,
        img: c.img,
        name: c.name,
        context: context,
        price: sys.cost || 0,
        weight: sys.weight || 0,
        damage: weapon.damage || '–',
        shotsLeft: weapon.shotsLeft ?? 0,
        shots: weapon.shots ?? 0,
        charges: weapon.charges ?? 0,
        chargesMax: weapon.chargesMax ?? 0,
        chargesDisplay: (weapon.charges || weapon.chargesMax) ? `${weapon.charges ?? 0} / ${weapon.chargesMax ?? 0}` : '–',
        rof: weapon.rof ?? 1,
        canReload: (weapon.shotsLeft ?? 0) < (weapon.shots ?? 0),
        isCyberware: true,
        isRanged: isRanged,
        isMelee: isMelee,
        isExotic: isExotic
      };
    });

    // Combine regular weapons and cyberweapons
    sheetData.weapons = [...weaponsList, ...cyberweaponsList];

    // Prepare ordnance data
    sheetData.ordnanceItems = ordnance.map(o => {
      const sys = o.system;
      const templateLabel = ordnanceTemplateTypes[sys.templateType]
        ? game.i18n.localize(`CYBERPUNK.${ordnanceTemplateTypes[sys.templateType]}`)
        : '';
      const radiusStr = sys.radius ? `${sys.radius} m` : '';
      const effectKey = exoticEffects[sys.effect];
      const effectLabel = effectKey ? game.i18n.localize(`CYBERPUNK.${effectKey}`) : '';
      const relLabel = reliability[sys.reliability]
        ? game.i18n.localize(`CYBERPUNK.${reliability[sys.reliability]}`)
        : '';
      const concLabel = concealability[sys.concealability]
        ? game.i18n.localize(`CYBERPUNK.${concealability[sys.concealability]}`)
        : '';
      const range = sys.range ? `${sys.range} m` : '';
      const contextParts = [templateLabel, radiusStr, effectLabel, relLabel, concLabel, range].filter(p => p);

      return {
        id: o.id,
        img: o.img,
        name: o.name,
        context: contextParts.join(' · '),
        price: sys.cost || 0,
        weight: sys.weight || 0,
        damage: sys.damage && sys.damage !== '0' ? sys.damage : '–',
        charges: sys.charges || 0
      };
    });

    // Prepare tool data
    sheetData.toolItems = tools.map(t => {
      const sys = t.system;
      const bonuses = sys.bonuses || [];
      const effectLabels = bonuses.slice(0, 2).map(b => {
        if (b.type === "property") {
          const propKey = toolBonusProperties[b.property];
          const propLabel = propKey ? game.i18n.localize(`CYBERPUNK.${propKey}`) : b.property;
          return `${propLabel} ${b.value >= 0 ? '+' : ''}${b.value}`;
        } else if (b.skillName) {
          return `${b.skillName} ${b.value >= 0 ? '+' : ''}${b.value}`;
        }
        return '';
      }).filter(l => l);
      const contextParts = ['Tool', ...effectLabels];

      return {
        id: t.id,
        img: t.img,
        name: t.name,
        context: contextParts.join(' · '),
        price: sys.cost || 0,
        weight: sys.weight || 0,
        equipped: sys.equipped ?? false
      };
    });

    // Prepare drug data
    sheetData.drugItems = drugs.map(d => {
      const sys = d.system;
      const bonuses = sys.bonuses || [];
      const effectLabels = bonuses.slice(0, 2).map(b => {
        if (b.type === "property") {
          const propKey = toolBonusProperties[b.property];
          const propLabel = propKey ? game.i18n.localize(`CYBERPUNK.${propKey}`) : b.property;
          return `${propLabel} ${b.value >= 0 ? '+' : ''}${b.value}`;
        } else if (b.skillName) {
          return `${b.skillName} ${b.value >= 0 ? '+' : ''}${b.value}`;
        }
        return '';
      }).filter(l => l);
      const contextParts = ['Drug', ...effectLabels];

      return {
        id: d.id,
        img: d.img,
        name: d.name,
        context: contextParts.join(' · '),
        price: sys.cost || 0,
        weight: sys.weight || 0,
        quantity: sys.quantity ?? 0,
        equipped: sys.equipped ?? false
      };
    });

    // Prepare armor/outfit data
    sheetData.outfitItems = armor.map(a => {
      const sys = a.system;
      // Get coverage areas
      const coverage = sys.coverage || {};
      const areas = [];

      // Check each area - SP > 0 means covered
      if (coverage.Head?.stoppingPower > 0) areas.push('Head');
      if (coverage.Torso?.stoppingPower > 0) areas.push('Torso');
      // Combine arms
      if (coverage.lArm?.stoppingPower > 0 || coverage.rArm?.stoppingPower > 0) areas.push('Arms');
      // Combine legs
      if (coverage.lLeg?.stoppingPower > 0 || coverage.rLeg?.stoppingPower > 0) areas.push('Legs');

      // Get SP (same for all covered areas, use first found)
      let sp = 0;
      for (const loc of ['Head', 'Torso', 'lArm', 'rArm', 'lLeg', 'rLeg']) {
        if (coverage[loc]?.stoppingPower > 0) {
          sp = coverage[loc].stoppingPower;
          break;
        }
      }

      // Armor type
      const armorType = sys.armorType === 'hard' ? 'Hard Armor' : 'Soft Armor';

      // Build context
      const contextParts = [armorType, ...areas];
      const context = contextParts.join(' · ');

      return {
        id: a.id,
        img: a.img,
        name: a.name,
        context: context,
        price: sys.cost || 0,
        weight: sys.weight || 0,
        sp: sp,
        encumbrance: sys.encumbrance ?? 0,
        equipped: sys.equipped ?? false
      };
    });

    // Add cyberware with armor capability to outfit items (only if equipped)
    // Note: cyberware was already declared above at line 522
    const cyberarmor = cyberware.filter(c => c.system.isArmor && c.system.equipped && !c.system.isOption);

    // Also include cyberware OPTIONS with isArmor=true when their parent is equipped
    const cyberarmorOptions = cyberware.filter(c => {
      if (!c.system.isArmor || !c.system.isOption) return false;
      const parentId = c.getFlag('cp2020', 'attachedTo');
      if (!parentId) return false; // Detached options never appear in gear list
      const parent = cyberware.find(p => p.id === parentId);
      return parent && parent.system.equipped;
    });

    // Combine base cyberarmor and attached cyberarmor options
    const allCyberarmor = [...cyberarmor, ...cyberarmorOptions];
    const cyberarmorItems = allCyberarmor.map(c => {
      const sys = c.system;
      const armorData = sys.armor || {};
      const coverage = armorData.coverage || {};
      const areas = [];

      if (coverage.Head?.stoppingPower > 0) areas.push('Head');
      if (coverage.Torso?.stoppingPower > 0) areas.push('Torso');
      if (coverage.lArm?.stoppingPower > 0 || coverage.rArm?.stoppingPower > 0) areas.push('Arms');
      if (coverage.lLeg?.stoppingPower > 0 || coverage.rLeg?.stoppingPower > 0) areas.push('Legs');

      let sp = 0;
      for (const loc of ['Head', 'Torso', 'lArm', 'rArm', 'lLeg', 'rLeg']) {
        if (coverage[loc]?.stoppingPower > 0) {
          sp = coverage[loc].stoppingPower;
          break;
        }
      }

      const armorType = armorData.armorType === 'hard' ? 'Hard Armor' : 'Soft Armor';
      const contextParts = [armorType, ...areas];
      const context = contextParts.join(' · ');

      return {
        id: c.id,
        img: c.img,
        name: c.name,
        context: context,
        price: sys.cost || 0,
        weight: sys.weight || 0,
        sp: sp,
        encumbrance: armorData.encumbrance ?? 0,
        equipped: true,  // Cyberware is always "equipped"
        isCyberware: true
      };
    });

    // Combine regular outfits and cyberarmor
    sheetData.outfitItems = [...sheetData.outfitItems, ...cyberarmorItems];

    // Prepare commodity/gear data
    sheetData.gearItems = commodity.map(m => {
      return {
        id: m.id,
        img: m.img,
        name: m.name,
        context: 'Commodity',
        price: m.system.cost || 0,
        weight: m.system.weight || 0
      };
    });

    // Prepare ammo data
    const ammoItems = this.actor.itemTypes.ammo || [];
    sheetData.ammoItems = ammoItems.map(a => {
      const sys = a.system;
      const wt = ammoWeaponTypes[sys.weaponType];
      const wtLabel = wt ? game.i18n.localize(`CYBERPUNK.${wt}`) : '';
      const calibers = ammoCalibersByWeaponType[sys.weaponType] || {};
      const calLabel = calibers[sys.caliber] ? game.i18n.localize(`CYBERPUNK.${calibers[sys.caliber]}`) : '';
      const atLabel = ammoTypes[sys.ammoType] ? game.i18n.localize(`CYBERPUNK.${ammoTypes[sys.ammoType]}`) : '';
      const contextParts = [wtLabel, calLabel, atLabel].filter(p => p);

      const packSize = Number(sys.packSize) || 1;
      const quantity = Number(sys.quantity) || 0;
      const costPerRound = (Number(sys.cost) || 0) / packSize;
      const totalPrice = Math.round(costPerRound * quantity * 100) / 100;

      return {
        id: a.id,
        img: a.img,
        name: a.name,
        context: contextParts.join(' · '),
        totalPrice: totalPrice,
        weight: sys.weight || 0,
        quantity: quantity
      };
    });

    // Flag to check if there's any gear at all
    sheetData.hasAnyGear =
      sheetData.weapons.length > 0 ||
      sheetData.ordnanceItems.length > 0 ||
      sheetData.outfitItems.length > 0 ||
      sheetData.toolItems.length > 0 ||
      sheetData.drugItems.length > 0 ||
      sheetData.gearItems.length > 0 ||
      sheetData.ammoItems.length > 0;
  }

  /**
   * Prepare cyberware data for the cyberware tab
   * Organizes cyberware into four fixed categories with options attachment system
   * @param {Object} sheetData - The sheet data object to augment
   */
  _prepareCyberwareData(sheetData) {
    const cyberware = this.actor.itemTypes.cyberware || [];

    // Initialize category containers
    const categories = {
      sensor: { items: [], detachedOptions: [], badge: 'badge-sensor.svg', title: 'SENSORS' },
      cyberlimb: { items: [], detachedOptions: [], badge: 'badge-cyberlimb.svg', title: 'CYBERLIMBS' },
      implant: { items: [], badge: 'badge-implant.svg', title: 'IMPLANTS' },
      chipware: { items: [], badge: 'badge-chipware.svg', title: 'CHIPWARE' }
    };

    // Helper: Get surgery code label
    const getSurgeryLabel = (code) => {
      const labelKey = surgeryCodes[code];
      return labelKey ? game.i18n.localize(`CYBERPUNK.${labelKey}`) : code || '';
    };

    // Helper: Get subtype label
    const getSubtypeLabel = (cyberType, subtype) => {
      const subtypes = getCyberwareSubtypes(cyberType);
      const labelKey = subtypes[subtype];
      return labelKey ? game.i18n.localize(`CYBERPUNK.${labelKey}`) : subtype || '';
    };

    // Helper: Build context string based on cyberware type
    const buildContext = (item) => {
      const sys = item.system;
      const cyberType = sys.cyberwareType || 'implant';
      const subtypeLabel = getSubtypeLabel(cyberType, sys.cyberwareSubtype);
      const surgeryLabel = getSurgeryLabel(sys.surgeryCode);
      const baseOrOption = sys.isOption ? 'Option' : 'Base';

      const parts = [];

      switch (cyberType) {
        case 'sensor':
          // Subtype · Base/Option · Surgery [· Weapon if weapon]
          if (subtypeLabel) parts.push(subtypeLabel);
          parts.push(baseOrOption);
          if (surgeryLabel) parts.push(surgeryLabel);
          if (sys.isWeapon) parts.push('Weapon');
          break;

        case 'cyberlimb':
          // Subtype · Base/Option · Surgery
          if (subtypeLabel) parts.push(subtypeLabel);
          parts.push(baseOrOption);
          if (surgeryLabel) parts.push(surgeryLabel);
          break;

        case 'implant':
          // Subtype · Surgery [· "Weapon" if weapon] [· "Armor" if armor]
          if (subtypeLabel) parts.push(subtypeLabel);
          if (surgeryLabel) parts.push(surgeryLabel);
          if (sys.isWeapon) parts.push('Weapon');
          if (sys.isArmor) parts.push('Armor');
          break;

        case 'chipware':
          // Subtype · {Effects summary}
          if (subtypeLabel) parts.push(subtypeLabel);
          // Summarize bonuses (first 2 effects)
          const bonuses = sys.bonuses || [];
          const effectLabels = bonuses.slice(0, 2).map(b => {
            if (b.type === "property") {
              const propKey = toolBonusProperties[b.property];
              const propLabel = propKey ? game.i18n.localize(`CYBERPUNK.${propKey}`) : b.property;
              return `${propLabel} ${b.value >= 0 ? '+' : ''}${b.value}`;
            } else if (b.skillName) {
              return `${b.skillName} ${b.value >= 0 ? '+' : ''}${b.value}`;
            }
            return '';
          }).filter(l => l);
          parts.push(...effectLabels);
          break;
      }

      return parts.join(' · ');
    };

    // Helper: Check if cyberlimb is STRUCTURALLY broken (SDP <= disablesAt)
    // This determines if the limb CAN be turned on at all
    const isStructurallyBroken = (item) => {
      const sys = item.system;
      if (sys.cyberwareType !== 'cyberlimb') return false;
      if (sys.isOption) return false;
      const current = sys.structure?.current ?? 0;
      const disablesAt = sys.disablesAt ?? 0;
      return current > 0 && current <= disablesAt;
    };

    // Separate base items and options
    const baseItems = cyberware.filter(c => !c.system.isOption);
    const options = cyberware.filter(c => c.system.isOption);

    // Build attachment map: parentId -> [option items]
    const attachmentMap = new Map();
    const detachedOptions = [];

    for (const opt of options) {
      const parentId = opt.getFlag('cp2020', 'attachedTo') || null;
      if (parentId && baseItems.some(b => b.id === parentId)) {
        if (!attachmentMap.has(parentId)) attachmentMap.set(parentId, []);
        attachmentMap.get(parentId).push(opt);
      } else {
        detachedOptions.push(opt);
      }
    }

    // Process each base cyberware item
    for (const item of baseItems) {
      const sys = item.system;
      const cyberType = sys.cyberwareType || 'implant';

      // Build prepared item data
      const preparedItem = {
        id: item.id,
        img: item.img,
        name: item.name,
        context: buildContext(item),
        price: sys.cost || 0,
        cyberwareType: cyberType,
        isOption: false,
        isBase: true,

        // Humanity fields
        humanityLoss: sys.humanityLoss || 0,
        humanityCost: sys.humanityCost || '',
        humanityRolled: sys.humanityRolled || false,

        // Slots (for sensors/cyberlimbs)
        hasSlots: sys.hasSlots || 0,
        usedSlots: 0, // Will calculate from attached options

        // Status
        equipped: sys.equipped ?? true,
        isStructurallyBroken: isStructurallyBroken(item),

        // Attached options
        attachedOptions: []
      };

      // Get attached options for this base item
      const attached = attachmentMap.get(item.id) || [];
      for (const opt of attached) {
        const optSys = opt.system;
        preparedItem.usedSlots += (optSys.takesSpace || 1);
        preparedItem.attachedOptions.push({
          id: opt.id,
          img: opt.img,
          name: opt.name,
          context: buildContext(opt),
          price: optSys.cost || 0,
          isOption: true,
          isAttached: true,
          parentId: item.id,
          humanityLoss: optSys.humanityLoss || 0,
          humanityCost: optSys.humanityCost || '',
          humanityRolled: optSys.humanityRolled || false,
          takesSpace: optSys.takesSpace || 1,
          equipped: optSys.equipped ?? true
        });
      }

      // Update slot display with used/total
      if (cyberType === 'sensor' || cyberType === 'cyberlimb') {
        preparedItem.slotDisplay = `${preparedItem.usedSlots} / ${preparedItem.hasSlots}`;
      } else {
        preparedItem.slotDisplay = '';
      }

      // Add to appropriate category
      if (categories[cyberType]) {
        categories[cyberType].items.push(preparedItem);
      }
    }

    // Process detached options (for sensors and cyberlimbs only)
    for (const opt of detachedOptions) {
      const optSys = opt.system;
      const cyberType = optSys.cyberwareType || 'implant';

      // Only sensor and cyberlimb options can be detached
      if (cyberType !== 'sensor' && cyberType !== 'cyberlimb') continue;

      const preparedOption = {
        id: opt.id,
        img: opt.img,
        name: opt.name,
        context: buildContext(opt),
        price: optSys.cost || 0,
        isOption: true,
        isAttached: false,
        parentId: null,
        humanityLoss: optSys.humanityLoss || 0,
        humanityCost: optSys.humanityCost || '',
        humanityRolled: optSys.humanityRolled || false,
        takesSpace: optSys.takesSpace || 1,
        equipped: optSys.equipped ?? true
      };

      if (categories[cyberType]) {
        categories[cyberType].detachedOptions.push(preparedOption);
      }
    }

    // Sort items alphabetically within each category
    for (const cat of Object.values(categories)) {
      cat.items.sort((a, b) => a.name.localeCompare(b.name));
      if (cat.detachedOptions) {
        cat.detachedOptions.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    // Add to sheet data
    sheetData.cyberwareCategories = categories;
    sheetData.hasCyberware = cyberware.length > 0;
  }

  _prepareCharacterItems(sheetData) {
    let sortedItems = sheetData.actor.itemTypes;

    sheetData.gearTabItems = this._gearTabItems(sheetData.actor.items);

    sheetData.gear = {
      weapons: sortedItems.weapon,
      armor: sortedItems.armor,
      cyberware: sortedItems.cyberware,
      commodity: sortedItems.misc,
      cyberCost: sortedItems.cyberware.reduce((a,b) => a + b.system.cost, 0)
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // ----- Custom Window Dragging -----
    // Set up draggable for our custom header since we're hiding Foundry's default window chrome
    // Must recreate each render since DOM elements change
    const sheetHeader = html[0].querySelector('.sheet-header');
    if (sheetHeader) {
      // Get the app element (parent of html content)
      const appElement = html.closest('.app');
      if (appElement.length) {
        // Create new Draggable instance each time (DOM elements are new after re-render)
        this._customDraggable = new Draggable(this, appElement, sheetHeader, this.options.resizable);

        // Hook up our custom resize handle
        const resizeHandle = html[0].querySelector('.sheet-resize');
        if (resizeHandle) {
          resizeHandle.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            this._customDraggable._onResizeMouseDown(ev);
          });
        }
      }

      // Double-click header to minimize/maximize
      sheetHeader.addEventListener('dblclick', (ev) => {
        // Don't minimize if clicking on a control button
        if (ev.target.closest('.lock-toggle, .header-control')) return;

        const sheetFrame = html[0].querySelector('.sheet-frame');
        const characterSheet = html[0].querySelector('.character-sheet');
        const appElement = html.closest('.app')[0];
        const tabSelector = html[0].querySelector('.tab-selector');
        const sheetContent = html[0].querySelector('.sheet-content');
        const sheetResize = html[0].querySelector('.sheet-resize');

        if (this._isMinimized) {
          // Maximize - restore original dimensions
          // Enable transitions on both elements
          sheetFrame.style.transition = 'width 250ms ease, height 250ms ease';
          appElement.style.transition = 'width 250ms ease, height 250ms ease';

          // Animate back to original size
          sheetFrame.style.width = this._originalWidth + 'px';
          sheetFrame.style.height = this._originalHeight + 'px';
          appElement.style.width = this._originalFoundryWidth + 'px';
          appElement.style.height = this._originalFoundryHeight + 'px';

          // Clear character-sheet constraints so content can expand
          characterSheet.style.width = '';
          characterSheet.style.minHeight = '';

          // Update Foundry position and clear inline styles after animation
          setTimeout(() => {
            sheetFrame.style.transition = '';
            sheetFrame.style.width = '';
            sheetFrame.style.height = '';
            sheetFrame.style.minHeight = '';
            appElement.style.transition = '';
            appElement.style.width = '';
            appElement.style.height = '';
            appElement.style.minHeight = '';
            tabSelector.style.display = '';
            sheetContent.style.display = '';
            sheetResize.style.display = '';

            // Restore Foundry position
            this.setPosition({
              width: this._originalFoundryWidth,
              height: this._originalFoundryHeight
            });
          }, 250);

          this._isMinimized = false;
        } else {
          // Minimize - save current dimensions
          this._originalWidth = sheetFrame.offsetWidth;
          this._originalHeight = sheetFrame.offsetHeight;
          this._originalFoundryWidth = this.position.width;
          this._originalFoundryHeight = this.position.height;

          // Hide content
          tabSelector.style.display = 'none';
          sheetContent.style.display = 'none';
          sheetResize.style.display = 'none';

          // Allow shrinking by removing min-height constraints
          sheetFrame.style.minHeight = '0';
          characterSheet.style.minHeight = '0';
          appElement.style.minHeight = '0';

          const minWidth = 400;

          // Enable transitions on both elements
          sheetFrame.style.transition = 'width 250ms ease, height 250ms ease';
          appElement.style.transition = 'width 250ms ease, height 250ms ease';

          // Animate to minimized size
          sheetFrame.style.width = minWidth + 'px';
          sheetFrame.style.height = '46px';
          appElement.style.width = minWidth + 'px';
          appElement.style.height = '46px';

          setTimeout(() => {
            // After animation, set final constraints
            characterSheet.style.width = minWidth + 'px';
            characterSheet.style.minHeight = '46px';

            this.setPosition({ width: minWidth, height: 46 });
            sheetFrame.style.transition = '';
            appElement.style.transition = '';
          }, 250);

          this._isMinimized = true;
        }
      });
    }

    function getEventItem(sheet, ev) {
      let itemId = ev.currentTarget.dataset.itemId;
      return sheet.actor.items.get(itemId);
    }

    function deleteItemDialog(ev) {
      ev.stopPropagation();
      let item = getEventItem(this, ev);
      let confirmDialog = new Dialog({
        title: localize("ItemDeleteConfirmTitle"),
        content: `<p>${localizeParam("ItemDeleteConfirmText", {itemName: item.name})}</p>`,
        buttons: {
          yes: {
            label: localize("Yes"),
            callback: () => item.delete()
          },
          no: { label: localize("No") },
        },
        default:"no"
      });
      confirmDialog.render(true);
    }

    // ----- Header Controls -----

    // Lock/Unlock toggle
    html.find('.lock-toggle').click(ev => {
      ev.preventDefault();
      this.toggleLock();
    });

    // Copy UUID
    html.find('[data-action="copyUuid"]').click(ev => {
      ev.preventDefault();
      const uuid = this.actor.uuid;
      game.clipboard.copyPlainText(uuid);
      ui.notifications.info(`Copied UUID: ${uuid}`);
    });

    // Configure Sheet
    html.find('[data-action="configureSheet"]').click(ev => {
      ev.preventDefault();
      this._onConfigureSheet(ev);
    });

    // Configure Token
    html.find('[data-action="configureToken"]').click(ev => {
      ev.preventDefault();
      this._onConfigureToken(ev);
    });

    // Close Sheet
    html.find('[data-action="closeSheet"]').click(ev => {
      ev.preventDefault();
      this.close();
    });

    // ----- Portrait Click -----
    // When locked: show full-screen image popup
    // When unlocked: open FilePicker to change image
    html.find('.portrait-frame').click(ev => {
      ev.preventDefault();
      if (this._isLocked) {
        // Show full-screen image popup
        new ImagePopout(this.actor.img, {
          title: this.actor.name,
          uuid: this.actor.uuid
        }).render(true);
      } else {
        // Open FilePicker to change image
        const fp = new FilePicker({
          type: "image",
          current: this.actor.img,
          callback: (path) => {
            this.actor.update({ img: path });
          },
          top: this.position.top + 40,
          left: this.position.left + 10
        });
        fp.render(true);
      }
    });

    // ----- View Role Icon -----
    html.find('.role-view-icon').click(ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const roleUuid = ev.currentTarget.dataset.roleUuid;
      if (roleUuid) {
        const roleItem = fromUuidSync(roleUuid);
        if (roleItem) {
          roleItem.sheet.render(true);
        }
      }
    });

    // ----- Action Buttons (Stun Save, Poison Save, Death Save) -----

    // Stun Save roll
    html.find(".stun-save").click(ev => {
      ev.preventDefault();
      const modifier = this.actor.system.stunSaveMod || 0;
      this.actor.rollStunSave(modifier);
    });

    // Poison Save roll
    html.find(".poison-save").click(ev => {
      ev.preventDefault();
      const modifier = this.actor.system.poisonSaveMod || 0;
      this.actor.rollPoisonSave(modifier);
    });

    // Death Save roll
    html.find(".death-save").click(ev => {
      ev.preventDefault();
      const modifier = this.actor.system.deathSaveMod || 0;
      this.actor.rollDeathSave(modifier);
    });

    // If not editable, do nothing further
    if (!this.options.editable) return;

    // ----- Existing Listeners (preserved from original) -----

    // Stat roll
    html.find('.stat-roll').click(ev => {
      let statName = ev.currentTarget.dataset.statName;
      this.actor.rollStat(statName);
    });

    // Wound dot clicks - set damage to clicked dot value
    html.find('.wound-dot').click(ev => {
      const damage = Number(ev.currentTarget.dataset.damage);
      const currentDamage = this.actor.system.damage || 0;
      // Clicking filled dot decrements, clicking unfilled fills up to that point
      const newDamage = damage === currentDamage ? damage - 1 : damage;
      this.actor.update({ "system.damage": Math.max(0, newDamage) });
    });

    // Wound dot hover preview - bidirectional (adding and restoring wounds)
    const self = this;
    html.find('.wound-dot').hover(
      function() { // mouseenter
        const hoverDamage = Number(this.dataset.damage);
        const currentDamage = self.actor.system.damage || 0;

        if (hoverDamage <= currentDamage) {
          // Hovering on a taken dot - show darkened hover for dots that would be restored
          html.find('.wound-dot').each(function() {
            const dotDamage = Number(this.dataset.damage);
            // Show darkened hover for taken dots from hoverDamage+1 to currentDamage
            if (dotDamage > hoverDamage && dotDamage <= currentDamage) {
              $(this).attr('src', 'systems/cp2020/img/ui/wounds-hover-dark.svg');
            }
          });
        } else {
          // Hovering on a fresh dot - show hover for dots that would be filled
          html.find('.wound-dot').each(function() {
            const dotDamage = Number(this.dataset.damage);
            if (dotDamage <= hoverDamage && dotDamage > currentDamage) {
              $(this).attr('src', 'systems/cp2020/img/ui/wounds-hover.svg');
            }
          });
        }
      },
      function() { // mouseleave - restore all dots to their actual state
        const currentDamage = self.actor.system.damage || 0;
        html.find('.wound-dot').each(function() {
          const dotDamage = Number(this.dataset.damage);
          const state = currentDamage >= dotDamage ? 'taken' : 'fresh';
          $(this).attr('src', `systems/cp2020/img/ui/wounds-${state}.svg`);
        });
      }
    );

    // Skill level changes
    html.find(".skill-level").click((event) => event.target.select()).change(async (event) => {
      let skill = this.actor.items.get(event.currentTarget.dataset.skillId);
      let target = skill.system.isChipped ? "system.chipLevel" : "system.level";
      let updateData = { _id: skill.id };
      updateData[target] = parseInt(event.target.value, 10);
      await this.actor.updateEmbeddedDocuments("Item", [updateData]);
      await this._updateCombatSenseMod();
    });

    // Toggle skill chipped (legacy handler)
    html.find(".chip-toggle").click(async ev => {
      const skill = this.actor.items.get(ev.currentTarget.dataset.skillId);
      const toggled = !skill.system.isChipped;

      await this.actor.updateEmbeddedDocuments("Item", [{
        _id: skill.id,
        "system.isChipped": toggled,
        "system.-=chipped": null
      }]);
    });

    // Skill chip button - cycles through chip levels (0 → 1 → 2 → 3 → 0)
    html.find(".skill-chip").click(async ev => {
      const skill = this.actor.items.get(ev.currentTarget.dataset.skillId);
      if (!skill) return;

      const currentChipLevel = skill.system.isChipped ? (skill.system.chipLevel || 1) : 0;
      const nextChipLevel = (currentChipLevel + 1) % 4;
      const isChipped = nextChipLevel > 0;

      await this.actor.updateEmbeddedDocuments("Item", [{
        _id: skill.id,
        "system.isChipped": isChipped,
        "system.chipLevel": nextChipLevel
      }]);
    });

    // Skill sorting
    html.find(".skill-sort > select").change(ev => {
      let sort = ev.currentTarget.value;
      this.actor.sortSkills(sort);
    });

    // Skill search: auto-filter + clear button
    const $skillSearch = html.find('input.skill-search[name="system.transient.skillFilter"]');
    const $skillClear  = html.find('.skill-search-clear');

    const toggleClear = () => $skillClear.toggleClass('is-visible', !!$skillSearch.val());

    if (this._restoreSkillCaret != null) {
      const el = $skillSearch[0];
      if (el) {
        el.focus();
        const pos = Math.min(this._restoreSkillCaret, el.value.length);
        try { el.setSelectionRange(pos, pos); } catch(_) {}
      }
      this._restoreSkillCaret = null;
    }

    toggleClear();

    let searchTypingTimer;
    $skillSearch.on('input', (ev) => {
      const val = ev.currentTarget.value || "";
      toggleClear();
      this._restoreSkillCaret = ev.currentTarget.selectionStart ?? val.length;
      foundry.utils.setProperty(this.actor.system, "transient.skillFilter", val);
      clearTimeout(searchTypingTimer);
      searchTypingTimer = setTimeout(() => this.render(false), 120);
    });

    html.on('pointerdown mousedown', '[data-action="clear-skill-search"]', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });

    html.on('click', '[data-action="clear-skill-search"]', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      $skillSearch.val('');
      this._restoreSkillCaret = 0;
      foundry.utils.setProperty(this.actor.system, "transient.skillFilter", "");
      this.render(false);
    });

    // Prompt for modifiers
    html.find(".skill-ask-mod")
      .on("click",  ev => ev.stopPropagation())
      .on("change", async ev => {
        ev.stopPropagation();
        const cb = ev.currentTarget;
        const skillId = cb.dataset.skillId;
        const skill = this.actor.items.get(skillId);
        if (!skill) return ui.notifications.warn(localize("SkillNotFound"));
        try {
          await skill.update({ "system.askMods": cb.checked });
        } catch (err) {
          console.error(err);
          ui.notifications.error(localize("UpdateAskModsError"));
          cb.checked = !cb.checked;
        }
      });

    // Skill roll
    html.find(".skill-roll").click(ev => {
      const id = ev.currentTarget.dataset.skillId;
      const skill = this.actor.items.get(id);
      if (!skill) return;

      if (skill.system?.askMods) {
        const dlg = new ModifiersDialog(this.actor, {
          title: localize("ModifiersSkillTitle"),
          showAdvDis: true,
          modifierGroups: [[
            { localKey: "ExtraModifiers", dataPath: "extraMod", defaultValue: 0 }
          ]],
          onConfirm: ({ extraMod=0, advantage=false, disadvantage=false }) =>
            this.actor.rollSkill(
              id,
              Number(extraMod) || 0,
              advantage,
              disadvantage
            )
        });
        return dlg.render(true);
      }
      this.actor.rollSkill(id);
    });

    // Chip toggle (cycle 0 → 1 → 2 → 3 → 0) for new skills tab
    html.find('.skill-chip').click(async ev => {
      const skillId = ev.currentTarget.dataset.skillId;
      const skill = this.actor.items.get(skillId);
      if (!skill) return;

      const currentChipLevel = skill.system.chipLevel || 0;
      const isChipped = skill.system.isChipped;

      let newChipLevel, newIsChipped;
      if (!isChipped) {
        newIsChipped = true;
        newChipLevel = 1;
      } else if (currentChipLevel < 3) {
        newIsChipped = true;
        newChipLevel = currentChipLevel + 1;
      } else {
        newIsChipped = false;
        newChipLevel = 0;
      }

      await this.actor.updateEmbeddedDocuments("Item", [{
        _id: skillId,
        "system.isChipped": newIsChipped,
        "system.chipLevel": newChipLevel
      }]);
    });

    // Skill IP input for new skills tab
    html.find('.skill-ip').change(async ev => {
      const skillId = ev.currentTarget.dataset.skillId;
      const newIp = parseInt(ev.target.value, 10) || 0;
      await this.actor.updateEmbeddedDocuments("Item", [{
        _id: skillId,
        "system.ip": Math.max(0, newIp)
      }]);
    });

    // Base skill level input (unlocked mode)
    html.find('.skill-level-input').change(async ev => {
      const skillId = ev.currentTarget.dataset.skillId;
      const newLevel = parseInt(ev.target.value, 10) || 0;
      await this.actor.updateEmbeddedDocuments("Item", [{
        _id: skillId,
        "system.level": Math.max(0, Math.min(10, newLevel))
      }]);
      // Update Combat Sense modifier if this was a Combat Sense skill
      await this._updateCombatSenseMod();
    });

    // Plus button (spend IP) for new skills tab
    html.find('.skill-plus').click(async ev => {
      const skillId = ev.currentTarget.dataset.skillId;
      const skill = this.actor.items.get(skillId);
      if (!skill) return;

      // Total level = base level + IP-earned level
      const baseLevel = skill.system.level || 0;
      const ipLevel = skill.system.ipLevel || 0;
      const totalLevel = baseLevel + ipLevel;
      const diffMod = skill.system.diffMod || 1;
      const cost = totalLevel === 0 ? 10 * diffMod : totalLevel * 10 * diffMod;
      const currentIp = skill.system.ip || 0;

      if (currentIp >= cost) {
        await this.actor.updateEmbeddedDocuments("Item", [{
          _id: skillId,
          "system.ipLevel": ipLevel + 1,
          "system.ip": currentIp - cost
        }]);
        // Update Combat Sense modifier if this was a Combat Sense skill
        await this._updateCombatSenseMod();
      } else {
        ui.notifications.warn(`Not enough IP. Need ${cost}, have ${currentIp}.`);
      }
    });

    // Delete skill for new skills tab
    html.find('.skill-delete').click(ev => {
      const skillId = ev.currentTarget.dataset.skillId;
      const skill = this.actor.items.get(skillId);
      if (!skill) return;

      new Dialog({
        title: localize("ItemDeleteConfirmTitle"),
        content: `<p>${localizeParam("ItemDeleteConfirmText", {itemName: skill.name})}</p>`,
        buttons: {
          yes: {
            label: localize("Yes"),
            callback: async () => {
              await skill.delete();
              await this._updateCombatSenseMod();
            }
          },
          no: { label: localize("No") }
        },
        default: "no"
      }).render(true);
    });

    // Generic condition toggle (Stabilized, Fast Draw, Action Surge, etc.)
    html.find(".toggle-condition").change(async (ev) => {
      const conditionId = ev.target.dataset.condition;
      const isChecked = ev.target.checked;
      await this.actor.toggleStatusEffect(conditionId, { active: isChecked });
    });

    // Damage
    html.find(".damage").click(ev => {
      let damage = Number(ev.currentTarget.dataset.damage);
      this.actor.update({
        "system.damage": damage
      });
    });

    // Humanity restoration (therapy) - click lost dots to restore
    html.find('.humanity-dot.lost').click(async ev => {
      const targetHumanity = Number(ev.currentTarget.dataset.humanity);
      const emp = this.actor.system.stats.emp;
      const maxHumanity = emp.humanity?.base || (emp.base * 10);
      const currentHumanity = emp.humanity?.total || maxHumanity;

      if (targetHumanity > currentHumanity) {
        // Calculate new humanity damage to achieve target humanity
        const newDamage = maxHumanity - targetHumanity;
        await this.actor.update({
          "system.stats.emp.humanityDamage": Math.max(0, newDamage)
        });
      }
    });

    // Humanity restoration hover preview
    html.find('.humanity-dot').on('mouseenter', ev => {
      const targetHumanity = Number(ev.currentTarget.dataset.humanity);
      const emp = this.actor.system.stats.emp;
      const currentHumanity = emp.humanity?.total || 0;

      // Only show preview for lost dots when hovering
      if (targetHumanity <= currentHumanity) return;

      // Highlight all dots that would be restored
      html.find('.humanity-dot').each((i, dot) => {
        const dotValue = Number(dot.dataset.humanity);
        if (dotValue > currentHumanity && dotValue <= targetHumanity) {
          $(dot).addClass('restore-preview');
        }
      });
    });

    html.find('.humanity-dot').on('mouseleave', ev => {
      html.find('.humanity-dot').removeClass('restore-preview');
    });

    // Generic item roll
    html.find('.item-roll').click(ev => {
      ev.stopPropagation();
      let item = getEventItem(this, ev);
      item.roll();
    });

    // Edit item
    html.find('.item-edit').click(ev => {
      ev.stopPropagation();
      let item = getEventItem(this, ev);
      item.sheet.render(true);
    });

    // Delete item
    html.find('.item-delete').click(deleteItemDialog.bind(this));
    html.find('.rc-item-delete').bind("contextmenu", deleteItemDialog.bind(this));

    // ----- Gear Tab Event Listeners -----

    // View item (gear tab)
    html.find('.gear-view').click(ev => {
      ev.stopPropagation();
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (item) item.sheet.render(true);
    });

    // Delete item (gear tab)
    html.find('.gear-delete').click(ev => {
      ev.stopPropagation();
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (!item) return;

      new Dialog({
        title: localize("ItemDeleteConfirmTitle"),
        content: `<p>${localizeParam("ItemDeleteConfirmText", {itemName: item.name})}</p>`,
        buttons: {
          yes: {
            label: localize("Yes"),
            callback: () => item.delete()
          },
          no: { label: localize("No") }
        },
        default: "no"
      }).render(true);
    });

    // Reload weapon (gear tab)
    html.find('.reload-weapon').click(async ev => {
      const itemId = ev.currentTarget.dataset.itemId;
      const canReload = ev.currentTarget.dataset.canReload === 'true';
      if (!canReload) return;

      const item = this.actor.items.get(itemId);
      if (!item) return;

      // If the weapon uses ammo, open the reload dialog
      const ammoWT = weaponToAmmoType[item.system.weaponType];
      if (ammoWT) {
        new ReloadDialog(this.actor, item).render(true);
        return;
      }

      // Legacy instant reload for weapons without ammo mapping
      const maxShots = item.system.shots ?? 0;
      await this.actor.updateEmbeddedDocuments("Item", [{
        _id: itemId,
        "system.shotsLeft": maxShots
      }]);
    });

    // Ammo quantity input (gear tab)
    html.find('.ammo-quantity-input').change(async ev => {
      const itemId = ev.currentTarget.dataset.itemId;
      const newQty = Math.max(0, Number(ev.currentTarget.value) || 0);
      await this.actor.updateEmbeddedDocuments("Item", [{
        _id: itemId,
        "system.quantity": newQty
      }]);
    });

    // Toggle armor equipped (gear tab)
    html.find('.toggle-equip').click(async ev => {
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (!item) return;

      const currentEquipped = item.system.equipped ?? false;
      await this.actor.updateEmbeddedDocuments("Item", [{
        _id: itemId,
        "system.equipped": !currentEquipped
      }]);
    });

    // Toggle tool on/off (gear tab)
    html.find('.toggle-tool').click(async ev => {
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (!item) return;

      const currentEquipped = item.system.equipped ?? false;
      await item.update({ "system.equipped": !currentEquipped });
    });

    // Toggle drug use/wearoff (gear tab)
    html.find('.toggle-drug').click(async ev => {
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (!item) return;

      const isActive = item.system.equipped ?? false;
      if (isActive) {
        // Wearoff: deactivate and decrement quantity
        const newQty = (item.system.quantity ?? 1) - 1;
        if (newQty <= 0) {
          await item.delete();
        } else {
          await item.update({ "system.equipped": false, "system.quantity": newQty });
        }
      } else {
        // Use: activate the drug
        await item.update({ "system.equipped": true });
      }
    });

    // Fire weapon (gear tab) - clicking on icon or name
    html.find('.gear-fire-weapon').click(ev => {
      ev.stopPropagation();
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (!item) return;

      const isRanged = item.isRanged();
      const targetTokens = Array.from(game.users.current.targets.values()).map(target => {
        return {
          name: target.document.name,
          id: target.id
        };
      });

      let modifierGroups;
      if (isRanged) {
        modifierGroups = rangedModifiers(item, targetTokens);
      } else if (item.system.attackType === meleeAttackTypes.martial) {
        modifierGroups = martialOptions(this.actor);
      } else {
        modifierGroups = meleeBonkOptions();
      }

      const dialog = new ModifiersDialog(this.actor, {
        weapon: item,
        targetTokens: targetTokens,
        modifierGroups: modifierGroups,
        onConfirm: (fireOptions) => item.__weaponRoll(fireOptions, targetTokens)
      });
      dialog.render(true);
    });

    // "Fire" button for weapons
    html.find('.fire-weapon').click(ev => {
      ev.stopPropagation();
      let item = getEventItem(this, ev);
      let isRanged = item.isRanged();

      let modifierGroups = undefined;
      let targetTokens = Array.from(game.users.current.targets.values()).map(target => {
        return {
          name: target.document.name,
          id: target.id};
      });
      if(isRanged) {
        modifierGroups = rangedModifiers(item, targetTokens);
      }
      else if (item.system.attackType === meleeAttackTypes.martial){
        modifierGroups = martialOptions(this.actor);
      }
      else {
        modifierGroups = meleeBonkOptions();
      }

      let dialog = new ModifiersDialog(this.actor, {
        weapon: item,
        targetTokens: targetTokens,
        modifierGroups: modifierGroups,
        onConfirm: (fireOptions) => item.__weaponRoll(fireOptions, targetTokens)
      });
      dialog.render(true);
    });

    // ----- Cyberware Tab Event Listeners -----

    // Toggle cyberware on/off
    html.find('.toggle-cyberware').click(async ev => {
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (!item) return;

      const currentEquipped = item.system.equipped ?? true;
      const turningOn = !currentEquipped;
      const isStructurallyBroken = ev.currentTarget.dataset.structurallyBroken === 'true';

      // Broken limbs can be turned OFF but not ON
      if (turningOn && isStructurallyBroken) {
        ui.notifications.error(`Cannot activate: ${item.name} is broken and must be repaired first.`);
        return;
      }

      // Check for cyberlimb subtype limit BEFORE humanity roll
      if (turningOn) {
        const sys = item.system;
        if (sys.cyberwareType === 'cyberlimb' && !sys.isOption) {
          const subtype = sys.cyberwareSubtype;
          const limitedSubtypes = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

          if (limitedSubtypes.includes(subtype)) {
            // Check if there's already an active cyberlimb of the same subtype
            const existingActive = this.actor.items.find(i =>
              i.type === 'cyberware' &&
              i.id !== item.id &&
              i.system.cyberwareType === 'cyberlimb' &&
              !i.system.isOption &&
              i.system.cyberwareSubtype === subtype &&
              i.system.equipped
            );

            if (existingActive) {
              ui.notifications.error(`Cannot activate: ${existingActive.name} is already active for this location. Turn it off first.`);
              return;
            }
          }
        }
      }

      // If turning ON and humanity not yet rolled, auto-roll and apply permanently
      if (turningOn && !item.system.humanityRolled) {
        const formula = item.system.humanityCost;
        if (formula) {
          const roll = new Roll(formula);
          await roll.evaluate();

          // Store roll result on item and turn it on
          await item.update({
            "system.humanityLoss": roll.total,
            "system.humanityRolled": true,
            "system.equipped": true
          });

          // Apply PERMANENT humanity damage to actor
          const currentDamage = this.actor.system.stats.emp.humanityDamage || 0;
          await this.actor.update({
            "system.stats.emp.humanityDamage": currentDamage + roll.total
          });

          // Show roll in chat
          roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: `${item.name} - Humanity Loss`
          });

          return; // Already updated equipped state above
        }
      }

      // Normal toggle (humanity already rolled or no humanity cost)
      await this.actor.updateEmbeddedDocuments("Item", [{
        _id: itemId,
        "system.equipped": !currentEquipped
      }]);
    });

    // Roll humanity loss for cyberware (manual roll button)
    html.find('.humanity-roll-btn').click(async ev => {
      ev.preventDefault();
      ev.stopPropagation();

      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (!item) return;

      const formula = item.system.humanityCost;
      if (!formula || item.system.humanityRolled) return;

      const roll = new Roll(formula);
      await roll.evaluate();

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `${item.name} - Humanity Loss`
      });

      // Store roll result on item
      await this.actor.updateEmbeddedDocuments("Item", [{
        _id: itemId,
        "system.humanityLoss": roll.total,
        "system.humanityRolled": true
      }]);

      // Apply PERMANENT humanity damage to actor
      const currentDamage = this.actor.system.stats.emp.humanityDamage || 0;
      await this.actor.update({
        "system.stats.emp.humanityDamage": currentDamage + roll.total
      });
    });

    // Detach option from base cyberware
    html.find('.detach-option').click(async ev => {
      ev.preventDefault();
      ev.stopPropagation();

      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (!item) return;

      // Get parent cyberlimb before detaching (for SDP cap check)
      const parentId = item.getFlag('cp2020', 'attachedTo');
      const parent = parentId ? this.actor.items.get(parentId) : null;
      const optionSdpBonus = item.system.sdpBonus || 0;

      // Remove the attachment flag
      await item.unsetFlag('cp2020', 'attachedTo');

      // If parent is a cyberlimb and option had SDP bonus, cap current SDP to new max
      if (parent && parent.system.cyberwareType === 'cyberlimb' && optionSdpBonus > 0) {
        const baseMax = parent.system.structure?.max ?? 0;
        const currentSdp = parent.system.structure?.current ?? 0;

        // Calculate remaining SDP bonus from other attached options (excluding the one just detached)
        const remainingOptions = this.actor.items.filter(i =>
          i.type === 'cyberware' &&
          i.system.isOption &&
          i.id !== item.id &&
          i.getFlag('cp2020', 'attachedTo') === parentId
        );
        const remainingBonus = remainingOptions.reduce((sum, opt) => sum + (opt.system.sdpBonus || 0), 0);
        const newMaxSdp = baseMax + remainingBonus;

        // Cap current SDP if it exceeds new maximum
        if (currentSdp > newMaxSdp) {
          await parent.update({ "system.structure.current": newMaxSdp });
        }
      }
    });

    // Make detached options draggable
    html.find('.cyberware-option.detached').each((_, optionEl) => {
      optionEl.setAttribute('draggable', 'true');

      optionEl.addEventListener('dragstart', ev => {
        const itemId = optionEl.dataset.itemId;
        const cyberType = optionEl.dataset.cyberwareType;
        ev.dataTransfer.setData('text/plain', JSON.stringify({
          type: 'cyberware-option',
          itemId: itemId,
          cyberwareType: cyberType,
          actorId: this.actor.id
        }));
        optionEl.classList.add('is-dragging');
      });

      optionEl.addEventListener('dragend', () => {
        optionEl.classList.remove('is-dragging');
      });
    });

    // Make base cyberware drop targets for options
    html.find('.cyberware-row[data-is-base="true"]').each((_, baseEl) => {
      baseEl.addEventListener('dragover', ev => {
        ev.preventDefault();
        baseEl.classList.add('drag-over');
      });

      baseEl.addEventListener('dragleave', () => {
        baseEl.classList.remove('drag-over');
      });

      baseEl.addEventListener('drop', async ev => {
        ev.preventDefault();
        baseEl.classList.remove('drag-over');

        let data;
        try {
          data = JSON.parse(ev.dataTransfer.getData('text/plain'));
        } catch (err) {
          return;
        }

        if (data.type !== 'cyberware-option') return;
        if (data.actorId !== this.actor.id) return;

        const optionItem = this.actor.items.get(data.itemId);
        const baseItem = this.actor.items.get(baseEl.dataset.itemId);

        if (!optionItem || !baseItem) return;

        // Validate: option must match base cyberware type
        if (optionItem.system.cyberwareType !== baseItem.system.cyberwareType) {
          ui.notifications.warn("Option type must match base cyberware type.");
          return;
        }

        // Validate: option must be an option
        if (!optionItem.system.isOption) {
          ui.notifications.warn("Only options can be attached to base cyberware.");
          return;
        }

        // Validate: base must not be an option
        if (baseItem.system.isOption) {
          ui.notifications.warn("Cannot attach options to other options.");
          return;
        }

        // Validate: check available slots
        const usedSlots = this.actor.items
          .filter(i => i.type === 'cyberware' && i.getFlag('cp2020', 'attachedTo') === baseItem.id)
          .reduce((sum, i) => sum + (i.system.takesSpace || 1), 0);
        const availableSlots = baseItem.system.hasSlots || 0;
        const neededSlots = optionItem.system.takesSpace || 1;

        if (usedSlots + neededSlots > availableSlots) {
          ui.notifications.warn(`Not enough option slots. Available: ${availableSlots - usedSlots}, Needed: ${neededSlots}`);
          return;
        }

        // Attach option to base
        await optionItem.setFlag('cp2020', 'attachedTo', baseItem.id);

        // If option has SDP bonus and base is a cyberlimb, increase current SDP
        const optionSdpBonus = optionItem.system.sdpBonus || 0;
        if (optionSdpBonus > 0 && baseItem.system.cyberwareType === 'cyberlimb') {
          const currentSdp = baseItem.system.structure?.current ?? 0;
          const baseMax = baseItem.system.structure?.max ?? 0;

          // Calculate new max (base + all attached options' bonuses including this one)
          const allAttachedOptions = this.actor.items.filter(i =>
            i.type === 'cyberware' &&
            i.system.isOption &&
            i.getFlag('cp2020', 'attachedTo') === baseItem.id
          );
          const totalBonus = allAttachedOptions.reduce((sum, opt) => sum + (opt.system.sdpBonus || 0), 0);
          const newMaxSdp = baseMax + totalBonus;

          // Increase current SDP by the bonus (capped at new max)
          const newCurrentSdp = Math.min(currentSdp + optionSdpBonus, newMaxSdp);
          await baseItem.update({ "system.structure.current": newCurrentSdp });
        }
      });
    });

    function getNetrunProgramItem(sheet, ev) {
      ev.stopPropagation();
      const itemId = ev.currentTarget.closest(".netrun-program").dataset.itemId;
      return sheet.actor.items.get(itemId);
    }
    html.find('.netrun-program .fa-edit').click(ev => {
      const item = getNetrunProgramItem(this, ev);
      if (!item) return;
      item.sheet.render(true);
    });
    html.find('.netrun-program .fa-trash').click(ev => {
      const item = getNetrunProgramItem(this, ev);
      if (!item) return;
      let confirmDialog = new Dialog({
        title: localize("ItemDeleteConfirmTitle"),
        content: `<p>${localizeParam("ItemDeleteConfirmText", {itemName: item.name})}</p>`,
        buttons: {
          yes: {
            label: localize("Yes"),
            callback: () => item.delete()
          },
          no: { label: localize("No") },
        },
        default:"no"
      });
      confirmDialog.render(true);
    });

    // Netrun program drag and drop
    html.find('.netrun-program').each((_, programElem) => {
      programElem.setAttribute("draggable", true);

      programElem.addEventListener("dragstart", ev => {
        const itemId = programElem.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if ( !item ) return;

        const dragData = {
          type: "Item",
          actorId: this.actor.id,
          data: item.toObject()
        };

        ev.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        programElem.classList.add("is-dragging");
      });

      programElem.addEventListener("dragend", ev => {
        programElem.classList.remove("is-dragging");
      });
    });

    // Auto-save changes for fields with data-edit
    html.find('input[data-edit], select[data-edit], textarea[data-edit]').on('change', ev => {
      ev.preventDefault();
      const input = ev.currentTarget;
      const path = input.dataset.edit;
      const dtype = input.dataset.dtype;
      let value = input.value;

      if (dtype === "Number") {
        value = Number(value || 0);
        if (input.type === "checkbox") value = input.checked ? 1 : 0;
      }
      else if (dtype === "Boolean") {
        value = input.checked;
      }

      this.actor.update({ [path]: value });
    });

    // Interface skill roll
    const interfaceSkillElems = html.find('.interface-skill-roll');
    interfaceSkillElems.on('click', ev => {
      ev.preventDefault();
      const skillId = ev.currentTarget.dataset.skillId;
      if (!skillId) {
        ui.notifications.warn(localize("InterfaceSkillNotFound"));
        return;
      }
      this.actor.rollSkill(skillId);
    });

    // Active program context menu removal
    html.find('.netrun-active-icon').on('contextmenu', async ev => {
      ev.preventDefault();
      const div = ev.currentTarget;
      const itemId = div.dataset.itemId;
      if (!itemId) return;
      const currentActive = [...(this.actor.system.activePrograms || [])];
      const idx = currentActive.indexOf(itemId);
      if (idx < 0) return;

      currentActive.splice(idx, 1);

      let sumMU = 0;
      for (let progId of currentActive) {
        let progItem = this.actor.items.get(progId);
        if (!progItem) continue;
        sumMU += Number(progItem.system.mu) || 0;
      }

      await this.actor.update({
        "system.activePrograms": currentActive,
        "system.ramUsed": sumMU
      });

      ui.notifications.info(localize("ProgramDeactivated"));
    });

    // File picker for netrun icon
    html.find('.filepicker').on('click', async (ev) => {
      ev.preventDefault();
      const currentPath = this.actor.system.icon || "";

      const fp = new FilePicker({
        type: "image",
        current: currentPath,
        callback: (path) => {
          this.actor.update({"system.icon": path});
          html.find(".netrun-icon-frame img").attr("src", path);
          html.find('input[name="system.icon"]').val(path);
        },
        top: this.position.top + 40,
        left: this.position.left + 10
      });

      fp.render(true);
    });

    tabBeautifying(html[0]);
    html.find('.tab-selector').on('click', () => tabBeautifying(html[0]));
  }

  /**
   * Apply career skills and special skill from a role to the actor
   * Fetches skills by UUID and adds them to the character
   * @param {string} roleUUID - The UUID of the role item
   */
  async applyCareerSkills(roleUUID) {
    // Get role from compendium or item
    const role = await fromUuid(roleUUID);
    if (!role) return;

    // Combine career skills and special skill
    const careerSkills = role.system?.careerSkills || [];
    const specialSkill = role.system?.specialSkill;

    // Build list of skills to process
    const skillsToProcess = [...careerSkills];
    if (specialSkill?.uuid || specialSkill?.name) {
      skillsToProcess.push(specialSkill);
    }

    if (skillsToProcess.length === 0) return;

    // Get existing skill names on actor (lowercase for comparison)
    const existingSkillNames = this.actor.items
      .filter(i => i.type === "skill")
      .map(s => s.name.toLowerCase());

    // Find skills to add
    const skillsToAdd = [];
    for (const skillEntry of skillsToProcess) {
      // Support both old format (string) and new format (object with uuid/name)
      const skillName = typeof skillEntry === 'string' ? skillEntry : skillEntry.name;
      const skillUUID = typeof skillEntry === 'object' ? skillEntry.uuid : null;

      // Skip if actor already has this skill
      if (existingSkillNames.includes(skillName.toLowerCase())) continue;

      let skillData = null;

      // Try to fetch by UUID first (new format)
      if (skillUUID) {
        const skill = await fromUuid(skillUUID);
        if (skill) {
          skillData = skill.toObject();
        }
      }

      if (skillData) {
        skillData.system.isRoleSkill = true;
        // Remove the _id so Foundry generates a new one
        delete skillData._id;
        skillsToAdd.push(skillData);
      }
    }

    // Add skills to actor
    if (skillsToAdd.length > 0) {
      await this.actor.createEmbeddedDocuments("Item", skillsToAdd);
      ui.notifications.info(localize("CareerSkillsAdded", { count: skillsToAdd.length }));
    }
  }

  /**
   * Overridden Drag&Drop processing
   */
  async _onDropItem(event, data) {
    event.preventDefault();

    // Get dropped item first to check its type
    const item = await Item.implementation.fromDropData(data);
    if (!item) return;

    // Check for duplicate skills (by UUID or name)
    if (item.type === "skill") {
      // Check by UUID (using sourceId flag that Foundry sets on copied items)
      const existingByUUID = this.actor.items.find(i =>
        i.type === "skill" && i.flags?.core?.sourceId === item.uuid
      );
      if (existingByUUID) {
        ui.notifications.info("This skill is already added.");
        return;
      }
      // Also check by name as fallback
      const existingByName = this.actor.items.find(i =>
        i.type === "skill" && i.name.toLowerCase() === item.name.toLowerCase()
      );
      if (existingByName) {
        ui.notifications.info("This skill is already added.");
        return;
      }
    }

    // Handle ammo drops — stack by source UUID
    if (item.type === "ammo") {
      const droppedUuid = item.uuid;
      const packQty = Number(item.system.packSize) || 20;

      // Stack onto existing ammo from the same source
      const existing = this.actor.items.find(i =>
        i.type === "ammo" && i.system.sourceUuid === droppedUuid
      );
      if (existing) {
        const newQty = (Number(existing.system.quantity) || 0) + packQty;
        return this.actor.updateEmbeddedDocuments("Item", [{
          _id: existing.id,
          "system.quantity": newQty
        }]);
      }

      // Create new ammo item, storing the source UUID
      const newData = item.toObject();
      newData.system.quantity = packQty;
      newData.system.sourceUuid = droppedUuid;
      return this.actor.createEmbeddedDocuments("Item", [newData]);
    }

    // Handle role drops - works anywhere on the sheet
    if (item.type === "role") {
      // Update actor's role
      await this.actor.update({
        "system.role.uuid": item.uuid,
        "system.role.name": item.name
      });

      // Add career skills from the role
      await this.applyCareerSkills(item.uuid);
      return;
    }

    // Handle drug drops — stack by name, add unused by default
    if (item.type === "drug") {
      const existingDrug = this.actor.items.find(i =>
        i.type === "drug" && i.name === item.name
      );
      if (existingDrug) {
        const currentQty = existingDrug.system.quantity || 0;
        return this.actor.updateEmbeddedDocuments("Item", [{
          _id: existingDrug.id,
          "system.quantity": currentQty + 1
        }]);
      }
      // Create new with quantity=1, equipped=false
      const newData = item.toObject();
      newData.system.quantity = 1;
      newData.system.equipped = false;
      return this.actor.createEmbeddedDocuments("Item", [newData]);
    }

    // Handle ordnance drops — stack by name, increase charges
    if (item.type === "ordnance") {
      const existingOrdnance = this.actor.items.find(i =>
        i.type === "ordnance" && i.name === item.name
      );
      if (existingOrdnance) {
        const currentCharges = existingOrdnance.system.charges || 0;
        return this.actor.updateEmbeddedDocuments("Item", [{
          _id: existingOrdnance.id,
          "system.charges": currentCharges + 1
        }]);
      }
      // Create new with charges=1
      const newData = item.toObject();
      newData.system.charges = 1;
      return this.actor.createEmbeddedDocuments("Item", [newData]);
    }

    // Handle tool drops — add turned off by default
    if (item.type === "tool") {
      const newData = item.toObject();
      newData.system.equipped = false;
      return this.actor.createEmbeddedDocuments("Item", [newData]);
    }

    // Handle armor drops — add unequipped by default
    if (item.type === "armor") {
      const newData = item.toObject();
      newData.system.equipped = false;
      return this.actor.createEmbeddedDocuments("Item", [newData]);
    }

    const dropTarget = event.target.closest("[data-drop-target]");
    if (!dropTarget) return super._onDropItem(event, data);

    if (dropTarget.dataset.dropTarget === "program-list") {
      const itemData = item;

      if (itemData.type !== "program") {
        return ui.notifications.warn(localize("NotAProgram", { name: itemData.name }));
      }

      const sameActor = (data.actorId === this.actor.id);
      const existingItem = sameActor ? this.actor.items.get(itemData._id) : null;
      if (existingItem) {
        ui.notifications.warn(localize("ProgramAlreadyExists", { name: existingItem.name }));
        return;
      }

      return this.actor.createEmbeddedDocuments("Item", [ itemData ]);
    }

    if (dropTarget.dataset.dropTarget === "active-programs") {
      const itemData = item;

      if (itemData.type !== "program") {
        return ui.notifications.warn(localize("OnlyProgramsCanBeActivated", { name: itemData.name }));
      }

      let programItem = this.actor.items.get(itemData._id);
      if (!programItem) {
        const [created] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
        programItem = created;
      }

      const currentActive = this.actor.system.activePrograms || [];
      const newMu = Number(programItem.system.mu) || 0;

      const usedMu = currentActive.reduce((sum, id) => {
        const p = this.actor.items.get(id);
        return sum + (Number(p?.system.mu) || 0);
      }, 0);

      const ramMax = Number(this.actor.system.ramMax) || 0;

      if (ramMax && (usedMu + newMu) > ramMax) {
        return ui.notifications.warn(
          localize("NotEnoughRAM", { name: programItem.name, used: usedMu, max: ramMax })
        );
      }

      if (!currentActive.includes(programItem.id)) {
        currentActive.push(programItem.id);

        const totalMu = usedMu + newMu;
        await this.actor.update({
          "system.activePrograms": currentActive,
          "system.ramUsed": totalMu
        });

        this.render(true);
      }
      return;
    }

    return super._onDropItem(event, data);
  }
}
