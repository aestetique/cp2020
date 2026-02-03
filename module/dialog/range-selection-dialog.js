import { fireModes, ranges } from "../lookups.js";
import { localize, localizeParam } from "../utils.js";

/**
 * Range Selection Dialog — select range band before opening attack modifiers.
 * Auto-calculates distance to target if available.
 */
export class RangeSelectionDialog extends Application {

  /**
   * @param {Actor} actor        The owning actor
   * @param {Item}  weapon       The weapon item to fire
   * @param {string} fireMode    The selected fire mode (from fireModes lookup)
   * @param {Array} targetTokens Array of target token data
   */
  constructor(actor, weapon, fireMode, targetTokens = []) {
    super();
    this.actor = actor;
    this.weapon = weapon;
    this.fireMode = fireMode;
    this.targetTokens = targetTokens;
    this._dropdownOpen = false;

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

    // Location targeting (single shot only)
    this._selectedLocation = null;

    // Auto-calculate distance and select range
    this._calculatedDistance = this._calculateDistanceToTarget();
    this._selectedRange = this._getAutoRangeFromDistance() || ranges.close;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "range-selection-dialog",
      classes: ["cp2020", "range-selection-dialog"],
      template: "systems/cp2020/templates/dialog/range-selection.hbs",
      width: 300,
      height: "auto",
      popOut: true,
      minimizable: false,
      resizable: false
    });
  }

  /** @override */
  getData() {
    const weaponRange = this.weapon.system.range || 50;

    // Build range options with calculated distances
    const rangeOptions = [
      { key: ranges.pointBlank, distance: 1, label: localize("RangePointBlankLabel") },
      { key: ranges.close, distance: Math.round(weaponRange / 4), label: localizeParam("RangeCloseLabel", { range: Math.round(weaponRange / 4) }) },
      { key: ranges.medium, distance: Math.round(weaponRange / 2), label: localizeParam("RangeMediumLabel", { range: Math.round(weaponRange / 2) }) },
      { key: ranges.long, distance: weaponRange, label: localizeParam("RangeLongLabel", { range: weaponRange }) },
      { key: ranges.extreme, distance: weaponRange * 2, label: localizeParam("RangeExtremeLabel", { range: weaponRange * 2 }) }
    ];

    // Mark the selected range
    rangeOptions.forEach(opt => {
      opt.selected = opt.key === this._selectedRange;
    });

    // Get label for currently selected range
    const selectedRangeOption = rangeOptions.find(opt => opt.key === this._selectedRange);
    const selectedRangeLabel = selectedRangeOption?.label || "";

    // Get fire mode label
    const fireModeLabel = this._getFireModeLabel();

    return {
      fireModeLabel,
      rangeOptions,
      selectedRangeLabel,
      // Luck data
      luckToSpend: this._luckToSpend,
      availableLuck: this._availableLuck,
      canIncreaseLuck: this._luckToSpend < this._availableLuck,
      canDecreaseLuck: this._luckToSpend > 0,
      hasAnyLuck: this._availableLuck > 0,
      // Location targeting (single shot only)
      isSingleShot: this.fireMode === fireModes.singleShot
    };
  }

  /**
   * Get localized label for the current fire mode
   */
  _getFireModeLabel() {
    switch (this.fireMode) {
      case fireModes.fullAuto:
        return localize("FullAutoLabel");
      case fireModes.threeRoundBurst:
        return localize("ThreeRoundBurstLabel");
      case fireModes.singleShot:
        return localize("SingleShotLabel");
      case fireModes.suppressive:
        return localize("SuppressiveLabel");
      default:
        return this.fireMode;
    }
  }

  /**
   * Calculate distance from actor's token to first targeted token
   * @returns {number|null} Distance in meters, or null if cannot calculate
   */
  _calculateDistanceToTarget() {
    // Get actor's token
    const actorToken = this.actor.getActiveTokens()?.[0];
    if (!actorToken) return null;

    // Get first target token
    if (!this.targetTokens.length) return null;
    const targetId = this.targetTokens[0].id;
    const targetToken = canvas.tokens?.get(targetId);
    if (!targetToken) return null;

    // Calculate distance using Foundry's grid measurement
    try {
      const gridDistance = canvas.grid.measureDistance(
        { x: actorToken.center.x, y: actorToken.center.y },
        { x: targetToken.center.x, y: targetToken.center.y },
        { gridSpaces: false }
      );
      // Round to nearest integer
      return Math.round(gridDistance);
    } catch (e) {
      console.warn("Could not calculate distance to target:", e);
      return null;
    }
  }

  /**
   * Determine appropriate range band from distance
   * @returns {string|null} Range key, or null if cannot determine
   */
  _getAutoRangeFromDistance() {
    if (this._calculatedDistance === null) return null;

    const weaponRange = this.weapon.system.range || 50;
    const dist = this._calculatedDistance;

    if (dist <= 1) return ranges.pointBlank;
    if (dist <= weaponRange / 4) return ranges.close;
    if (dist <= weaponRange / 2) return ranges.medium;
    if (dist <= weaponRange) return ranges.long;
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

    // Range dropdown toggle
    html.find('.range-dropdown-btn').click(ev => {
      ev.stopPropagation();
      this._dropdownOpen = !this._dropdownOpen;
      html.find('.range-dropdown-list').toggleClass('open', this._dropdownOpen);
      html.find('.range-dropdown-btn').toggleClass('open', this._dropdownOpen);
    });

    // Range option selection
    html.find('.range-option').click(ev => {
      const rangeKey = ev.currentTarget.dataset.range;
      this._selectedRange = rangeKey;
      this._dropdownOpen = false;

      // Update display
      const label = ev.currentTarget.textContent.trim();
      html.find('.range-dropdown-btn .range-label').text(label);
      html.find('.range-dropdown-list').removeClass('open');
      html.find('.range-dropdown-btn').removeClass('open');

      // Update visual selection in dropdown
      html.find('.range-option').removeClass('selected');
      ev.currentTarget.classList.add('selected');
    });

    // Close dropdown when clicking outside
    $(document).on('click.rangeDropdown', (ev) => {
      if (!$(ev.target).closest('.range-dropdown').length) {
        this._dropdownOpen = false;
        html.find('.range-dropdown-list').removeClass('open');
        html.find('.range-dropdown-btn').removeClass('open');
      }
    });

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

    // Location button selection (single shot only)
    html.find('.location-btn').click(ev => {
      const btn = ev.currentTarget;
      const location = btn.dataset.location;

      // Toggle selection - clicking same location deselects it
      if (this._selectedLocation === location) {
        this._selectedLocation = null;
        btn.classList.remove('selected');
      } else {
        // Deselect previous
        html.find('.location-btn').removeClass('selected');
        // Select new
        this._selectedLocation = location;
        btn.classList.add('selected');
      }
    });

    // Roll button - execute roll directly
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

    // Swap icons based on disabled state
    html.find('.luck-minus-btn img').attr('src', `systems/cp2020/img/chat/${minusDisabled ? 'minus-disabled' : 'minus'}.svg`);
    html.find('.luck-plus-btn img').attr('src', `systems/cp2020/img/chat/${plusDisabled ? 'plus-disabled' : 'plus'}.svg`);
  }

  /**
   * Execute roll directly with selected options
   */
  _executeRoll() {
    const fireOptions = {
      fireMode: this.fireMode,
      range: this._selectedRange,
      // Conditions
      ambush: this._conditions.ambush,
      ricochet: this._conditions.ricochet,
      // Prepared, Distracted, and Luck via extraMod
      // Note: Location targeting -4 is applied by __shootModTerms when targetArea is set
      extraMod: (this._conditions.prepared ? 2 : 0)
              + (this._conditions.distracted ? -2 : 0)
              + this._luckToSpend,
      // Defaults for unused modifiers
      aimRounds: 0,
      blinded: false,
      dualWield: false,
      fastDraw: false,
      hipfire: false,
      running: false,
      turningToFace: false,
      targetArea: this._selectedLocation || ""
    };

    // Spend luck if any was used
    if (this._luckToSpend > 0) {
      const currentSpent = this.actor.system.stats.luck.spent || 0;
      const currentSpentAt = this.actor.system.stats.luck.spentAt;
      this.actor.update({
        "system.stats.luck.spent": currentSpent + this._luckToSpend,
        "system.stats.luck.spentAt": currentSpentAt || Date.now()
      });
    }

    this.weapon.__weaponRoll(fireOptions, this.targetTokens);
    this.close();
  }

  /** @override */
  close(options) {
    // Clean up document click handler
    $(document).off('click.rangeDropdown');
    return super.close(options);
  }
}
