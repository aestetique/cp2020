import {
    availability, concealability, reliability, exoticEffects,
    ordnanceTemplateTypes, getAttackSkillsForOrdnance
} from "../lookups.js";
import { CyberpunkItemSheet } from "./item-sheet-base.js";

/**
 * Ordnance Item Sheet with custom card design and tabs
 * @extends {CyberpunkItemSheet}
 */
export class CyberpunkOrdnanceSheet extends CyberpunkItemSheet {

    /** @type {string} */
    _activeTab = "description";

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["cyberpunk", "sheet", "item", "ordnance-sheet"],
            template: "systems/cp2020/templates/item/ordnance-sheet.hbs"
        });
    }

    /** @override */
    getData() {
        const data = super.getData();
        data.activeTab = this._activeTab;

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

        // --- Effect dropdown ---
        const effectKeys = Object.keys(exoticEffects);
        const currentEffect = data.system.effect || effectKeys[0];
        data.effectOptions = Object.entries(exoticEffects).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: currentEffect === value
        }));
        const selectedEff = exoticEffects[currentEffect] || exoticEffects[effectKeys[0]];
        data.selectedEffectLabel = game.i18n.localize(`CYBERPUNK.${selectedEff}`);

        // --- Attack Skill dropdown ---
        const skillsList = getAttackSkillsForOrdnance();
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

        // --- Template Type dropdown ---
        const currentTemplate = data.system.templateType || "circle";
        data.templateTypeOptions = Object.entries(ordnanceTemplateTypes).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: currentTemplate === value
        }));
        const selectedTT = ordnanceTemplateTypes[currentTemplate] || "TemplateCircle";
        data.selectedTemplateTypeLabel = game.i18n.localize(`CYBERPUNK.${selectedTT}`);

        // Radius label changes based on template type
        data.radiusLabel = currentTemplate === "beam"
            ? game.i18n.localize("CYBERPUNK.WidthMeters")
            : game.i18n.localize("CYBERPUNK.RadiusMeters");

        // Checkbox state
        data.removeOnZero = !!data.system.removeOnZero;

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

        // Checkbox toggle
        html.find('.checkbox-toggle').click(async ev => {
            ev.preventDefault();
            const field = ev.currentTarget.dataset.field;
            if (!field) return;
            const current = foundry.utils.getProperty(this.item, field);
            await this.item.update({ [field]: !current });
        });
    }
}
