/**
 * Extend the base ChatMessage to customize rendering for Cyberpunk 2020
 * Based on the D&D5e approach of replacing the message header
 * Updated for Foundry V13 API (renderHTML instead of getHTML)
 */
export class CyberpunkChatMessage extends ChatMessage {

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /** @inheritDoc */
    async renderHTML(options = {}) {
        const html = await super.renderHTML(options);

        await this._enrichChatCard(html);
        this._activateListeners(html);

        // Call system hook for further customization by modules
        Hooks.callAll("cp2020.renderChatMessageHTML", this, html);

        return html;
    }

    /* -------------------------------------------- */

    /**
     * Get the actor associated with this message (D&D5e style)
     * @returns {Actor|null}
     */
    getAssociatedActor() {
        if (this.speaker.scene && this.speaker.token) {
            const scene = game.scenes.get(this.speaker.scene);
            const token = scene?.tokens.get(this.speaker.token);
            if (token) return token.actor;
        }
        return game.actors.get(this.speaker.actor);
    }

    /* -------------------------------------------- */

    /**
     * Get the timestamp display for this message.
     * Checks for Simple Calendar's game time flag first, then falls back to Foundry's timestamp.
     * @returns {string} The formatted timestamp
     * @private
     */
    _getTimestampDisplay() {
        // Check for Simple Calendar's timestamp in flags
        const scFlags = this.flags?.["foundryvtt-simple-calendar"];
        if (scFlags?.["sc-timestamps"] && typeof SimpleCalendar !== "undefined") {
            const scData = scFlags["sc-timestamps"];
            if (scData.timestamp) {
                try {
                    // Convert timestamp to date object using Simple Calendar API
                    const dt = SimpleCalendar.api.timestampToDate(scData.timestamp, scData.id);
                    if (dt) {
                        // Get month abbreviation (first 3 letters)
                        const monthName = dt.display?.monthName || "";
                        const monthAbbr = monthName.substring(0, 3);

                        // Get day with zero padding
                        const dayNum = dt.display?.day || dt.day || 1;
                        const day = String(dayNum).padStart(2, "0");

                        // Get year
                        const year = dt.display?.year || dt.year || "";

                        // Get time with zero padding
                        const hour = String(dt.hour ?? 0).padStart(2, "0");
                        const minute = String(dt.minute ?? 0).padStart(2, "0");

                        // Format as "MMM DD, YYYY HH:mm" (e.g., "Feb 05, 2045 00:02")
                        if (monthAbbr && day && year) {
                            return `${monthAbbr} ${day}, ${year} ${hour}:${minute}`;
                        }
                    }
                } catch (e) {
                    console.warn("CP2020: Could not format Simple Calendar timestamp", e);
                }
            }
        }

        // Fall back to formatting the real-world message timestamp
        const date = new Date(this.timestamp);
        return date.toLocaleString(game.i18n.lang, {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    /**
     * Get the actor/character name for display.
     * Uses the Foundry alias property which is set from the speaker.
     * @returns {string} The character/actor name
     * @private
     */
    _getActorDisplayName() {
        // Try to get actor directly from speaker - this is the most reliable source
        const actor = this.getAssociatedActor();
        if (actor?.name) {
            return actor.name;
        }

        // The ChatMessage.alias is the canonical source, but it defaults to player name
        // when no token is selected. We only want to show it if it's different from the author.
        // However, if the user is rolling from a character sheet without a token selected,
        // the alias will be the player name - in this case, check if the user has an assigned character.

        // Check if the current user has an assigned character
        const userCharacter = this.author?.character;
        if (userCharacter?.name) {
            return userCharacter.name;
        }

        // If alias is different from author name, it's likely a character name
        if (this.alias && this.alias !== this.author?.name) {
            return this.alias;
        }

        // Check speaker.alias directly
        if (this.speaker?.alias && this.speaker.alias !== this.author?.name) {
            return this.speaker.alias;
        }

        // Last resort - use alias even if it matches author (better than "Unknown")
        return this.alias || "Unknown";
    }

    /**
     * Enrich the chat card with custom header (D&D5e style)
     * @param {HTMLElement} html - The rendered message HTML element
     * @private
     */
    async _enrichChatCard(html) {
        const header = html.querySelector(".message-header");
        if (!header) return;

        // Get associated actor
        const actor = this.getAssociatedActor();

        // Build avatar element
        const avatar = document.createElement("div");
        avatar.classList.add("cp2020-avatar");
        const avatarImg = document.createElement("img");

        // Get best image: actor portrait > user avatar > placeholder
        // Always use actor portrait, never token image
        let img = "systems/cp2020/img/placeholder-actor.svg";
        if (actor?.img && actor.img !== "icons/svg/mystery-man.svg") {
            img = actor.img;
        } else if (this.author?.avatar) {
            img = this.author.avatar;
        }

        avatarImg.src = img;
        avatarImg.alt = this._getActorDisplayName();
        avatar.appendChild(avatarImg);

        // Store actor/token info for portrait interactions
        if (actor) {
            avatar.dataset.actorId = actor.id;
            avatar.style.cursor = "pointer";
        }
        if (this.speaker.scene && this.speaker.token) {
            avatar.dataset.sceneId = this.speaker.scene;
            avatar.dataset.tokenId = this.speaker.token;
        }

        // Build info container
        const info = document.createElement("div");
        info.classList.add("cp2020-info");

        // Top row: Player name + timestamp + delete
        const metaRow = document.createElement("div");
        metaRow.classList.add("cp2020-meta-row");

        // Player name
        const playerName = document.createElement("span");
        playerName.classList.add("cp2020-player-name");
        playerName.textContent = this.author?.name || "Player";

        // Timestamp - use our helper that checks Simple Calendar first
        const timestamp = document.createElement("span");
        timestamp.classList.add("cp2020-timestamp");
        timestamp.textContent = this._getTimestampDisplay();

        metaRow.appendChild(playerName);
        metaRow.appendChild(timestamp);

        // Delete button (if user can delete)
        const canDelete = game.user.isGM || this.isAuthor;
        if (canDelete) {
            const deleteBtn = document.createElement("a");
            deleteBtn.classList.add("cp2020-delete");
            deleteBtn.dataset.action = "delete";
            deleteBtn.dataset.tooltip = "Delete";
            deleteBtn.setAttribute("aria-label", "Delete");
            deleteBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 9 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.56313 0.410625L2.4 0.9H0.6C0.268125 0.9 0 1.16813 0 1.5C0 1.83188 0.268125 2.1 0.6 2.1H7.8C8.13188 2.1 8.4 1.83188 8.4 1.5C8.4 1.16813 8.13188 0.9 7.8 0.9H6L5.83687 0.410625C5.75437 0.165 5.52563 0 5.26688 0H3.13313C2.87438 0 2.64563 0.165 2.56313 0.410625ZM7.8 3H0.6L0.995625 9.05812C1.02563 9.5325 1.41938 9.9 1.89375 9.9H6.50625C6.98063 9.9 7.37438 9.5325 7.40438 9.05812L7.8 3Z" fill="currentColor"/>
                </svg>
            `;
            metaRow.appendChild(deleteBtn);
        }

        // Bottom row: Actor name
        const actorRow = document.createElement("div");
        actorRow.classList.add("cp2020-actor-row");

        const actorName = document.createElement("span");
        actorName.classList.add("cp2020-actor-name");
        // Use our helper to get the best actor name
        actorName.textContent = this._getActorDisplayName();

        actorRow.appendChild(actorName);

        info.appendChild(metaRow);
        info.appendChild(actorRow);

        // Replace header content
        header.replaceChildren(avatar, info);
        header.classList.add("cp2020-header");

        // Style the overall message
        html.classList.add("cp2020-message");
    }

    /* -------------------------------------------- */

    /**
     * Activate event listeners on the chat card
     * @param {HTMLElement} html - The rendered message HTML element
     * @private
     */
    _activateListeners(html) {
        // Delete button
        html.querySelector(".cp2020-delete[data-action='delete']")?.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await this.delete();
        });

        // Roll toggles for collapsible details
        html.querySelectorAll(".roll-toggle").forEach(toggle => {
            toggle.addEventListener("click", this._onToggleRollDetails.bind(this));
        });

        // Portrait interactions
        const avatar = html.querySelector(".cp2020-avatar");
        if (avatar) {
            // Click to open actor sheet
            avatar.addEventListener("click", this._onPortraitClick.bind(this));

            // Hover to highlight token
            avatar.addEventListener("mouseenter", this._onPortraitHoverIn.bind(this));
            avatar.addEventListener("mouseleave", this._onPortraitHoverOut.bind(this));
        }

        // Target selector tabs
        const targetSelector = html.querySelector(".target-selector");
        if (targetSelector) {
            targetSelector.querySelectorAll(".target-selector__tab").forEach(tab => {
                tab.addEventListener("click", (event) => this._onTargetTabClick(event, html));
            });

            // Apply damage button
            const applyBtn = targetSelector.querySelector(".apply-damage-btn");
            if (applyBtn) {
                // Check if damage was already applied (persisted in flags)
                if (this.getFlag("cp2020", "damageApplied")) {
                    applyBtn.textContent = "APPLIED";
                    applyBtn.disabled = true;

                    // Hide the tabs and content for already-applied messages
                    const tabs = targetSelector.querySelector(".target-selector__tabs");
                    const content = targetSelector.querySelector(".target-selector__content");
                    if (tabs) tabs.style.display = "none";
                    if (content) content.style.display = "none";
                } else {
                    applyBtn.addEventListener("click", (event) => this._onApplyDamage(event, html));
                }
            }

            // Initialize target info based on current mode (only if not already applied)
            if (!this.getFlag("cp2020", "damageApplied")) {
                this._updateTargetInfo(html, "targeted");
            }

            // Subscribe to target/selection changes for reactive updates
            Hooks.on("cp2020.targetChanged", () => {
                // Check if this chat message is still in the DOM
                if (!document.body.contains(html)) return;
                const activeTab = html.querySelector(".target-selector__tab--active");
                if (activeTab?.dataset.mode === "targeted") {
                    this._updateTargetInfo(html, "targeted");
                }
            });

            Hooks.on("cp2020.selectionChanged", () => {
                // Check if this chat message is still in the DOM
                if (!document.body.contains(html)) return;
                const activeTab = html.querySelector(".target-selector__tab--active");
                if (activeTab?.dataset.mode === "selected") {
                    this._updateTargetInfo(html, "selected");
                }
            });
        }

        // Damage grid cell clicks for expandable details
        const damageGrid = html.querySelector(".damage-grid");
        if (damageGrid) {
            damageGrid.querySelectorAll(".damage-grid__cell--hit").forEach(cell => {
                cell.addEventListener("click", (event) => this._onDamageGridCellClick(event, damageGrid));
            });
        }
    }

    /* -------------------------------------------- */

    /**
     * Handle clicking on a roll result to toggle details
     * @param {Event} event - The click event
     * @private
     */
    _onToggleRollDetails(event) {
        event.preventDefault();
        const toggle = event.currentTarget;
        const container = toggle.closest(".roll-container");
        if (!container) return;

        const isCollapsed = container.classList.contains("roll-container--collapsed");

        // Simply toggle the class - CSS handles the 500ms animation
        if (isCollapsed) {
            container.classList.remove("roll-container--collapsed");
            container.classList.add("roll-container--expanded");
        } else {
            container.classList.remove("roll-container--expanded");
            container.classList.add("roll-container--collapsed");
        }
    }

    /* -------------------------------------------- */

    /**
     * Handle clicking on a damage grid cell to show/hide hit details
     * @param {Event} event - The click event
     * @param {HTMLElement} damageGrid - The damage grid container
     * @private
     */
    _onDamageGridCellClick(event, damageGrid) {
        event.preventDefault();
        const cell = event.currentTarget;
        const location = cell.dataset.location;
        const expandArea = damageGrid.querySelector(".damage-grid__expand");
        const expandContent = damageGrid.querySelector(".damage-grid__expand-content");

        if (!expandArea || !expandContent || !location) return;

        // Get damage data from the grid's data attribute
        let areaDamages;
        try {
            areaDamages = JSON.parse(damageGrid.dataset.damages || "{}");
        } catch (e) {
            return;
        }

        // Check if clicking same cell (toggle off)
        const currentLocation = expandArea.dataset.activeLocation;
        if (currentLocation === location && !expandArea.classList.contains("damage-grid__expand--hidden")) {
            // Collapse the expand area
            expandArea.classList.add("damage-grid__expand--hidden");
            expandArea.dataset.activeLocation = "";
            // Remove active state from all cells
            damageGrid.querySelectorAll(".damage-grid__cell--active").forEach(c => {
                c.classList.remove("damage-grid__cell--active");
            });
            return;
        }

        // Get hits for this location
        const hits = areaDamages[location];
        if (!Array.isArray(hits) || hits.length === 0) return;

        // Build expand HTML - single roll-expandable for all hits
        let contentHtml = '<div class="roll-expandable">';
        contentHtml += '<div class="roll-expandable__inner">';

        // Formula bar with all formulas combined
        const formulas = hits.map(h => h.formula).filter(Boolean);
        if (formulas.length > 0) {
            contentHtml += '<div class="formula-bar">';
            contentHtml += `<span class="formula-bar__text">${formulas.join(' + ')}</span>`;
            contentHtml += '</div>';
        }

        // Each hit gets a roll-details section
        hits.forEach((hit) => {
            const damage = hit.damage || hit.dmg || 0;
            const formula = hit.formula || '';
            const dice = hit.dice || [];

            contentHtml += '<div class="roll-details">';

            // Row with formula label and total
            contentHtml += '<div class="roll-details__row">';
            contentHtml += `<span class="roll-details__label">${formula}</span>`;
            contentHtml += '<span class="roll-details__value">';
            contentHtml += `<span class="roll-details__value-text">${damage}</span>`;
            contentHtml += '</span>';
            contentHtml += '</div>';

            // Dice row
            if (dice.length > 0) {
                contentHtml += '<div class="roll-details__row roll-details__row--dice">';
                for (const term of dice) {
                    for (const die of term.results) {
                        const classes = [];
                        if (die.result === 1) classes.push('min');
                        if (die.result === term.faces) classes.push('max');
                        if (die.exploded) classes.push('exploded');
                        contentHtml += `<div class="dice-badge dice-badge--d${term.faces} ${classes.join(' ')}">`;
                        contentHtml += `<span class="dice-badge__value">${die.result}</span>`;
                        contentHtml += '</div>';
                    }
                }
                contentHtml += '</div>';
            }

            contentHtml += '</div>'; // roll-details
        });

        contentHtml += '</div>'; // roll-expandable__inner
        contentHtml += '</div>'; // roll-expandable

        // Update content and show
        expandContent.innerHTML = contentHtml;
        expandArea.dataset.activeLocation = location;
        expandArea.classList.remove("damage-grid__expand--hidden");

        // Update active state on cells
        damageGrid.querySelectorAll(".damage-grid__cell--active").forEach(c => {
            c.classList.remove("damage-grid__cell--active");
        });
        cell.classList.add("damage-grid__cell--active");
    }

    /**
     * Get CSS class for a die result (min, max, exploded)
     * @param {Object} die - The die result object
     * @param {number} faces - Number of faces on the die
     * @returns {string} CSS class(es) to apply
     * @private
     */
    _getDieClass(die, faces) {
        const classes = [];
        if (die.result === 1) classes.push("min");
        if (die.result === faces) classes.push("max");
        if (die.exploded) classes.push("exploded");
        return classes.join(" ");
    }

    /* -------------------------------------------- */

    /**
     * Handle clicking on the portrait to open the actor sheet
     * @param {Event} event - The click event
     * @private
     */
    _onPortraitClick(event) {
        event.preventDefault();
        const avatar = event.currentTarget;
        const actorId = avatar.dataset.actorId;
        if (!actorId) return;

        const actor = game.actors.get(actorId);
        actor?.sheet?.render(true);
    }

    /* -------------------------------------------- */

    /**
     * Handle hovering over the portrait to highlight the token
     * @param {Event} event - The mouseenter event
     * @private
     */
    _onPortraitHoverIn(event) {
        const avatar = event.currentTarget;
        const token = this._getTokenFromAvatar(avatar);
        if (token?._object) {
            token._object._onHoverIn(event);
        }
    }

    /**
     * Handle leaving the portrait to remove token highlight
     * @param {Event} event - The mouseleave event
     * @private
     */
    _onPortraitHoverOut(event) {
        const avatar = event.currentTarget;
        const token = this._getTokenFromAvatar(avatar);
        if (token?._object) {
            token._object._onHoverOut(event);
        }
    }

    /**
     * Get the token document from avatar data attributes
     * @param {HTMLElement} avatar - The avatar element
     * @returns {TokenDocument|null}
     * @private
     */
    _getTokenFromAvatar(avatar) {
        const sceneId = avatar.dataset.sceneId;
        const tokenId = avatar.dataset.tokenId;
        if (!sceneId || !tokenId) return null;

        const scene = game.scenes.get(sceneId);
        return scene?.tokens.get(tokenId) ?? null;
    }

    /* -------------------------------------------- */
    /*  Target Selector Methods                      */
    /* -------------------------------------------- */

    /**
     * Handle clicking on target selector tabs
     * @param {Event} event - The click event
     * @param {HTMLElement} html - The message HTML
     * @private
     */
    _onTargetTabClick(event, html) {
        event.preventDefault();
        const tab = event.currentTarget;
        const mode = tab.dataset.mode;

        // Update tab active state
        html.querySelectorAll(".target-selector__tab").forEach(t => {
            t.classList.remove("target-selector__tab--active");
        });
        tab.classList.add("target-selector__tab--active");

        // Update target info
        this._updateTargetInfo(html, mode);
    }

    /**
     * Update the target info display based on mode (targeted/selected)
     * @param {HTMLElement} html - The message HTML
     * @param {string} mode - "targeted" or "selected"
     * @private
     */
    _updateTargetInfo(html, mode) {
        const content = html.querySelector(".target-selector__content");
        const applyBtn = html.querySelector(".apply-damage-btn");
        const hintEl = html.querySelector(".target-selector__hint");
        const targetSelector = html.querySelector(".target-selector");

        if (!content || !targetSelector) return;

        // Get damage data from the selector
        let damageData;
        try {
            damageData = JSON.parse(targetSelector.dataset.damage || "{}");
        } catch (e) {
            damageData = {};
        }

        // Get loaded ammo type
        const ammoType = targetSelector.dataset.ammoType || "standard";

        // Get targets based on mode
        let targets = [];
        if (mode === "targeted") {
            targets = Array.from(game.user.targets);
        } else {
            targets = canvas.tokens?.controlled || [];
        }

        // If no targets, show empty state
        if (targets.length === 0) {
            content.innerHTML = `<div class="target-info target-info--empty">${game.i18n.localize("CYBERPUNK.SelectTarget")}</div>`;
            if (applyBtn) applyBtn.disabled = true;
            if (hintEl) hintEl.textContent = "";
            return;
        }

        // Build target info HTML - simplified layout with portrait, name, total damage
        let infoHtml = "";
        let hintParts = [];

        for (const token of targets) {
            const actor = token.actor;
            if (!actor) continue;

            // Calculate damage preview for this target
            const preview = this._calculateDamagePreview(actor, damageData, ammoType);

            // Simplified row: portrait | name | total damage
            infoHtml += `
                <div class="target-info__selected" data-token-id="${token.id}">
                    <div class="target-info__portrait">
                        <img src="${actor.img}" alt="${actor.name}">
                    </div>
                    <span class="target-info__name">${actor.name}</span>
                    <span class="target-info__damage">${preview.total}</span>
                </div>
            `;

            // Build hint text from calculation details
            if (preview.hint) {
                hintParts.push(preview.hint);
            }
        }

        content.innerHTML = infoHtml;

        // Set hint text below apply button
        if (hintEl) {
            hintEl.textContent = hintParts.join(" | ");
        }

        // Enable apply button if there are valid targets with damage
        if (applyBtn) {
            applyBtn.disabled = targets.length === 0;
        }
    }

    /**
     * Calculate damage preview for a target actor
     * @param {Actor} actor - The target actor
     * @param {Object} damageData - The damage data from the attack
     * @returns {Object} Preview object with total damage, hint string, and per-location final damage
     * @private
     */
    _calculateDamagePreview(actor, damageData, ammoType = "standard") {
        let total = 0;
        const hintParts = [];
        const byLocation = {}; // Track final damage per location for limb loss detection

        for (const [location, hits] of Object.entries(damageData)) {
            if (!Array.isArray(hits)) continue;

            let locationTotal = 0;

            for (const hit of hits) {
                const rawDamage = hit.damage || 0;

                // Get armor SP for this location
                const hitLocations = actor.system?.hitLocations || {};
                const locData = hitLocations[location] || {};
                const armorSP = locData.stoppingPower || 0;

                // Apply ammo type modifiers to armor penetration
                let effectiveSP = armorSP;
                if (ammoType === "armorPiercing") {
                    effectiveSP = Math.floor(armorSP / 2);
                } else if (ammoType === "hollowPoint") {
                    effectiveSP = armorSP * 2;
                }

                // Rubber slugs: hard armor blocks completely, soft armor penetrates to max 1
                if (ammoType === "rubberSlug") {
                    // Check for hard armor at this location
                    const hasHardArmor = actor.items.some(i =>
                        i.type === "armor" && i.system.equipped &&
                        i.system.armorType === "hard" &&
                        i.system.coverage?.[location]?.stoppingPower > 0
                    );
                    if (hasHardArmor) {
                        hintParts.push(`${location}: ${rawDamage} (rubber vs hard armor) = 0`);
                        continue;
                    }
                    // Soft armor or no armor — normal penetration, cap at 1
                    const afterArmorRubber = Math.max(0, rawDamage - armorSP);
                    let finalDamageRubber = 0;
                    if (afterArmorRubber > 0) {
                        finalDamageRubber = 1;
                        hintParts.push(`${location}: ${rawDamage} - ${armorSP} SP (rubber) = 1`);
                    } else {
                        hintParts.push(`${location}: ${rawDamage} - ${armorSP} SP (rubber) = 0`);
                    }
                    total += finalDamageRubber;
                    locationTotal += finalDamageRubber;
                    continue;
                }

                // Calculate damage after armor
                const afterArmor = Math.max(0, rawDamage - effectiveSP);

                // Apply ammo type modifier to post-armor damage
                let modifiedDamage = afterArmor;
                if (ammoType === "armorPiercing" && afterArmor > 0) {
                    modifiedDamage = Math.floor(afterArmor / 2);
                } else if (ammoType === "hollowPoint" && afterArmor > 0) {
                    modifiedDamage = Math.floor(afterArmor * 1.5);
                }

                // Apply BTM if damage penetrated
                let finalDamage = 0;
                const btm = actor.system?.stats?.bt?.modifier || 0;

                if (modifiedDamage > 0) {
                    finalDamage = Math.max(1, modifiedDamage - btm);
                }

                // Build hint string
                if (ammoType === "armorPiercing") {
                    hintParts.push(`${location}: ${rawDamage} - ${effectiveSP} SP(AP) → ⌊${afterArmor}/2⌋${btm ? ` - ${btm} BTM` : ''} = ${finalDamage}`);
                } else if (ammoType === "hollowPoint") {
                    hintParts.push(`${location}: ${rawDamage} - ${effectiveSP} SP(HP) → ⌊${afterArmor}×1.5⌋${btm ? ` - ${btm} BTM` : ''} = ${finalDamage}`);
                } else if (modifiedDamage > 0 && btm !== 0) {
                    hintParts.push(`${location}: ${rawDamage} - ${armorSP} SP - ${btm} BTM = ${finalDamage}`);
                } else if (armorSP > 0) {
                    hintParts.push(`${location}: ${rawDamage} - ${armorSP} SP = ${finalDamage}`);
                } else {
                    hintParts.push(`${location}: ${rawDamage} = ${finalDamage}`);
                }

                total += finalDamage;
                locationTotal += finalDamage;
            }

            // Store the total final damage for this location
            byLocation[location] = { finalDamage: locationTotal };
        }

        // Each hit on its own line for clarity
        const hint = hintParts.length > 0 ? hintParts.join("\n") : "";

        return { total, hint, byLocation };
    }

    /**
     * Handle clicking the Apply Damage button
     * @param {Event} event - The click event
     * @param {HTMLElement} html - The message HTML
     * @private
     */
    async _onApplyDamage(event, html) {
        event.preventDefault();

        const targetSelector = html.querySelector(".target-selector");
        if (!targetSelector) return;

        // Get damage data
        let damageData;
        try {
            damageData = JSON.parse(targetSelector.dataset.damage || "{}");
        } catch (e) {
            return;
        }

        // Get loaded ammo type
        const ammoType = targetSelector.dataset.ammoType || "standard";

        // Get active tab mode
        const activeTab = html.querySelector(".target-selector__tab--active");
        const mode = activeTab?.dataset.mode || "targeted";

        // Get targets based on mode
        let targets = [];
        if (mode === "targeted") {
            targets = Array.from(game.user.targets);
        } else {
            targets = canvas.tokens?.controlled || [];
        }

        if (targets.length === 0) return;

        // Limb location to condition ID mapping
        const limbConditions = {
            'lArm': 'lost-left-arm',
            'rArm': 'lost-right-arm',
            'lLeg': 'lost-left-leg',
            'rLeg': 'lost-right-leg'
        };

        // Apply damage to each target
        for (const token of targets) {
            const actor = token.actor;
            if (!actor) continue;

            // Calculate total damage for this actor (includes per-location breakdown)
            const preview = this._calculateDamagePreview(actor, damageData, ammoType);
            const totalDamage = preview.total;

            if (totalDamage <= 0) continue;

            // Get current damage and add new damage
            const currentDamage = actor.system.damage || 0;
            const newDamage = Math.min(currentDamage + totalDamage, 40);

            // Check wound state before update
            const previousWoundState = actor.woundState();

            // Update actor damage
            await actor.update({ "system.damage": newDamage });

            // Ablate armor on penetration
            // For each location that took damage, find equipped armor and increase ablation
            for (const [location, hits] of Object.entries(damageData)) {
                if (!Array.isArray(hits)) continue;
                const hitLocations = actor.system?.hitLocations || {};
                const locData = hitLocations[location] || {};
                const armorSP = locData.stoppingPower || 0;

                // Apply ammo type modifier to effective SP for penetration check
                let effectiveSP = armorSP;
                if (ammoType === "armorPiercing") effectiveSP = Math.floor(armorSP / 2);
                else if (ammoType === "hollowPoint") effectiveSP = armorSP * 2;

                // Count penetrating hits at this location
                let penetrations = 0;
                for (const hit of hits) {
                    const rawDamage = hit.damage || 0;
                    if (ammoType === "rubberSlug") continue; // Rubber slugs don't penetrate
                    if (rawDamage > effectiveSP) penetrations++;
                }

                if (penetrations > 0) {
                    // Find equipped armor items covering this location and ablate
                    const equippedArmor = actor.items.filter(i =>
                        i.type === "armor" && i.system.equipped &&
                        i.system.coverage?.[location]?.stoppingPower > 0
                    );
                    for (const armor of equippedArmor) {
                        const cov = armor.system.coverage[location];
                        const currentAblation = Number(cov.ablation) || 0;
                        const maxSP = Number(cov.stoppingPower) || 0;
                        const newAblation = Math.min(currentAblation + penetrations, maxSP);
                        if (newAblation !== currentAblation) {
                            await armor.update({ [`system.coverage.${location}.ablation`]: newAblation });
                        }
                    }
                }
            }

            // Get new wound state
            const newWoundState = actor.woundState();

            // Remove Stabilized if actor takes any damage
            if (actor.statuses.has("stabilized")) {
                await actor.toggleStatusEffect("stabilized", { active: false });
            }

            // Roll Shock Save only if actor is NOT already shocked
            if (totalDamage > 0 && !actor.statuses.has("shocked")) {
                const modifier = actor.system.stunSaveMod || 0;
                await actor.rollStunSave(modifier);
            }

            // Track if we need to roll Death Save (only once per apply)
            let needsDeathSave = false;

            // Check for limb loss (8+ final damage to a limb)
            for (const [location, conditionId] of Object.entries(limbConditions)) {
                const locationDamage = preview.byLocation[location]?.finalDamage || 0;
                if (locationDamage >= 8 && !actor.statuses.has(conditionId)) {
                    await actor.toggleStatusEffect(conditionId, { active: true });
                    needsDeathSave = true;
                }
            }

            // Check for entering Mortal state (woundState 4+)
            if (newWoundState >= 4 && previousWoundState < 4) {
                needsDeathSave = true;
            }

            // Roll Death Save once if needed (limb loss or entering mortal state)
            if (needsDeathSave) {
                const modifier = actor.system.deathSaveMod || 0;
                await actor.rollDeathSave(modifier);
            }
        }

        // Update the apply button to show it was used and hide the selector UI
        const applyBtn = html.querySelector(".apply-damage-btn");
        if (applyBtn) {
            applyBtn.textContent = "APPLIED";
            applyBtn.disabled = true;
        }

        // Hide the tabs and content after applying
        const tabs = html.querySelector(".target-selector__tabs");
        const content = html.querySelector(".target-selector__content");
        if (tabs) tabs.style.display = "none";
        if (content) content.style.display = "none";

        // Persist the applied state in message flags
        await this.setFlag("cp2020", "damageApplied", true);
    }
}
