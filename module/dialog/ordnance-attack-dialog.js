import { fireModes, ranges } from "../lookups.js";
import { localize } from "../utils.js";

/**
 * Ordnance Attack Dialog — select range band, conditions, and luck before firing ordnance.
 * Modeled on RangeSelectionDialog but without location targeting or fire mode selection.
 */
export class OrdnanceAttackDialog extends Application {

  /**
   * @param {Actor} actor        The owning actor
   * @param {Item}  ordnance     The ordnance item to fire
   * @param {Array} targetTokens Array of target token data
   */
  constructor(actor, ordnance, targetTokens = []) {
    super();
    this.actor = actor;
    this.ordnance = ordnance;
    this.targetTokens = targetTokens;

    // Condition toggles
    this._conditions = {
      prepared: false,
      ambush: false,
      distracted: false,
      ricochet: false
    };

    // Luck spending
    this._luckToSpend = 0;
    this._availableLuck = actor.system.stats.luck?.effective ?? actor.system.stats.luck?.total ?? 0;

    // Determine effective range based on template type
    const templateType = this.ordnance.system.templateType || "circle";

    if (templateType === "beam" || templateType === "cone") {
      // Beam/Cone: fixed trajectory
      this._effectiveRange = this.ordnance.system.range || 50;
    } else {
      // Circle: thrown (range=0) or propelled (range>0)
      const specifiedRange = this.ordnance.system.range || 0;
      const body = actor.system.stats.bt?.total ?? 5;
      const bodyRange = body * 5;
      if (specifiedRange === 0) {
        // Thrown grenade: Long = 5 × BODY
        this._effectiveRange = bodyRange;
      } else {
        // Propelled: Long = max(specified range, 5 × BODY)
        this._effectiveRange = Math.max(specifiedRange, bodyRange);
      }
    }

    // Extreme range in meters (for circle template placement distance limit)
    this._extremeRange = this._effectiveRange * 2;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "ordnance-attack-dialog",
      classes: ["cyberpunk", "range-selection-dialog"],
      template: "systems/cyberpunk/templates/dialog/ordnance-attack.hbs",
      width: 300,
      height: "auto",
      popOut: true,
      minimizable: false,
      resizable: false
    });
  }

  /** @override */
  getData() {
    return {
      ordnanceName: this.ordnance.name,
      // Luck data
      luckToSpend: this._luckToSpend,
      availableLuck: this._availableLuck,
      canIncreaseLuck: this._luckToSpend < this._availableLuck,
      canDecreaseLuck: this._luckToSpend > 0,
      hasAnyLuck: this._availableLuck > 0
    };
  }

  /**
   * Determine range band from a measured distance in meters
   * @param {number} dist Distance in meters
   * @returns {string} Range key
   */
  _getRangeFromDistance(dist) {
    const r = this._effectiveRange;
    if (dist <= 1) return ranges.pointBlank;
    if (dist <= r / 4) return ranges.close;
    if (dist <= r / 2) return ranges.medium;
    if (dist <= r) return ranges.long;
    return ranges.extreme;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Make header draggable
    const header = html.find('.reload-header')[0];
    if (header) {
      new Draggable(this, html, header, false);
    }

    // Close button
    html.find('.header-control.close').click(() => this.close());

    // Condition button toggles
    html.find('.condition-btn').click(ev => {
      const btn = ev.currentTarget;
      const condition = btn.dataset.condition;
      this._conditions[condition] = !this._conditions[condition];
      btn.classList.toggle('selected', this._conditions[condition]);
    });

    // Luck plus button
    html.find('.luck-plus-btn').click(ev => {
      if (this._luckToSpend < this._availableLuck) {
        this._luckToSpend++;
        this._updateLuckDisplay(html);
      }
    });

    // Luck minus button
    html.find('.luck-minus-btn').click(ev => {
      if (this._luckToSpend > 0) {
        this._luckToSpend--;
        this._updateLuckDisplay(html);
      }
    });

    // Roll button
    html.find('.roll-btn').click(() => {
      this._executeRoll();
    });
  }

  /**
   * Update the luck display and button states
   * @param {jQuery} html - The dialog HTML element
   */
  _updateLuckDisplay(html) {
    html.find('.luck-value').text(this._luckToSpend);

    const minusDisabled = this._luckToSpend <= 0;
    const plusDisabled = this._luckToSpend >= this._availableLuck;

    html.find('.luck-minus-btn').toggleClass('disabled', minusDisabled);
    html.find('.luck-plus-btn').toggleClass('disabled', plusDisabled);

    html.find('.luck-minus-btn img').attr('src', `systems/cyberpunk/img/chat/${minusDisabled ? 'minus-disabled' : 'minus'}.svg`);
    html.find('.luck-plus-btn img').attr('src', `systems/cyberpunk/img/chat/${plusDisabled ? 'plus-disabled' : 'plus'}.svg`);
  }

  /**
   * Execute roll directly with selected options
   */
  async _executeRoll() {
    // Close dialog first
    this.close();

    // Minimize all open application windows
    Object.values(ui.windows).forEach(w => w.minimize());

    // Place template on the canvas — if cancelled, abort without spending luck
    let placedPos;
    try {
      placedPos = await this._placeTemplate();
    } catch (e) {
      return;
    }

    // Determine range band from placement distance
    const templateType = this.ordnance.system.templateType || "circle";
    let range;
    let actualDistance;
    if (templateType === "beam" || templateType === "cone") {
      // Beam/Cone: fixed trajectory, always Close
      range = ranges.close;
    } else {
      // Circle: measure distance from actor to template center
      const actorToken = this.actor.getActiveTokens()?.[0];
      if (actorToken) {
        const dist = canvas.grid.measureDistance(
          { x: actorToken.center.x, y: actorToken.center.y },
          { x: placedPos.x, y: placedPos.y },
          { gridSpaces: false }
        );
        actualDistance = Math.round(dist);
        range = this._getRangeFromDistance(actualDistance);
      } else {
        range = ranges.close;
      }
    }

    const fireOptions = {
      fireMode: fireModes.singleShot,
      range: range,
      actualDistance: actualDistance,
      templateId: placedPos.templateId,
      ambush: this._conditions.ambush,
      ricochet: this._conditions.ricochet,
      extraMod: (this._conditions.prepared ? 2 : 0)
              + (this._conditions.distracted ? -2 : 0)
              + this._luckToSpend,
      aimRounds: 0,
      blinded: false,
      dualWield: false,
      fastDraw: false,
      hipfire: false,
      running: false,
      turningToFace: false,
      targetArea: ""
    };

    // Spend luck only after successful template placement
    if (this._luckToSpend > 0) {
      const currentSpent = this.actor.system.stats.luck.spent || 0;
      const currentSpentAt = this.actor.system.stats.luck.spentAt;
      this.actor.update({
        "system.stats.luck.spent": currentSpent + this._luckToSpend,
        "system.stats.luck.spentAt": currentSpentAt || Date.now()
      });
    }

    this.ordnance._fireOrdnance(fireOptions, this.targetTokens);

    // Register ordnance attack action AFTER executing
    const { registerAction } = await import("../action-tracker.js");
    await registerAction(this.actor, `ordnance attack (${this.ordnance.name})`);
  }

  /**
   * Place a MeasuredTemplate on the canvas for the ordnance's area of effect.
   * @returns {Promise} Resolves when placed, rejects if cancelled
   */
  async _placeTemplate() {
    const system = this.ordnance.system;
    const templateType = system.templateType || "circle";

    // Build Foundry template data based on ordnance type
    const templateData = {
      user: game.user.id,
      fillColor: game.user.color,
      x: 0,
      y: 0,
      direction: 0
    };

    switch (templateType) {
      case "circle":
        templateData.t = "circle";
        templateData.distance = system.radius || 5;
        break;
      case "beam":
        templateData.t = "ray";
        templateData.distance = system.range || 50;
        templateData.width = system.radius || 2;
        break;
      case "cone":
        templateData.t = "cone";
        templateData.distance = system.range || 50;
        const width = system.radius || 5;
        const range = system.range || 50;
        templateData.angle = 2 * Math.atan2(width / 2, range) * (180 / Math.PI);
        break;
    }

    // Create preview template
    const doc = new MeasuredTemplateDocument(templateData, { parent: canvas.scene });
    const template = new CONFIG.MeasuredTemplate.objectClass(doc);
    await template.draw();

    const initialLayer = canvas.activeLayer;
    canvas.templates.activate();
    canvas.templates.preview.addChild(template);

    // Actor token for beam/cone direction
    const actorToken = this.actor.getActiveTokens()?.[0];

    // For beam/cone, set initial position at actor's token
    if (templateType !== "circle" && actorToken) {
      doc.updateSource({ x: actorToken.center.x, y: actorToken.center.y });
      template.refresh();
    }

    return new Promise((resolve, reject) => {
      const handlers = {};
      let moveTime = 0;

      // Mouse move — update position (circle) or direction (beam/cone)
      handlers.mm = (event) => {
        event.stopPropagation();
        const now = Date.now();
        if (now - moveTime <= 20) return;
        moveTime = now;

        const pos = event.getLocalPosition(canvas.templates);
        const snapped = canvas.grid.getSnappedPosition(pos.x, pos.y, 2);

        if (templateType === "circle") {
          let x = snapped.x, y = snapped.y;

          // Clamp to extreme range from actor's token
          if (actorToken) {
            const dx = x - actorToken.center.x;
            const dy = y - actorToken.center.y;
            const pixelsPerUnit = canvas.dimensions.size / canvas.dimensions.distance;
            const maxDist = this._extremeRange * pixelsPerUnit;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxDist) {
              const scale = maxDist / dist;
              x = actorToken.center.x + dx * scale;
              y = actorToken.center.y + dy * scale;
            }
          }

          doc.updateSource({ x, y });
        } else if (actorToken) {
          const dx = pos.x - actorToken.center.x;
          const dy = pos.y - actorToken.center.y;
          doc.updateSource({ direction: Math.toDegrees(Math.atan2(dy, dx)) });
        } else {
          doc.updateSource({ x: snapped.x, y: snapped.y });
        }
        template.refresh();
      };

      // Left click — place template
      handlers.lc = async (event) => {
        cleanup();
        const [created] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [doc.toObject()]);
        initialLayer.activate();
        resolve({ x: doc.x, y: doc.y, templateId: created.id });
      };

      // Right click — cancel
      handlers.rc = (event) => {
        event.preventDefault();
        cleanup();
        initialLayer.activate();
        reject(new Error("cancelled"));
      };

      // Escape key — cancel
      handlers.esc = (event) => {
        if (event.key === "Escape") {
          cleanup();
          initialLayer.activate();
          reject(new Error("cancelled"));
        }
      };

      function cleanup() {
        canvas.stage.off("pointermove", handlers.mm);
        canvas.stage.off("pointerdown", handlers.lc);
        canvas.app.view.removeEventListener("contextmenu", handlers.rc);
        document.removeEventListener("keydown", handlers.esc);
        canvas.templates.preview.removeChild(template);
        template.destroy();
      }

      canvas.stage.on("pointermove", handlers.mm);
      canvas.stage.once("pointerdown", handlers.lc);
      canvas.app.view.addEventListener("contextmenu", handlers.rc);
      document.addEventListener("keydown", handlers.esc);
    });
  }

  /** @override */
  close(options) {
    return super.close(options);
  }
}
