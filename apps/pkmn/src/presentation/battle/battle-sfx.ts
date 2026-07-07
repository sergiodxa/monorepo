/**
 * Pure mapping from battle events to synthesized sound-effect names.
 *
 * The battle scene folds the engine's ordered event stream into presentation
 * tasks; this module answers the adjacent question of which sound effect, if
 * any, each event should trigger. Keeping the decision here — free of the audio
 * context, the scene, and any rendering — makes it a plain, unit-testable
 * function: a damaging hit blips `hit`, a faint plays `faint`, a recovery item
 * plays `heal`, and everything else is silent (`null`). Level-ups arrive as a
 * separate engine `GameEvent` rather than a battle-log event, so a small
 * companion helper covers that signal too.
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
 * The real `AudioManager` satisfies this structurally; tests pass a tiny spy.
 * Trigger sites depend on this instead of the whole manager so they never
 * reach for music, cries, or mixing — and stay safe when audio is absent.
 */
export interface SfxPlayer {
	/** Plays a one-shot synthesized effect by name. */
	playSynthSfx(name: SfxName): void;
}

/**
 * Returns the sound effect a single battle-log event should play, or null.
 *
 * Only three battle-log events carry audio: a `damage-dealt` that actually
 * removed HP plays `hit`, a `creature-fainted` plays `faint`, and an `item-used`
 * that healed or revived plays `heal`. Zero-damage hits (status moves reported
 * as `damage-dealt` with `damage: 0`) and pure status-cure items stay silent, as
 * does every other event kind.
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
 * A level-up rides in on `creature-experience-granted` (not the battle log), so
 * it is mapped here: any grant whose `levelAfter` exceeds `levelBefore` plays
 * `level-up`. Experience that did not cross a level boundary, and every other
 * engine event, are silent.
 */
export function sfxForGameEvent(event: GameEvent): SfxName | null {
	if (event.type === "creature-experience-granted" && event.levelAfter > event.levelBefore) {
		return "level-up";
	}
	return null;
}
