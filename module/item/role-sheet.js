import { CyberpunkItemSheet } from "./item-sheet-base.js";

/**
 * Role Item Sheet with custom card design and tab functionality
 * @extends {CyberpunkItemSheet}
 */
export class CyberpunkRoleSheet extends CyberpunkItemSheet {

  /**
   * Active tab state
   * @type {string}
   */
  _activeTab = "description";

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cyberpunk", "sheet", "item", "role-sheet"],
      template: "systems/cp2020/templates/item/role-sheet.hbs",
      dragDrop: [{ dropSelector: "[data-drop-target]" }]
    });
  }

  /** @override */
  getData() {
    const data = super.getData();
    data.activeTab = this._activeTab;

    // Career skills are now objects with uuid and name
    // Support both old format (strings) and new format (objects)
    const rawSkills = this.item.system.careerSkills || [];
    data.careerSkillsList = rawSkills.map(skill => {
      if (typeof skill === 'string') {
        // Legacy format - just a name string
        return { name: skill, uuid: null };
      }
      return skill;
    });

    // Check if special skill is set
    data.hasSpecialSkill = !!(this.item.system.specialSkill?.uuid || this.item.system.specialSkill?.name);

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

    // Everything below here is only needed if unlocked
    if (this._isLocked) return;

    // Remove career skill
    html.find('.remove-career-skill').click(async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const index = parseInt(ev.currentTarget.dataset.index);
      const skills = [...(this.item.system.careerSkills || [])];
      skills.splice(index, 1);
      await this.item.update({ "system.careerSkills": skills });
    });

    // Remove special skill
    html.find('.remove-special-skill').click(async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      await this.item.update({ "system.specialSkill": { uuid: "", name: "" } });
    });
  }

  /** @override */
  async _onDrop(event) {
    event.preventDefault();

    // Only allow drops when unlocked
    if (this._isLocked) return;

    // Get the dropped data
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (err) {
      return;
    }

    // Only accept Item drops
    if (data.type !== "Item") return;

    // Get the dropped item
    const item = await Item.implementation.fromDropData(data);
    if (!item) return;

    // Only accept skill items
    if (item.type !== "skill") {
      ui.notifications.warn(game.i18n.localize("CYBERPUNK.OnlySkillsCanBeAdded"));
      return;
    }

    // Determine which drop target received the skill
    const dropTargetEl = event.target.closest('[data-drop-target]');
    const dropTarget = dropTargetEl?.dataset.dropTarget;

    if (dropTarget === 'special-skill') {
      // Set the special skill
      await this.item.update({
        "system.specialSkill": {
          uuid: item.uuid,
          name: item.name
        }
      });
      return;
    }

    // Default: add to career skills
    // Check if skill already exists (by UUID or by name)
    const currentSkills = this.item.system.careerSkills || [];
    const isDuplicate = currentSkills.some(skill => {
      if (typeof skill === 'string') {
        return skill.toLowerCase() === item.name.toLowerCase();
      }
      return skill.uuid === item.uuid || skill.name.toLowerCase() === item.name.toLowerCase();
    });

    if (isDuplicate) {
      ui.notifications.warn(game.i18n.format("CYBERPUNK.SkillAlreadyInRole", { name: item.name }));
      return;
    }

    // Add the skill with UUID and name
    const newSkill = {
      uuid: item.uuid,
      name: item.name
    };

    const updatedSkills = [...currentSkills, newSkill];
    await this.item.update({ "system.careerSkills": updatedSkills });
  }
}
