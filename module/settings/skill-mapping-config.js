import { DEFAULT_SKILL_MAPPINGS } from "./skill-mapping-defaults.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Configuration application for skill mappings.
 * Allows GMs to customize which skills are used for different weapon types
 * and combat actions via drag-and-drop from compendiums.
 *
 * @extends {ApplicationV2}
 */
export class SkillMappingConfig extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @type {number} Stored scroll position to restore after render */
  _scrollTop = 0;

  static DEFAULT_OPTIONS = {
    id: "skill-mapping-config",
    tag: "form",
    window: {
      title: "SETTINGS.SkillMappingTitle",
      resizable: true,
      contentClasses: ["standard-form"]
    },
    position: {
      width: 500,
      height: 600
    },
    form: {
      closeOnSubmit: false
    },
    actions: {
      delete: SkillMappingConfig._onDeleteSkill,
      clear: SkillMappingConfig._onClearAll
    }
  };

  static PARTS = {
    form: {
      template: "systems/cp2020/templates/settings/skill-mapping-config.hbs",
      scrollable: [".scrollable"]
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  };

  async _prepareContext(options) {
    const mappings = game.settings.get("cp2020", "skillMappings");

    const categories = Object.entries(mappings).map(([key, category]) => ({
      key,
      label: game.i18n.localize(category.labelKey),
      skills: category.skills.map((skill, index) => ({
        name: skill.name,
        uuid: skill.uuid,
        index
      }))
    }));

    return {
      categories,
      buttons: [
        { type: "button", icon: "fa-solid fa-trash", label: "SETTINGS.SkillMappingClear", action: "clear" }
      ]
    };
  }

  static async _onDeleteSkill(event, target) {
    const categoryKey = target.dataset.category;
    const skillIndex = Number(target.dataset.index);

    const mappings = foundry.utils.deepClone(
      game.settings.get("cp2020", "skillMappings")
    );

    if (mappings[categoryKey]?.skills) {
      mappings[categoryKey].skills.splice(skillIndex, 1);
      await game.settings.set("cp2020", "skillMappings", mappings);
      this._scrollTop = this.element.querySelector(".scrollable")?.scrollTop || 0;
      this.render();
    }
  }

  static async _onClearAll(event, target) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("SETTINGS.SkillMappingClearTitle") },
      content: `<p>${game.i18n.localize("SETTINGS.SkillMappingClearConfirm")}</p>`,
      rejectClose: false
    });

    if (confirmed) {
      await game.settings.set("cp2020", "skillMappings",
        foundry.utils.deepClone(DEFAULT_SKILL_MAPPINGS)
      );
      this.render();
      ui.notifications.info(game.i18n.localize("SETTINGS.SkillMappingClearDone"));
    }
  }

  async _onDrop(event) {
    const dropZone = event.target.closest("[data-category]");
    if (!dropZone) return;

    const categoryKey = dropZone.dataset.category;

    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (err) {
      return;
    }

    if (data.type !== "Item") {
      ui.notifications.warn(game.i18n.localize("SETTINGS.SkillMappingOnlyItems"));
      return;
    }

    const item = await Item.implementation.fromDropData(data);
    if (!item || item.type !== "skill") {
      ui.notifications.warn(game.i18n.localize("SETTINGS.SkillMappingOnlySkills"));
      return;
    }

    const mappings = foundry.utils.deepClone(
      game.settings.get("cp2020", "skillMappings")
    );
    const category = mappings[categoryKey];
    if (!category) return;

    const isDuplicate = category.skills.some(
      s => s.uuid === item.uuid || s.name.toLowerCase() === item.name.toLowerCase()
    );
    if (isDuplicate) {
      ui.notifications.warn(
        game.i18n.format("SETTINGS.SkillMappingDuplicate", { name: item.name })
      );
      return;
    }

    category.skills.push({ name: item.name, uuid: item.uuid });
    await game.settings.set("cp2020", "skillMappings", mappings);
    this._scrollTop = this.element.querySelector(".scrollable")?.scrollTop || 0;
    this.render();

    ui.notifications.info(
      game.i18n.format("SETTINGS.SkillMappingAdded", {
        skill: item.name,
        category: game.i18n.localize(category.labelKey)
      })
    );
  }

  _onRender(context, options) {
    super._onRender(context, options);
    // Enable drag-drop on all category fieldsets
    this.element.querySelectorAll("[data-category]").forEach(el => {
      el.addEventListener("dragover", e => e.preventDefault());
      el.addEventListener("drop", e => this._onDrop(e));
    });

    // Restore scroll position after render
    if (this._scrollTop) {
      const scrollable = this.element.querySelector(".scrollable");
      if (scrollable) scrollable.scrollTop = this._scrollTop;
      this._scrollTop = 0;
    }
  }
}
