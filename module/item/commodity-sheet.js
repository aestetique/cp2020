import { availability } from "../lookups.js";
import { CyberpunkItemSheet } from "./item-sheet-base.js";

/**
 * Commodity Item Sheet with custom card design
 * @extends {CyberpunkItemSheet}
 */
export class CyberpunkCommoditySheet extends CyberpunkItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cyberpunk", "sheet", "item", "commodity-sheet"],
      template: "systems/cp2020/templates/item/commodity-sheet.hbs"
    });
  }

  /** @override */
  getData() {
    const data = super.getData();

    // Availability options for dropdown
    data.availabilityOptions = Object.entries(availability).map(([value, labelKey]) => ({
      value,
      label: game.i18n.localize(`CYBERPUNK.${labelKey}`),
      selected: data.system.availability === value
    }));

    // Selected availability label for locked mode
    const selectedAvail = availability[data.system.availability] || "Common";
    data.selectedAvailabilityLabel = game.i18n.localize(`CYBERPUNK.${selectedAvail}`);

    return data;
  }
}
