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

        // Only customize messages that have our cyberpunk-card class
        const card = html.querySelector(".cyberpunk-card");
        if (card) {
            await this._enrichChatCard(html);
            this._activateListeners(html);
        }

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
}
