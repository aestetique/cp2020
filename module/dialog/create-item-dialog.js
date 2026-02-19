/**
 * Custom "Create Item" dialog with themed buttons for each item type.
 * Used in two modes:
 * - Sidebar mode (no actor): replaces Foundry's default Create Item dialog, 12 types
 * - Actor mode (with actor): creates embedded items on the character, 10 types
 * @extends {Application}
 */
export class CreateItemDialog extends Application {

  /**
   * @param {Actor|null} actor - If provided, items are created on this actor
   */
  constructor(actor = null) {
    super();
    this.actor = actor;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "create-item-dialog",
      classes: ["cyberpunk", "create-item-dialog"],
      template: "systems/cyberpunk/templates/dialog/create-item.hbs",
      width: 300,
      height: "auto",
      popOut: true,
      minimizable: false,
      resizable: false
    });
  }

  getData() {
    const rows = [
      [
        { type: "weapon",    label: game.i18n.localize("TYPES.Item.weapon") },
        { type: "ammo",      label: game.i18n.localize("TYPES.Item.ammo") }
      ],
      [
        { type: "ordnance",  label: game.i18n.localize("TYPES.Item.ordnance") },
        { type: "armor",     label: game.i18n.localize("TYPES.Item.armor") }
      ],
      [
        { type: "cyberware", label: game.i18n.localize("TYPES.Item.cyberware") },
        { type: "program",   label: game.i18n.localize("TYPES.Item.program") }
      ],
      [
        { type: "tool",      label: game.i18n.localize("TYPES.Item.tool") },
        { type: "drug",      label: game.i18n.localize("TYPES.Item.drug") }
      ]
    ];

    if (this.actor) {
      // Actor mode: 10 types — add Commodity + Skill
      rows.push([
        { type: "misc",  label: game.i18n.localize("TYPES.Item.misc") },
        { type: "skill", label: game.i18n.localize("TYPES.Item.skill") }
      ]);
    } else {
      // Sidebar mode: 12 types — add Commodity + Vehicle, Skill + Role
      rows.push(
        [
          { type: "misc",    label: game.i18n.localize("TYPES.Item.misc") },
          { type: "vehicle", label: game.i18n.localize("TYPES.Item.vehicle") }
        ],
        [
          { type: "skill",   label: game.i18n.localize("TYPES.Item.skill") },
          { type: "role",    label: game.i18n.localize("TYPES.Item.role") }
        ]
      );
    }

    return {
      rows,
      title: this.actor
        ? game.i18n.localize("CYBERPUNK.AddItem")
        : game.i18n.localize("CYBERPUNK.CreateItem")
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Draggable header
    const header = html.find('.reload-header')[0];
    if (header) {
      new foundry.applications.ux.Draggable.implementation(this, html, header, false);
    }

    // Close button
    html.find('.header-control.close').click(() => this.close());

    // Item type buttons — create item, open its sheet unlocked, and close dialog
    html.find('.create-item-btn').click(async ev => {
      const type = ev.currentTarget.dataset.type;
      const name = game.i18n.format("DOCUMENT.New", {
        type: game.i18n.localize(CONFIG.Item.typeLabels[type])
      });

      let item;
      if (this.actor) {
        const [created] = await this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
        item = created;
      } else {
        item = await Item.create({ name, type });
      }

      this.close();
      if (item?.sheet) {
        item.sheet._isLocked = false;
        item.sheet.render(true);
      }
    });
  }
}
