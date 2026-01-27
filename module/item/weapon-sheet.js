import {
    availability, concealability, reliability,
    weaponCategories, rangedSubtypes, meleeDamageTypes, exoticEffects,
    getWeaponCategory, getAttackSkillsForWeapon,
    ammoCalibersByWeaponType, weaponToAmmoType
} from "../lookups.js";
import { CyberpunkItemSheet } from "./item-sheet-base.js";

/**
 * Weapon Item Sheet with custom card design and tabs
 * @extends {CyberpunkItemSheet}
 */
export class CyberpunkWeaponSheet extends CyberpunkItemSheet {

    /** @type {string} */
    _activeTab = "description";

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["cyberpunk", "sheet", "item", "weapon-sheet"],
            template: "systems/cp2020/templates/item/weapon-sheet.hbs"
        });
    }

    /** @override */
    getData() {
        const data = super.getData();
        data.activeTab = this._activeTab;

        const weaponType = data.system.weaponType || "Pistol";
        const category = getWeaponCategory(weaponType);
        data.weaponCategory = category;
        data.isRanged = category === "ranged";
        data.isMelee = category === "melee";
        data.isExotic = category === "exotic";

        // --- Weapon Category dropdown ---
        data.weaponCategoryOptions = Object.entries(weaponCategories).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: category === value
        }));
        data.selectedWeaponCategoryLabel = game.i18n.localize(
            `CYBERPUNK.${weaponCategories[category]}`
        );

        // --- Availability dropdown ---
        data.availabilityOptions = Object.entries(availability).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: data.system.availability === value
        }));
        const selectedAvail = availability[data.system.availability] || "Common";
        data.selectedAvailabilityLabel = game.i18n.localize(`CYBERPUNK.${selectedAvail}`);

        // --- Concealability dropdown ---
        data.concealabilityOptions = Object.entries(concealability).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: data.system.concealability === value
        }));
        const selectedConceal = concealability[data.system.concealability] || "ConcealPocket";
        data.selectedConcealabilityLabel = game.i18n.localize(`CYBERPUNK.${selectedConceal}`);

        // --- Reliability dropdown ---
        data.reliabilityOptions = Object.entries(reliability).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: data.system.reliability === value
        }));
        const selectedRel = reliability[data.system.reliability] || "Standard";
        data.selectedReliabilityLabel = game.i18n.localize(`CYBERPUNK.${selectedRel}`);

        // --- Ranged-specific ---
        if (data.isRanged) {
            // Subtype dropdown
            data.subtypeOptions = Object.entries(rangedSubtypes).map(([value, labelKey]) => ({
                value,
                label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
                selected: weaponType === value
            }));
            const selectedSub = rangedSubtypes[weaponType] || "SubPistol";
            data.selectedSubtypeLabel = game.i18n.localize(`CYBERPUNK.${selectedSub}`);

            // Caliber dropdown (from ammo system)
            const ammoKey = weaponToAmmoType[weaponType];
            const calibers = ammoKey ? (ammoCalibersByWeaponType[ammoKey] || {}) : {};
            data.hasCaliber = Object.keys(calibers).length > 0;
            data.caliberOptions = Object.entries(calibers).map(([value, labelKey]) => ({
                value,
                label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
                selected: data.system.caliber === value
            }));
            const selectedCal = calibers[data.system.caliber];
            data.selectedCaliberLabel = selectedCal
                ? game.i18n.localize(`CYBERPUNK.${selectedCal}`)
                : "";
        }

        // --- Melee-specific ---
        if (data.isMelee) {
            data.damageTypeOptions = Object.entries(meleeDamageTypes).map(([value, labelKey]) => ({
                value,
                label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
                selected: data.system.damageType === value
            }));
            const selectedDT = meleeDamageTypes[data.system.damageType] || "DmgBlunt";
            data.selectedDamageTypeLabel = game.i18n.localize(`CYBERPUNK.${selectedDT}`);
        }

        // --- Exotic-specific ---
        if (data.isExotic) {
            const effectKeys = Object.keys(exoticEffects);
            const currentEffect = data.system.effect || effectKeys[0];
            data.effectOptions = Object.entries(exoticEffects).map(([value, labelKey]) => ({
                value,
                label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
                selected: currentEffect === value
            }));
            const selectedEff = exoticEffects[currentEffect] || exoticEffects[effectKeys[0]];
            data.selectedEffectLabel = game.i18n.localize(`CYBERPUNK.${selectedEff}`);
        }

        // --- Attack Skill dropdown (melee + exotic) ---
        if (data.isMelee || data.isExotic) {
            const skillsList = getAttackSkillsForWeapon(weaponType);
            const currentSkill = data.system.attackSkill || skillsList[0] || "";
            data.attackSkillOptions = skillsList.map(skillName => ({
                value: skillName,
                label: game.i18n.has(`CYBERPUNK.Skill${skillName}`)
                    ? game.i18n.localize(`CYBERPUNK.Skill${skillName}`)
                    : skillName,
                selected: currentSkill === skillName
            }));
            data.selectedAttackSkillLabel = currentSkill
                ? (game.i18n.has(`CYBERPUNK.Skill${currentSkill}`)
                    ? game.i18n.localize(`CYBERPUNK.Skill${currentSkill}`)
                    : currentSkill)
                : "";
        }

        return data;
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

        if (this._isLocked) return;

        // Weapon Category change → reset weaponType
        html.find('select[name="weaponCategory"]').change(async ev => {
            const newCategory = ev.currentTarget.value;
            let newWeaponType;
            if (newCategory === "melee") newWeaponType = "Melee";
            else if (newCategory === "exotic") newWeaponType = "Exotic";
            else newWeaponType = "Pistol";

            const updates = { "system.weaponType": newWeaponType };
            if (newCategory === "ranged") {
                const ammoKey = weaponToAmmoType[newWeaponType];
                const calibers = ammoKey ? Object.keys(ammoCalibersByWeaponType[ammoKey] || {}) : [];
                updates["system.caliber"] = calibers[0] || "";
            }
            await this.item.update(updates);
        });

        // Subtype change → updates weaponType, resets caliber
        html.find('select[name="weaponSubtype"]').change(async ev => {
            const newSubtype = ev.currentTarget.value;
            const ammoKey = weaponToAmmoType[newSubtype];
            const calibers = ammoKey ? Object.keys(ammoCalibersByWeaponType[ammoKey] || {}) : [];
            await this.item.update({
                "system.weaponType": newSubtype,
                "system.caliber": calibers[0] || ""
            });
        });
    }
}
