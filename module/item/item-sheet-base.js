/**
 * Base Item Sheet with custom card design and lock/unlock functionality
 * All item sheets (skill, role, etc.) should extend this class
 * @extends {ItemSheet}
 */
export class CyberpunkItemSheet extends ItemSheet {

  /**
   * Lock state for the sheet (locked = view mode, unlocked = edit mode)
   * @type {boolean}
   */
  _isLocked = true;

  /**
   * Minimized state for the sheet
   * @type {boolean}
   */
  _isMinimized = false;

  /**
   * Original dimensions before minimizing
   * @type {number|null}
   */
  _originalHeight = null;

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cyberpunk", "sheet", "item"],
      width: 500,
      height: 400,
      resizable: false,
      submitOnChange: true
    });
  }

  /** @override */
  get title() {
    return this.item.name;
  }

  /** @override */
  getData() {
    const data = super.getData();
    data.system = this.item.system;
    data.isLocked = this._isLocked;
    data.isMinimized = this._isMinimized;
    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Lock/Unlock toggle
    html.find('.lock-toggle').click(async ev => {
      ev.preventDefault();
      // Submit any pending form changes before locking
      if (!this._isLocked) {
        await this.submit();
      }
      this._isLocked = !this._isLocked;
      this.render(false);
    });

    // Close button
    html.find('[data-action="closeSheet"]').click(ev => {
      ev.preventDefault();
      this.close();
    });

    // UUID copy button
    html.find('[data-action="copyUuid"]').click(ev => {
      ev.preventDefault();
      game.clipboard.copyPlainText(this.item.uuid);
      ui.notifications.info(`Copied UUID: ${this.item.uuid}`);
    });

    // Portrait click handler
    html.find('.item-portrait').click(ev => this._onPortraitClick(ev));

    // Double-click header to minimize/maximize
    html.find('.sheet-header').on('dblclick', ev => this._onHeaderDoubleClick(ev));

    // Make window draggable via header
    const header = html.find('.sheet-header')[0];
    new foundry.applications.ux.Draggable.implementation(this, html, header, this.options.resizable);
  }

  /**
   * Handle portrait click - show popup when locked, file picker when unlocked
   * @param {Event} ev - The click event
   */
  _onPortraitClick(ev) {
    ev.preventDefault();
    if (this._isLocked) {
      // Show full-screen image popup
      new ImagePopout(this.item.img, {
        title: this.item.name,
        uuid: this.item.uuid
      }).render(true);
    } else {
      // Open FilePicker to change image
      const fp = new FilePicker({
        type: "image",
        current: this.item.img,
        callback: (path) => {
          this.item.update({ img: path });
        }
      });
      fp.render(true);
    }
  }

  /**
   * Handle header double-click for minimize/maximize
   * @param {Event} ev - The double-click event
   */
  _onHeaderDoubleClick(ev) {
    // Don't minimize if clicking on a control
    if (ev.target.closest(".lock-toggle, .header-control, [data-action]")) return;

    const appElement = this.element[0];
    const content = appElement.querySelector(".item-content");
    const card = appElement.querySelector(".item-card");

    if (this._isMinimized) {
      // Maximize - restore original height
      appElement.style.transition = "height 200ms ease";
      appElement.style.height = `${this._originalHeight}px`;

      setTimeout(() => {
        if (content) content.style.display = "";
        appElement.style.transition = "";
        appElement.style.minHeight = "";
        if (card) card.style.minHeight = "";
        this.setPosition({ height: this._originalHeight });
      }, 200);

      this._isMinimized = false;
    } else {
      // Minimize - save current height and collapse
      this._originalHeight = appElement.offsetHeight;

      if (content) content.style.display = "none";
      appElement.style.minHeight = "0";
      if (card) card.style.minHeight = "0";

      appElement.style.transition = "height 200ms ease";
      appElement.style.height = "38px";

      setTimeout(() => {
        appElement.style.transition = "";
        this.setPosition({ height: 38 });
        appElement.style.height = "38px"; // Force after setPosition
      }, 200);

      this._isMinimized = true;
    }
  }
}
