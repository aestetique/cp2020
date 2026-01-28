import { availability, programClasses } from "../lookups.js";
import { CyberpunkItemSheet } from "./item-sheet-base.js";

/**
 * Program Item Sheet with custom card design
 * @extends {CyberpunkItemSheet}
 */
export class CyberpunkProgramSheet extends CyberpunkItemSheet {

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["cyberpunk", "sheet", "item", "program-sheet"],
            template: "systems/cp2020/templates/item/program-sheet.hbs"
        });
    }

    /** @override */
    getData() {
        const data = super.getData();

        // --- Availability dropdown ---
        data.availabilityOptions = Object.entries(availability).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: data.system.availability === value
        }));
        const selectedAvail = availability[data.system.availability] || "Common";
        data.selectedAvailabilityLabel = game.i18n.localize(`CYBERPUNK.${selectedAvail}`);

        // --- Program class dropdown ---
        data.programClassOptions = Object.entries(programClasses).map(([value, labelKey]) => ({
            value,
            label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
            selected: data.system.programType === value
        }));
        const selectedClass = programClasses[data.system.programType] || "ProgramUtility";
        data.selectedProgramClassLabel = game.i18n.localize(`CYBERPUNK.${selectedClass}`);

        return data;
    }
}
