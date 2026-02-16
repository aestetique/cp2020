import { getByPath, toTitleCase, interpolate, localizeShort } from "./utils.js"

const TEMPLATE_ROOT = "systems/cyberpunk/templates/";
const I18N_PREFIX = "CYBERPUNK.";

// Operator lookup tables for cmp/calc helpers
const COMPARATORS = {
    "===": (a, b) => a === b, "==":  (a, b) => a == b,
    "!=":  (a, b) => a != b,  "!==": (a, b) => a !== b,
    ">":   (a, b) => a > b,   ">=":  (a, b) => a >= b,
    "<":   (a, b) => a < b,   "<=":  (a, b) => a <= b,
    "&&":  (a, b) => a && b,  "||":  (a, b) => a || b,
};
const ARITHMETIC = {
    "+": (a, b) => a + b, "-": (a, b) => a - b,
    "*": (a, b) => a * b, "/": (a, b) => a / b,
};

export function registerHandlebarsHelpers() {
    const h = (name, fn) => Handlebars.registerHelper(name, fn);

    // --- Localization helpers ---
    h('toTitleCase', toTitleCase);
    h('loc', (str, options) => {
        const key = I18N_PREFIX + str;
        if (!game.i18n.has(key)) return str;
        const params = options?.hash;
        return params && Object.keys(params).length
            ? game.i18n.format(key, params)
            : game.i18n.localize(key);
    });
    h("locFmt", (str, options) => game.i18n.format(I18N_PREFIX + str, options));
    h("locShort", localizeShort);
    h('statKey', str => I18N_PREFIX + toTitleCase(str));

    // --- Logic & math ---
    h('both', (x, y) => x && y);
    h('eq', (x, y) => x === y);
    h('cmp', (x, op, y) => COMPARATORS[op]?.(x, y));
    h('calc', (x, op, y) => ARITHMETIC[op]?.(x, y));
    h('hasProp', (x, prop) => x[prop] !== undefined);
    h('contains', (array, value) => Array.isArray(array) && array.includes(value));

    // --- Iteration & strings ---
    h("times", (amount, options) =>
        Array.from({ length: amount }, (_, idx) => options.fn({ i: idx + 1 })).join("")
    );
    h("strCat", (...args) => args.slice(0, -1).join(""));
    h("skillKey", skill => `${I18N_PREFIX}Skill${skill.split(".").pop()}`);
    h("notEmpty", array => array.length > 0);

    // Normalise select options — accepts plain strings or {value, localKey, localData} objects
    h("normOpt", (choice, options) => {
        const ctx = choice?.value !== undefined
            ? { value: choice.value, localKey: choice.localKey ?? choice.value, localData: choice.localData }
            : { value: choice, localKey: choice, localData: undefined };
        return options.fn(ctx);
    });

    // Wound track damage boxes (4 per wound state)
    h("woundBoxes", (woundState, damage, options) => {
        const BOXES = 4;
        const offset = woundState * BOXES;
        return Array.from({ length: BOXES }, (_, idx) => {
            const boxIdx = idx + 1;
            let woundNo = offset + boxIdx;
            const filled = damage >= woundNo;
            const isChecked = woundNo === damage;
            const classes = [
                boxIdx === 1 ? "leftmost" : boxIdx === BOXES ? "rightmost" : null,
                filled ? "filled" : "unfilled",
            ].filter(Boolean).join(" ");
            // Clicking a filled box "deselects" it
            if (isChecked && damage > 0) woundNo -= 1;
            return options.fn({ classes, woundNo, isChecked });
        }).join("");
    });

    h("isObj", val => val instanceof Object);

    // --- Template path helpers ---
    h("tpl", name => `${TEMPLATE_ROOT}${name}.hbs`);
    h("sysPath", path => TEMPLATE_ROOT + path);
    h("dynTpl", (path, value) => TEMPLATE_ROOT + interpolate(path, value));
    h("getByPath", (context, path) => getByPath(context, path));

    // Armor coverage summary — show abbreviated location names where SP > 0
    h("coverageSummary", coverage =>
        Object.entries(coverage)
            .filter(([, data]) => data.stoppingPower > 0)
            .map(([key]) => localizeShort(key))
            .join("|")
    );

    // Display a hit-location range array as "a-b" or just "a"
    h("fmtRange", range => range.length >= 2 ? `${range[0]}-${range[1]}` : String(range[0] ?? ""));

    /**
     * Aggregate damage by body location for chat cards
     * Converts { "Head": [{damage: 12}, {damage: 8}], "Torso": [{damage: 15}] }
     * Into { "Head": 20, "Torso": 15 }
     */
    Handlebars.registerHelper("aggregateDamage", function(areaDamages) {
        if (!areaDamages) return {};
        const totals = {};
        for (const [location, damages] of Object.entries(areaDamages)) {
            if (Array.isArray(damages)) {
                totals[location] = damages.reduce((sum, d) => sum + (d.damage || 0), 0);
            } else {
                totals[location] = damages;
            }
        }
        return totals;
    });

    /**
     * Normalize location key to match damage data keys
     * Grid uses display names, damage data uses abbreviated keys
     */
    function normalizeLocationKey(location) {
        const mapping = {
            'LeftArm': 'lArm',
            'RightArm': 'rArm',
            'LeftLeg': 'lLeg',
            'RightLeg': 'rLeg',
            'Head': 'Head',
            'Torso': 'Torso'
        };
        return mapping[location] || location;
    }

    /**
     * Get damage for a specific body location from aggregated damage
     * Returns the damage value or 0 if not hit
     */
    Handlebars.registerHelper("getLocationDamage", function(aggregatedDamage, location) {
        if (!aggregatedDamage) return 0;
        const key = normalizeLocationKey(location);
        return aggregatedDamage[key] || 0;
    });

    /**
     * Check if a body location was hit (has damage > 0)
     */
    Handlebars.registerHelper("locationWasHit", function(aggregatedDamage, location) {
        if (!aggregatedDamage) return false;
        const key = normalizeLocationKey(location);
        return (aggregatedDamage[key] || 0) > 0;
    });

    /**
     * Get the data key for a location (for data attributes)
     */
    Handlebars.registerHelper("locationDataKey", function(location) {
        return normalizeLocationKey(location);
    });

    /**
     * Body location grid for damage display
     * Returns the grid structure for the 3x2 body location layout
     * Provides both dataKey (for damage data lookup) and iconName (for SVG files)
     */
    Handlebars.registerHelper("bodyGridRow", function(row, options) {
        const grid = {
            row1: [
                { dataKey: 'lArm', iconName: 'LeftArm' },
                { dataKey: 'Head', iconName: 'Head' },
                { dataKey: 'rArm', iconName: 'RightArm' }
            ],
            row2: [
                { dataKey: 'lLeg', iconName: 'LeftLeg' },
                { dataKey: 'Torso', iconName: 'Torso' },
                { dataKey: 'rLeg', iconName: 'RightLeg' }
            ]
        };
        const locations = grid[row] || [];
        let result = '';
        locations.forEach(loc => {
            result += options.fn({
                location: loc.dataKey,
                iconName: loc.iconName
            });
        });
        return result;
    });

    /**
     * JSON stringify for passing data to data attributes
     */
    Handlebars.registerHelper("json", function(context) {
        return JSON.stringify(context);
    });

    /**
     * Check if an actor has a specific status effect
     * @param {Actor} actor - The actor to check
     * @param {string} statusId - The status ID to check for
     * @returns {boolean} True if the actor has the status
     */
    Handlebars.registerHelper("hasStatus", function(actor, statusId) {
        return actor?.statuses?.has(statusId) || false;
    });

    /**
     * Clean dice formula for display
     * Removes the x10 exploding notation from 1d10x10 -> 1d10
     * Also cleans up @variable references to show cleaner formulas
     * Fixes double operators (++ -> +) and removes + 0 terms
     */
    Handlebars.registerHelper("cleanFormula", function(formula) {
        if (!formula) return "";
        // Replace 1d10x10 with 1d10 (exploding notation)
        let cleaned = formula.replace(/1d10x10/gi, "1d10");
        // Replace @variable.path references with their last segment
        cleaned = cleaned.replace(/@[\w.]+/g, (match) => {
            const parts = match.split(".");
            return parts[parts.length - 1];
        });
        // Fix double operators (e.g., "+ +" -> "+", "- -" -> "-")
        cleaned = cleaned.replace(/\+\s*\+/g, "+");
        cleaned = cleaned.replace(/-\s*-/g, "-");
        cleaned = cleaned.replace(/\+\s*-/g, "-");
        cleaned = cleaned.replace(/-\s*\+/g, "-");
        // Remove "+ 0" or "- 0" terms
        cleaned = cleaned.replace(/[+-]\s*0(?=\s*[+-]|$)/g, "");
        // Clean up extra whitespace
        cleaned = cleaned.replace(/\s+/g, " ").trim();
        return cleaned;
    });

    /**
     * Format number with fixed decimal places
     * @param {number} value - The number to format
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted number string
     */
    Handlebars.registerHelper("toFixed", function(value, decimals) {
        const num = parseFloat(value) || 0;
        return num.toFixed(decimals);
    });
}
