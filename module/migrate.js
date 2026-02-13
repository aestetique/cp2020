import { sortSkills, SortModes } from "./actor/skill-sort.js";
import { localize, safeLocalize } from "./utils.js";

const updateFuncs = {
    "Actor": migrateActor,
    "Item": migrateItem
}

let migrationSuccess = true;

export async function migrateWorld() {
    if (!game.user.isGM) {
        ui.notifications.error(localize("MigrateError"));
        return;
    }

    for(let actor of game.actors.contents) {
        processDocument(actor);
        actor.items.forEach(item => processDocument(item));
    }
    for(let item of game.items.contents) {
        processDocument(item);
    }
    if(migrationSuccess) {
        game.settings.set("cyberpunk", "systemMigrationVersion", game.system.version);
        ui.notifications.info(localize("MigrationComplete", { version: game.system.version }), { permanent: true });

    }
    else {
        ui.notifications.error(localize("MigrationFailed"));
    }
}

const defaultDataUse = async (document, updateData) => {
    if (!foundry.utils.isObjectEmpty(updateData)) {
        console.log(`Total update data for document ${document.name}:`);
        console.log(updateData);
        await document.update(updateData);
    }
}
async function processDocument(document, applyUpdate = defaultDataUse) {
    try {
        let migrateDataFunc = updateFuncs[document.documentName];
        if(migrateDataFunc === undefined) {
            console.log(`No migrate function for document with documentName field "${document.documentName}"`);
        }
        const updateData = await migrateDataFunc(document);
        applyUpdate(document, updateData);
    } catch(err) {
        migrationSuccess = false;
        err.message = `Failed cyberpunk system migration for ${document.type} ${document.name}: ${err.message}`;
        console.error(err);
        return;
    }
}

/**
 * Migrate a single Actor document to the current data model.
 * @param {Actor} actor
 * @returns {Object} updateData to apply
 */
export async function migrateActor(actor) {
    console.log(`Migrating data of ${actor.name}`);

    // No need to migrate items currently
    let actorUpdates = {}

    if(typeof(actor.system.damage) == "string") {
        console.log("Making damage a number");
        actorUpdates[`system.damage`] = 0;
    }
    if (actor.type === "character") {
    const tokenData = actor.prototypeToken;
    if (!tokenData.actorLink) {
        actorUpdates["prototypeToken.actorLink"] = true;
        actorUpdates["prototypeToken.disposition"] = 1;
    }
    if (!tokenData.sight?.enabled) {
        actorUpdates["prototypeToken.sight.enabled"] = true;
        actorUpdates["prototypeToken.sight.dim"] = 30;
    }
    }
    
    // TODO: Test this works after v10
    // Trained skills that we keep
    let trainedSkills = [];
    if(actor.system.skills) {
        console.log(`${actor.name} still uses non-item skills. Removing.`);
        actorUpdates["system.skills"] = undefined;

        let trained = (skillData) => skillData.value > 0 || skillData.chipValue > 0;
        // Catalogue skills with points in them to keep
        trainedSkills = Object.entries(actor.system.skills)
            .reduce((acc, [name, skill]) => {
                if(trained(skill)) {
                    acc.push([name, skill]);
                }
                // Grouped skills and the pain that comes with them
                else if(skill.group) {
                    let parentName = name;
                    acc.push(...Object.entries(skill)
                        .filter(([name, subskill]) => name !== "group" && trained(subskill))
                        .map(([name, subskill]) => {
                            // Flatten grouped skills into individual skill items
                            let prefix = parentName === "MartialArts" ? "Martial Arts" : parentName;
                            // We'll be having a different name than before, so localize here
                            return [`${prefix}: ${localize("Skill"+name)}`, subskill]
                        }));
                }
                return acc;
            }, []);

        trainedSkills = trainedSkills.map(([name, skillData]) => legacySkillToItem(name, skillData))
    }
    console.log("Trained skills:");
    console.log(trainedSkills);
    let skills = actor.items.filter(item => item.type === "skill");

    // Migrate from pre-item times
    if(skills.length === 0) {
        console.log(`${actor.name} does not have item skills. Adding aaaall 78 core ones`);
        console.log(`Keeping any skills you had points in: ${trainedSkills.join(", ") || "None"}`);

        // Key core skills by name so they may be overridden
        let skillsToAdd = [].reduce((acc, item) => {
            acc[item.name] = item.toObject();
            return acc;
        }, {});
        // Override core skills with any trained skill by the same name
        for(const trainedSkill of trainedSkills) {
            // Translate legacy localization keys to display names
            let localizedName = safeLocalize("Skill"+trainedSkill.name, trainedSkill.name);
            skillsToAdd[localizedName] = trainedSkill;
        }
        console.log(skillsToAdd);
        skillsToAdd = sortSkills(Object.values(skillsToAdd), SortModes.Name);
        actorUpdates["system.skillsSortedBy"] = "Name";

        const currentItems = Array.from(actor.items).map(item => item.toObject());
        actorUpdates.items = currentItems.concat(currentItems, skillsToAdd);
    }

    return actorUpdates;
} 

export function migrateItem(item) {
  console.log(`Migrating data of ${item.name}`);

  // Changes are collected here
  const itemUpdates = {};
  const system = item.system ?? {};

  if (item.type !== "skill" && system.source === undefined) {
    console.log(`${item.name} has no source field. Adding empty string.`);
    itemUpdates["system.source"] = "";
  }

  // Rename martial.block → martial.parry
  if (item.type === "skill" && system.martial && ("block" in system.martial)) {
    console.log(`${item.name}: Renaming martial.block to martial.parry`);
    itemUpdates["system.martial.parry"] = system.martial.block;
    itemUpdates["system.martial.-=block"] = null;
  }

  if (item.type === "weapon" && system.rangeDamages === undefined) {
    console.log(`${item.name} missing rangeDamages. Initializing defaults.`);
    itemUpdates["system.rangeDamages"] = {
      pointBlank: "",
      close: "",
      medium: "",
      far: ""
    };
  }

  return itemUpdates;
}

// Take an old hardcoded skill and translate it into data for a skill item
export function legacySkillToItem(name, skillData) {
    return {name: safeLocalize("Skill"+name, name), type: "skill", data: {
        flavor: "",
        notes: "",
        level: skillData.value || 0,
        chipLevel: skillData.chipValue || 0,
        isChipped: skillData.chipped,
        ip: skillData.ip,
        diffMod: 1, // No skills have those currently.
        isRoleSkill: skillData.isSpecial || false,
        stat: skillData.stat
    }};
}