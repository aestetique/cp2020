/**
 * Action Surge Tracking System
 * Automatically tracks actions taken during combat and applies Action Surge condition
 * when an actor takes a second action in their turn.
 */

/**
 * Register an action taken by an actor and apply Action Surge if needed
 * @param {Actor} actor - The actor performing the action
 * @param {string} actionType - Type of action (for debugging/logging)
 * @returns {Promise<boolean>} True if action surge was applied
 */
export async function registerAction(actor, actionType = "action") {
  // Only track actions during combat
  if (!game.combat) return false;

  // Only track for the current combatant's actor
  const currentCombatant = game.combat.combatant;
  if (!currentCombatant || currentCombatant.actorId !== actor.id) return false;

  // Get current action count for this turn
  const actionCount = actor.getFlag("cyberpunk", "actionCount") || 0;

  // Increment action count FIRST
  const newActionCount = actionCount + 1;
  await actor.setFlag("cyberpunk", "actionCount", newActionCount);

  // If we just completed the first action (count is now 1), apply Action Surge
  // This is called AFTER the action completes, so it doesn't affect the first action
  if (newActionCount === 1 && !actor.statuses.has("action-surge")) {
    await actor.toggleStatusEffect("action-surge", { active: true });
    console.log(`CYBERPUNK: Applied Action Surge to ${actor.name} after first action (${actionType})`);
  }

  return newActionCount > 1;
}
