import { availability, toolBonusProperties } from "../lookups.js";
import { CyberpunkItemSheet } from "./item-sheet-base.js";

/**
 * Tool Item Sheet with custom card design and tabs
 * @extends {CyberpunkItemSheet}
 */
export class CyberpunkToolSheet extends CyberpunkItemSheet {

    /** @type {string} */
    _activeTab = "description";

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["cyberpunk", "sheet", "item", "tool-sheet"],
            template: "systems/cp2020/templates/item/tool-sheet.hbs",
            dragDrop: [{ dropSelector: "[data-drop-target]" }]
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

        // --- Bonuses ---
        const rawBonuses = this.item.system.bonuses || [];
        const usedProperties = new Set(
            rawBonuses.filter(b => b.type === "property").map(b => b.property)
        );

        data.bonuses = rawBonuses.map(bonus => {
            if (bonus.type === "property") {
                const labelKey = toolBonusProperties[bonus.property];
                return {
                    ...bonus,
                    isProperty: true,
                    label: labelKey ? game.i18n.localize(`CYBERPUNK.${labelKey}`) : bonus.property
                };
            }
            // skill
            return {
                ...bonus,
                isSkill: true,
                hasFilled: !!(bonus.skillUuid),
                label: bonus.skillName || ""
            };
        });

        // Property dropdown options — exclude properties already in bonuses
        data.propertyOptions = Object.entries(toolBonusProperties)
            .filter(([key]) => !usedProperties.has(key))
            .map(([value, labelKey]) => ({
                value,
                label: game.i18n.localize(`CYBERPUNK.${labelKey}`)
            }));

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

        // Add property bonus
        html.find('.add-property').click(async ev => {
            ev.preventDefault();
            const bonuses = [...(this.item.system.bonuses || [])];
            const usedProperties = new Set(
                bonuses.filter(b => b.type === "property").map(b => b.property)
            );
            // Find first available property
            const firstAvailable = Object.keys(toolBonusProperties).find(k => !usedProperties.has(k));
            if (!firstAvailable) {
                ui.notifications.warn(game.i18n.localize("CYBERPUNK.DuplicateBonus"));
                return;
            }
            bonuses.push({ type: "property", property: firstAvailable, value: 0 });
            await this.item.update({ "system.bonuses": bonuses });
        });

        // Add skill bonus (empty slot)
        html.find('.add-skill').click(async ev => {
            ev.preventDefault();
            const bonuses = [...(this.item.system.bonuses || [])];
            bonuses.push({ type: "skill", skillUuid: "", skillName: "", value: 0 });
            await this.item.update({ "system.bonuses": bonuses });
        });

        // Remove bonus
        html.find('.remove-bonus').click(async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const index = parseInt(ev.currentTarget.dataset.index);
            const bonuses = [...(this.item.system.bonuses || [])];
            bonuses.splice(index, 1);
            await this.item.update({ "system.bonuses": bonuses });
        });

        // Property dropdown change
        html.find('.bonus-property-select').change(async ev => {
            const index = parseInt(ev.currentTarget.dataset.index);
            const newProperty = ev.currentTarget.value;
            const bonuses = [...(this.item.system.bonuses || [])];
            // Check for duplicate
            if (bonuses.some((b, i) => i !== index && b.type === "property" && b.property === newProperty)) {
                ui.notifications.warn(game.i18n.localize("CYBERPUNK.DuplicateBonus"));
                this.render(false);
                return;
            }
            bonuses[index] = { ...bonuses[index], property: newProperty };
            await this.item.update({ "system.bonuses": bonuses });
        });

        // Bonus value change
        html.find('.bonus-value-input').change(async ev => {
            const index = parseInt(ev.currentTarget.dataset.index);
            const value = parseInt(ev.currentTarget.value) || 0;
            const bonuses = [...(this.item.system.bonuses || [])];
            bonuses[index] = { ...bonuses[index], value };
            await this.item.update({ "system.bonuses": bonuses });
        });
    }

    /** @override */
    async _onDrop(event) {
        event.preventDefault();

        // Only allow drops when unlocked
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

        // Only accept skill items
        if (item.type !== "skill") {
            ui.notifications.warn(game.i18n.localize("CYBERPUNK.OnlySkillsCanBeAdded"));
            return;
        }

        const bonuses = [...(this.item.system.bonuses || [])];

        // Check duplicate: no existing bonus with same skillUuid or skillName
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

        // Look for first empty skill slot
        const emptyIndex = bonuses.findIndex(b => b.type === "skill" && !b.skillUuid);
        if (emptyIndex >= 0) {
            bonuses[emptyIndex] = {
                ...bonuses[emptyIndex],
                skillUuid: item.uuid,
                skillName: item.name
            };
        } else {
            // Append new filled skill bonus
            bonuses.push({ type: "skill", skillUuid: item.uuid, skillName: item.name, value: 0 });
        }

        await this.item.update({ "system.bonuses": bonuses });
    }
}
