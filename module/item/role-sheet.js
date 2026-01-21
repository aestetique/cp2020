/**
 * Role Item Sheet with custom header and lock/unlock functionality
 * @extends {ItemSheet}
 */
export class CyberpunkRoleSheet extends ItemSheet {

  /**
   * Lock state for the sheet (locked = view mode, unlocked = edit mode)
   * @type {boolean}
   */
  _isLocked = true;

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cyberpunk", "sheet", "item", "role-sheet"],
      template: "systems/cp2020/templates/item/role-sheet.hbs",
      width: 400,
      height: 520,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "details" }],
      dragDrop: [{ dropSelector: "[data-drop-target='career-skill']" }]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();
    data.system = this.item.system;
    data.isLocked = this._isLocked;

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

    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Lock/Unlock toggle
    html.find('.lock-toggle').click(ev => {
      ev.preventDefault();
      this._isLocked = !this._isLocked;
      this.render(false);
    });

    // Close button
    html.find('[data-action="closeSheet"]').click(ev => {
      ev.preventDefault();
      this.close();
    });

    // Everything below here is only needed if unlocked
    if (this._isLocked) return;

    // Remove career skill
    html.find('.remove-career-skill').click(async ev => {
      ev.preventDefault();
      const index = parseInt(ev.currentTarget.dataset.index);
      const skills = [...(this.item.system.careerSkills || [])];
      skills.splice(index, 1);
      await this.item.update({ "system.careerSkills": skills });
    });
  }

  /* -------------------------------------------- */

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
