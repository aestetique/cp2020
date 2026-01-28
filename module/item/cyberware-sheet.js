import {
    availability, concealability, reliability,
    weaponCategories, rangedSubtypes, meleeDamageTypes, exoticEffects,
    getWeaponCategory, getAttackSkillsForWeapon,
    ammoCalibersByWeaponType, weaponToAmmoType,
    toolBonusProperties,
    cyberwareTypes, cyberwareSubtypes, surgeryCodes,
    getCyberwareSubtypes, canHaveOptions, canBeWeapon, canBeArmor
} from "../lookups.js";
import { CyberpunkItemSheet } from "./item-sheet-base.js";

/**
 * Cyberware Item Sheet with custom card design and conditional tabs
 * @extends {CyberpunkItemSheet}
 */
export class CyberpunkCyberwareSheet extends CyberpunkItemSheet {

    /** @type {string} */
    _activeTab = "description";

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["cyberpunk", "sheet", "item", "cyberware-sheet"],
            template: "systems/cp2020/templates/item/cyberware-sheet.hbs",
            width: 500,
            height: 400,
            dragDrop: [{ dropSelector: "[data-drop-target]" }]
        });
    }

    /** @override */
    getData() {
        const data = super.getData();
        data.activeTab = this._activeTab;

        const sys = data.system;
        const cyberType = sys.cyberwareType || "implant";

        // --- Type/Category Flags ---
        data.cyberwareType = cyberType;
        data.isSensor = cyberType === "sensor";
        data.isCyberlimb = cyberType === "cyberlimb";
        data.isImplant = cyberType === "implant";
        data.isChipware = cyberType === "chipware";
        data.isSkillChip = cyberType === "chipware" && sys.cyberwareSubtype === "skill";

        // --- Option/Slot Logic ---
        data.canHaveOptions = canHaveOptions(cyberType);
        data.isOption = sys.isOption || false;
        data.showStructure = cyberType === "cyberlimb" && !sys.isOption;
        data.showSdpBonus = cyberType === "cyberlimb" && sys.isOption;

        // --- Weapon/Armor Capability ---
        data.canBeWeapon = canBeWeapon(cyberType, sys.isOption);
        data.canBeArmor = canBeArmor(cyberType);
        data.isWeapon = sys.isWeapon && data.canBeWeapon;
        data.isArmor = sys.isArmor && data.canBeArmor;

        // --- Tab Configuration ---
        data.showWeaponTab = data.isWeapon;
        data.showArmorTab = data.isArmor;

        // Validate active tab - if current tab is hidden, switch to description
        if (this._activeTab === "weapon" && !data.showWeaponTab) {
            this._activeTab = "description";
            data.activeTab = "description";
        }
        if (this._activeTab === "armor" && !data.showArmorTab) {
            this._activeTab = "description";
            data.activeTab = "description";
        }

        // --- Humanity Roll State ---
        data.humanityRolled = sys.humanityRolled || false;
        data.canRollHumanity = !data.humanityRolled && sys.humanityCost;

        // --- Cyberware Type Dropdown ---
        data.cyberwareTypeOptions = Object.entries(cyberwareTypes).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: cyberType === value
        }));
        const selectedTypeKey = cyberwareTypes[cyberType] || "CyberTypeImplant";
        data.selectedTypeLabel = game.i18n.localize(`CYBERPUNK.${selectedTypeKey}`);

        // --- Cyberware Subtype Dropdown ---
        const subtypes = getCyberwareSubtypes(cyberType);
        data.cyberwareSubtypeOptions = Object.entries(subtypes).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: sys.cyberwareSubtype === value
        }));
        const selectedSubKey = subtypes[sys.cyberwareSubtype];
        data.selectedSubtypeLabel = selectedSubKey
            ? game.i18n.localize(`CYBERPUNK.${selectedSubKey}`)
            : "";

        // --- Surgery Code Dropdown ---
        data.surgeryCodeOptions = Object.entries(surgeryCodes).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: sys.surgeryCode === value
        }));
        const selectedSurgKey = surgeryCodes[sys.surgeryCode] || "SurgHarmless";
        data.selectedSurgeryLabel = game.i18n.localize(`CYBERPUNK.${selectedSurgKey}`);

        // --- Availability Dropdown ---
        data.availabilityOptions = Object.entries(availability).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: sys.availability === value
        }));
        const selectedAvail = availability[sys.availability] || "Common";
        data.selectedAvailabilityLabel = game.i18n.localize(`CYBERPUNK.${selectedAvail}`);

        // --- Chipware Skill Chip ---
        if (data.isSkillChip) {
            data.chipValueOptions = [1, 2, 3].map(v => ({
                value: v,
                label: v.toString(),
                selected: sys.chipValue === v
            }));
            data.hasChippedSkill = !!(sys.chippedSkill?.uuid || sys.chippedSkill?.name);
        }

        // --- Bonuses (Effect Tab) ---
        data.bonuses = this._prepareBonuses(sys.bonuses || []);
        data.propertyOptions = this._getAvailablePropertyOptions(sys.bonuses || []);

        // --- Weapon Tab Data ---
        if (data.showWeaponTab) {
            this._prepareWeaponData(data);
        }

        // --- Armor Tab Data ---
        if (data.showArmorTab) {
            this._prepareArmorData(data);
        }

        return data;
    }

    /**
     * Prepare bonuses array for display
     */
    _prepareBonuses(rawBonuses) {
        return rawBonuses.map(bonus => {
            if (bonus.type === "property") {
                const labelKey = toolBonusProperties[bonus.property];
                return {
                    ...bonus,
                    isProperty: true,
                    label: labelKey ? game.i18n.localize(`CYBERPUNK.${labelKey}`) : bonus.property
                };
            }
            return {
                ...bonus,
                isSkill: true,
                hasFilled: !!(bonus.skillUuid),
                label: bonus.skillName || ""
            };
        });
    }

    /**
     * Get available property options (excluding already used ones)
     */
    _getAvailablePropertyOptions(bonuses) {
        const usedProperties = new Set(
            bonuses.filter(b => b.type === "property").map(b => b.property)
        );
        return Object.entries(toolBonusProperties)
            .filter(([key]) => !usedProperties.has(key))
            .map(([value, labelKey]) => ({
                value,
                label: game.i18n.localize(`CYBERPUNK.${labelKey}`)
            }));
    }

    /**
     * Prepare weapon tab data
     */
    _prepareWeaponData(data) {
        const weapon = data.system.weapon || {};
        const weaponType = weapon.weaponType || "Melee";
        const category = getWeaponCategory(weaponType);

        data.weaponCategory = category;
        data.weaponIsRanged = category === "ranged";
        data.weaponIsMelee = category === "melee";
        data.weaponIsExotic = category === "exotic";

        // Category dropdown
        data.weaponCategoryOptions = Object.entries(weaponCategories).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: category === value
        }));
        data.selectedWeaponCategoryLabel = game.i18n.localize(
            `CYBERPUNK.${weaponCategories[category]}`
        );

        // Concealability
        data.weaponConcealabilityOptions = Object.entries(concealability).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: weapon.concealability === value
        }));
        const selectedConceal = concealability[weapon.concealability] || "ConcealHidden";
        data.selectedWeaponConcealabilityLabel = game.i18n.localize(`CYBERPUNK.${selectedConceal}`);

        // Reliability
        data.weaponReliabilityOptions = Object.entries(reliability).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: weapon.reliability === value
        }));
        const selectedRel = reliability[weapon.reliability] || "Standard";
        data.selectedWeaponReliabilityLabel = game.i18n.localize(`CYBERPUNK.${selectedRel}`);

        // Ranged-specific
        if (data.weaponIsRanged) {
            data.weaponSubtypeOptions = Object.entries(rangedSubtypes).map(([value, labelKey]) => ({
                value,
                label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
                selected: weaponType === value
            }));
            const selectedSub = rangedSubtypes[weaponType] || "SubPistol";
            data.selectedWeaponSubtypeLabel = game.i18n.localize(`CYBERPUNK.${selectedSub}`);

            const ammoKey = weaponToAmmoType[weaponType];
            const calibers = ammoKey ? (ammoCalibersByWeaponType[ammoKey] || {}) : {};
            data.weaponHasCaliber = Object.keys(calibers).length > 0;
            data.weaponCaliberOptions = Object.entries(calibers).map(([value, labelKey]) => ({
                value,
                label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
                selected: weapon.caliber === value
            }));
            const selectedCal = calibers[weapon.caliber];
            data.selectedWeaponCaliberLabel = selectedCal
                ? game.i18n.localize(`CYBERPUNK.${selectedCal}`)
                : "";
        }

        // Melee-specific
        if (data.weaponIsMelee) {
            data.weaponDamageTypeOptions = Object.entries(meleeDamageTypes).map(([value, labelKey]) => ({
                value,
                label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
                selected: weapon.damageType === value
            }));
            const selectedDT = meleeDamageTypes[weapon.damageType] || "DmgEdged";
            data.selectedWeaponDamageTypeLabel = game.i18n.localize(`CYBERPUNK.${selectedDT}`);
        }

        // Exotic-specific
        if (data.weaponIsExotic) {
            const effectKeys = Object.keys(exoticEffects);
            const currentEffect = weapon.effect || effectKeys[0];
            data.weaponEffectOptions = Object.entries(exoticEffects).map(([value, labelKey]) => ({
                value,
                label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
                selected: currentEffect === value
            }));
            const selectedEff = exoticEffects[currentEffect] || exoticEffects[effectKeys[0]];
            data.selectedWeaponEffectLabel = game.i18n.localize(`CYBERPUNK.${selectedEff}`);
        }

        // Attack Skill (melee + exotic)
        if (data.weaponIsMelee || data.weaponIsExotic) {
            const skillsList = getAttackSkillsForWeapon(weaponType);
            const currentSkill = weapon.attackSkill || skillsList[0] || "";
            data.weaponAttackSkillOptions = skillsList.map(skillName => ({
                value: skillName,
                label: game.i18n.has(`CYBERPUNK.Skill${skillName}`)
                    ? game.i18n.localize(`CYBERPUNK.Skill${skillName}`)
                    : skillName,
                selected: currentSkill === skillName
            }));
            data.selectedWeaponAttackSkillLabel = currentSkill
                ? (game.i18n.has(`CYBERPUNK.Skill${currentSkill}`)
                    ? game.i18n.localize(`CYBERPUNK.Skill${currentSkill}`)
                    : currentSkill)
                : "";
        }
    }

    /**
     * Prepare armor tab data
     */
    _prepareArmorData(data) {
        const armor = data.system.armor || {};

        data.armorTypeOptions = [
            { value: "soft", label: game.i18n.localize("CYBERPUNK.SoftArmor"), selected: armor.armorType === "soft" },
            { value: "hard", label: game.i18n.localize("CYBERPUNK.HardArmor"), selected: armor.armorType === "hard" }
        ];
        data.selectedArmorTypeLabel = armor.armorType === "hard"
            ? game.i18n.localize("CYBERPUNK.HardArmor")
            : game.i18n.localize("CYBERPUNK.SoftArmor");

        // Coverage grid (same pattern as outfit-sheet)
        const locationOrder = [
            { key: "lArm", label: "Left Arm" },
            { key: "Head", label: "Head" },
            { key: "rArm", label: "Right Arm" },
            { key: "lLeg", label: "Left Leg" },
            { key: "Torso", label: "Torso" },
            { key: "rLeg", label: "Right Leg" }
        ];

        const coverage = armor.coverage || {};
        data.coverageRows = [
            locationOrder.slice(0, 3),
            locationOrder.slice(3, 6)
        ].map(row => row.map(loc => {
            const cov = coverage[loc.key] || { stoppingPower: 0, ablation: 0 };
            const maxSP = Number(cov.stoppingPower) || 0;
            const ablation = Number(cov.ablation) || 0;
            const currentSP = Math.max(0, maxSP - ablation);
            return {
                key: loc.key,
                label: loc.label,
                currentSP,
                maxSP,
                isDamaged: currentSP < maxSP
            };
        }));
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Tab switching
        html.find('.tab-header').click(ev => {
            ev.preventDefault();
            const tab = ev.currentTarget.dataset.tab;
            if (tab && tab !== this._activeTab) {
                this._activeTab = tab;
                this.render(false);
            }
        });

        // Humanity roll button
        html.find('.humanity-roll-btn').click(async ev => {
            ev.preventDefault();
            if (this._isLocked) return;
            if (this.item.system.humanityRolled) return;
            await this._rollHumanity();
        });

        // Click skill name to open its sheet
        html.find('.skill-name[data-uuid]').click(async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const uuid = ev.currentTarget.dataset.uuid;
            if (uuid) {
                const item = await fromUuid(uuid);
                if (item) item.sheet.render(true);
            }
        });

        if (this._isLocked) return;

        // --- Checkbox toggle (standard pattern from ordnance-sheet) ---
        html.find('.checkbox-toggle').click(async ev => {
            ev.preventDefault();
            const field = ev.currentTarget.dataset.field;
            if (!field) return;
            const current = foundry.utils.getProperty(this.item, field);
            await this.item.update({ [field]: !current });
        });

        // --- Cyberware Type change → reset subtype and flags ---
        html.find('select[name="system.cyberwareType"]').change(async ev => {
            const newType = ev.currentTarget.value;
            const subtypes = getCyberwareSubtypes(newType);
            const firstSubtype = Object.keys(subtypes)[0] || "";
            await this.item.update({
                "system.cyberwareType": newType,
                "system.cyberwareSubtype": firstSubtype,
                "system.isOption": false,
                "system.isWeapon": false,
                "system.isArmor": false
            });
        });

        // --- Weapon Category change ---
        html.find('select[name="weaponCategory"]').change(async ev => {
            const newCategory = ev.currentTarget.value;
            let newWeaponType;
            if (newCategory === "melee") newWeaponType = "Melee";
            else if (newCategory === "exotic") newWeaponType = "Exotic";
            else newWeaponType = "Pistol";

            const updates = { "system.weapon.weaponType": newWeaponType };
            if (newCategory === "ranged") {
                const ammoKey = weaponToAmmoType[newWeaponType];
                const calibers = ammoKey ? Object.keys(ammoCalibersByWeaponType[ammoKey] || {}) : [];
                updates["system.weapon.caliber"] = calibers[0] || "";
            }
            await this.item.update(updates);
        });

        // --- Weapon Subtype change ---
        html.find('select[name="weaponSubtype"]').change(async ev => {
            const newSubtype = ev.currentTarget.value;
            const ammoKey = weaponToAmmoType[newSubtype];
            const calibers = ammoKey ? Object.keys(ammoCalibersByWeaponType[ammoKey] || {}) : [];
            await this.item.update({
                "system.weapon.weaponType": newSubtype,
                "system.weapon.caliber": calibers[0] || ""
            });
        });

        // --- Armor current SP input ---
        html.find('.sp-current-input').change(async ev => {
            const input = ev.currentTarget;
            const key = input.dataset.key;
            const maxSP = Number(input.dataset.max) || 0;
            const newCurrent = Math.max(0, Math.min(maxSP, Number(input.value) || 0));
            const ablation = maxSP - newCurrent;
            await this.item.update({ [`system.armor.coverage.${key}.ablation`]: ablation });
        });

        // --- Bonuses management (same as tool-sheet) ---
        html.find('.add-property').click(async ev => {
            ev.preventDefault();
            const bonuses = [...(this.item.system.bonuses || [])];
            const usedProperties = new Set(
                bonuses.filter(b => b.type === "property").map(b => b.property)
            );
            const firstAvailable = Object.keys(toolBonusProperties).find(k => !usedProperties.has(k));
            if (!firstAvailable) {
                ui.notifications.warn(game.i18n.localize("CYBERPUNK.DuplicateBonus"));
                return;
            }
            bonuses.push({ type: "property", property: firstAvailable, value: 0 });
            await this.item.update({ "system.bonuses": bonuses });
        });

        html.find('.add-skill').click(async ev => {
            ev.preventDefault();
            const bonuses = [...(this.item.system.bonuses || [])];
            bonuses.push({ type: "skill", skillUuid: "", skillName: "", value: 0 });
            await this.item.update({ "system.bonuses": bonuses });
        });

        html.find('.remove-bonus').click(async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const index = parseInt(ev.currentTarget.dataset.index);
            const bonuses = [...(this.item.system.bonuses || [])];
            bonuses.splice(index, 1);
            await this.item.update({ "system.bonuses": bonuses });
        });

        html.find('.bonus-property-select').change(async ev => {
            const index = parseInt(ev.currentTarget.dataset.index);
            const newProperty = ev.currentTarget.value;
            const bonuses = [...(this.item.system.bonuses || [])];
            if (bonuses.some((b, i) => i !== index && b.type === "property" && b.property === newProperty)) {
                ui.notifications.warn(game.i18n.localize("CYBERPUNK.DuplicateBonus"));
                this.render(false);
                return;
            }
            bonuses[index] = { ...bonuses[index], property: newProperty };
            await this.item.update({ "system.bonuses": bonuses });
        });

        html.find('.bonus-value-input').change(async ev => {
            const index = parseInt(ev.currentTarget.dataset.index);
            const value = parseInt(ev.currentTarget.value) || 0;
            const bonuses = [...(this.item.system.bonuses || [])];
            bonuses[index] = { ...bonuses[index], value };
            await this.item.update({ "system.bonuses": bonuses });
        });

        // --- Clear chipped skill ---
        html.find('.remove-chipped-skill').click(async ev => {
            ev.preventDefault();
            await this.item.update({ "system.chippedSkill": { uuid: "", name: "" } });
        });
    }

    /**
     * Roll humanity cost and save the result
     */
    async _rollHumanity() {
        const formula = this.item.system.humanityCost;
        if (!formula) return;

        const roll = new Roll(formula);
        await roll.evaluate();

        await roll.toMessage({
            speaker: ChatMessage.getSpeaker(),
            flavor: `${this.item.name} - Humanity Loss`
        });

        await this.item.update({
            "system.humanityLoss": roll.total,
            "system.humanityRolled": true
        });
    }

    /** @override */
    async _onDrop(event) {
        event.preventDefault();
        if (this._isLocked) return;

        let data;
        try {
            data = JSON.parse(event.dataTransfer.getData('text/plain'));
        } catch (err) {
            return;
        }

        if (data.type !== "Item") return;

        const item = await Item.implementation.fromDropData(data);
        if (!item) return;

        if (item.type !== "skill") {
            ui.notifications.warn(game.i18n.localize("CYBERPUNK.OnlySkillsCanBeAdded"));
            return;
        }

        // Determine drop target
        const dropTarget = event.target.closest('[data-drop-target]');
        const targetType = dropTarget?.dataset.dropTarget;

        // Chipped skill for chipware
        if (targetType === "chipped-skill") {
            await this.item.update({
                "system.chippedSkill": {
                    uuid: item.uuid,
                    name: item.name
                }
            });
            return;
        }

        // Effect bonus skill
        const bonuses = [...(this.item.system.bonuses || [])];
        const isDuplicate = bonuses.some(b =>
            b.type === "skill" && b.skillUuid && (
                b.skillUuid === item.uuid ||
                b.skillName.toLowerCase() === item.name.toLowerCase()
            )
        );
        if (isDuplicate) {
            ui.notifications.warn(game.i18n.localize("CYBERPUNK.DuplicateBonus"));
            return;
        }

        const emptyIndex = bonuses.findIndex(b => b.type === "skill" && !b.skillUuid);
        if (emptyIndex >= 0) {
            bonuses[emptyIndex] = { ...bonuses[emptyIndex], skillUuid: item.uuid, skillName: item.name };
        } else {
            bonuses.push({ type: "skill", skillUuid: item.uuid, skillName: item.name, value: 0 });
        }

        await this.item.update({ "system.bonuses": bonuses });
    }
}
