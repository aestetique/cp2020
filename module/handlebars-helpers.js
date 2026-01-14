import { deepLookup, localize, properCase, replaceIn, shortLocalize } from "./utils.js"

const templatePath = "systems/cp2020/templates/";
export function registerHandlebarsHelpers() {
    Handlebars.registerHelper('properCase', properCase);
    // Short for cyberpunk localize
    Handlebars.registerHelper('CPLocal', function(str, options) {
        let localizeKey = "CYBERPUNK." + str;
        if(!game.i18n.has(localizeKey)) 
            return str;
        if(!options || Object.keys(options.hash).length === 0) {
            return game.i18n.localize(localizeKey);
        }
        else {
            return game.i18n.format(localizeKey, options.hash);
        };
    });
    Handlebars.registerHelper("CPLocalParam", function(str, options) {
        let localizeKey = "CYBERPUNK." + str;
        return game.i18n.format(localizeKey, options);
    });
    Handlebars.registerHelper("shortCPLocal", shortLocalize);

    Handlebars.registerHelper('localizeStat', function(str) {
        return "CYBERPUNK." + properCase(str);
    });
    Handlebars.registerHelper('and', function(x,y) {
        return x && y;
    });
    Handlebars.registerHelper('equals', function(x, y) {
        return x === y;
    });
    Handlebars.registerHelper('compare', function(x, operator, y) {
        switch (operator) {
            case "===":
                return x === y;
            case "==":
                return x == y;
            case "!=":
                return x != y;
            case "!==":
                return x !== y;
            case ">":
                return x > y;
            case ">=":
                return x >= y;
            case "<":
                return x < y;
            case "<=":
                return x <= y;
            case "&&":
                return x && y;
            case "||":
                return x || y;
            default:
                break;
        }
    });
    Handlebars.registerHelper('math', function(x, operator, y) {
        switch (operator) {
            case "*":
                return x * y;
            case "/":
                return x / y;
            case "-": 
                return x - y;
            case "+":
                return x + y;
            default:
                break;
        }
    });
    Handlebars.registerHelper('hasProperty', function(x, prop) {
        return x[prop] !== undefined;
    })

    // Repeat what's inside it X times. i starts at 1, ends at amount.
    // Useful for testing the damage track. Use as, for example, {{#repeat 4}}whatyouwanttorepeat{{/repeat}}
    Handlebars.registerHelper("repeat", function(amount, options) {
        var result = "";
        for (var i = 1; i <= amount; i++) {
            result = result + options.fn({i: i});
        }
        return result;
    });
    Handlebars.registerHelper("concat", function() {
        let result = "";
        //Skip the last argument.
        for(var i = 0; i < arguments.length - 1; ++i) {
            result += arguments[i];
        }
        return result;
    });
    Handlebars.registerHelper("skillRef", function(skill) {
        return "CYBERPUNK.Skill" + skill.split(".").pop();
    });
    Handlebars.registerHelper("hasElements", function(array) {
        return array.length > 0;
    });

    // Allows you to use simple ["one", "two"] options for a select, or something like
    // [{value:"close", localKey:"RangeClose", localData: {range: 50}}, ...]
    // Translates the simple into the more complex one, really
    // Both extremes of ease-of-use and granularity :)
    Handlebars.registerHelper("selectOption", function(choice, options) {
        let context = {};
        // We're using the more complex layout of choices. Almost no real translation needed (except for choosing local key)
        if(choice.value !== undefined) {
            context = {
                value: choice.value,
                localKey: choice.localKey || choice.value,
                localData: choice.localData
            }
        }
        // Just ["one", "two"] etc
        else {
            context = {
                value: choice,
                localKey: choice,
                localData: undefined
            }
        }

        return options.fn(context);
    });
    // Woundstate: 0 for light, 1 for serious, etc
    // It's a little unintuitive, but handlebars loops start at 0, and that's our first would state
    // Damage: How much damage the character has taken. Actor.system.damage.
    // Provides within its context classes, and the current wound
    Handlebars.registerHelper("damageBoxes", function(woundState, damage, options) {
        const woundsPerState = 4;
        const previousBoxes = woundState * woundsPerState;
        let ret = [];
        // Per box in wound
        for(let boxNo = 1; boxNo <= woundsPerState; boxNo++) {
            let thisWound = previousBoxes + boxNo;
            let isChecked = thisWound == damage;
            let classes = "";
            if(boxNo === 1) {
                classes += " leftmost"
            }
            else if (boxNo === woundsPerState) {
                classes += " rightmost"
            }
    
            if(damage >= thisWound) {
                classes += " filled"
            }
            else { classes += " unfilled" }
            // When the wound box is filled, make clicking it again essentially "deselect" that wound
            if(damage == thisWound && damage > 0) {
                thisWound -= 1;
            }
            ret += options.fn({
                classes: classes, 
                woundNo: thisWound, 
                isChecked: isChecked
            });
        }
        return ret;
    });

    Handlebars.registerHelper("isObject", function(foo) {
        return foo instanceof Object;
    });

    Handlebars.registerHelper("template", function(templateName) {
        return templatePath + templateName + ".hbs";
    });

    // eg. {{> (replaceIn "systems/cp2020/templates/path/to/a-partial-[VAR]" foo)}}
    Handlebars.registerHelper("replaceIn", replaceIn);
    // eg. {{> (CPTemplate "path/to/static-partial.hbs")}}
    Handlebars.registerHelper("CPTemplate", function(path) {
        return templatePath + path;
    });
    // eg. {{> (varTemplate "path/to/[VAR]-partial.hbs" foo)}}
    Handlebars.registerHelper("varTemplate", function(path, replaceWith) {
        return templatePath + replaceIn(path, replaceWith);
    });

    Handlebars.registerHelper("deepLookup", function(context, path) {
        return deepLookup(context, path);
    });

    /** Display array of localizable strings, in short if possible
     * For each string, will look it up as a localization, with "Short" appended if possible, then join with "|"
    **/
    Handlebars.registerHelper("armorSummary", function(armorCoverage) {
        return Object.keys(armorCoverage)
            .filter(key => armorCoverage[key].stoppingPower > 0)
            .map(shortLocalize)
            .join("|");
    });

    /**
     * Range array is either [a] or [a,b] usually - used in actors' hit locations
     */
    Handlebars.registerHelper("displayRange", function(rangeArray) {
        if(rangeArray.length >= 2) {
            return rangeArray[0] + "-" + rangeArray[1];
        }
        else if (rangeArray.length == 1) {
            return String(rangeArray[0]);
        }
        return "";
    });

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
     * Get damage for a specific body location from aggregated damage
     * Returns the damage value or 0 if not hit
     */
    Handlebars.registerHelper("getLocationDamage", function(aggregatedDamage, location) {
        if (!aggregatedDamage) return 0;
        return aggregatedDamage[location] || 0;
    });

    /**
     * Check if a body location was hit (has damage > 0)
     */
    Handlebars.registerHelper("locationWasHit", function(aggregatedDamage, location) {
        if (!aggregatedDamage) return false;
        return (aggregatedDamage[location] || 0) > 0;
    });

    /**
     * Body location grid for damage display
     * Returns the grid structure for the 3x2 body location layout
     */
    Handlebars.registerHelper("bodyGridRow", function(row, options) {
        const grid = {
            row1: ['LeftArm', 'Head', 'RightArm'],
            row2: ['LeftLeg', 'Torso', 'RightLeg']
        };
        const locations = grid[row] || [];
        let result = '';
        locations.forEach(location => {
            result += options.fn({ location: location });
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
     * Clean dice formula for display
     * Removes the x10 exploding notation from 1d10x10 -> 1d10
     * Also cleans up @variable references to show cleaner formulas
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
        return cleaned;
    });
}