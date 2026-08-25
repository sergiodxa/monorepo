/**
 * Pure mapping from battle events to synthesized sound-effect names, kept
 * free of the audio context and scene so it stays unit-testable.
 *
 * A damaging hit plays `hit`, a faint plays `faint`, a heal plays `heal`,
 * else silent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BattleEvent } from "~/game/battle/battle";
import type { GameEvent } from "~/game/events";

import type { SfxName } from "../core/sfx";

/**
 * The minimal surface a caller needs to fire a synthesized effect.
 *
 * Trigger sites declare only the capability they use, keeping them safe
 * to call even when audio is absent.
 */
export interface SfxPlayer {
	/** Plays a one-shot synthesized effect by name. */
	playSynthSfx(name: SfxName): void;
}

/**
 * Returns the sound effect a single battle-log event should play, or null.
 *
 * A `damage-dealt` plays `hit` only when it removed HP, since status moves
 * also report as `damage-dealt` with `damage: 0`.
 */
export function sfxForBattleEvent(event: BattleEvent): SfxName | null {
	switch (event.type) {
		case "damage-dealt":
			return event.damage > 0 ? "hit" : null;
		case "creature-fainted":
			return "faint";
		case "item-used":
			return event.healed > 0 || event.revived ? "heal" : null;
		default:
			return null;
	}
}

/**
 * Returns the sound effect an engine event should play, or null.
 *
 * A level-up arrives as an engine `GameEvent`, so this maps it separately
 * from `sfxForBattleEvent`.
 */
export function sfxForGameEvent(event: GameEvent): SfxName | null {
	if (event.type === "creature-experience-granted" && event.levelAfter > event.levelBefore) {
		return "level-up";
	}
	return null;
}
