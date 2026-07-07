/**
 * Translates ordered battle events into sequential animation tasks.
 *
 * Each engine `BattleEvent` becomes zero or more tasks — a narration message, an
 * HP-bar drain, a faint — that the scene's queue drains in order. The scene
 * supplies a small `BattleHud` so this module stays free of rendering details: it
 * only decides what to say and which bar to move, never how they are drawn. HP
 * changes come straight from the event's `remainingHP`, never from selector
 * diffs, exactly as the ADR requires.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BattleEvent, BattlePosition } from "~/game/battle/battle";

import { Typewriter } from "../render/text";

import type { AnimationTask } from "./animation-queue";
import type { SfxPlayer } from "./battle-sfx";

import { callbackTask } from "./animation-queue";
import { sfxForBattleEvent } from "./battle-sfx";

/** How long a fully-typed message lingers before the next task runs. */
const MESSAGE_LINGER_MS = 700;

/** Characters revealed per second in battle messages. */
const MESSAGE_SPEED = 50;

/** The narration surface the scene exposes to the animation builder. */
export interface BattleHud {
	/** Sets the message-box text (null clears it). */
	setMessage(text: string | null): void;
	/** The display name of the creature in a slot. */
	nameAt(position: BattlePosition): string;
	/** The display name of a move id. */
	moveName(moveId: string): string;
	/** Points a slot's HP bar at a new value. */
	setHp(position: BattlePosition, remaining: number): void;
	/** True once a slot's HP bar has finished easing. */
	isSettled(position: BattlePosition): boolean;
	/** Marks a slot as fainted for rendering. */
	markFainted(position: BattlePosition): void;
}

/**
 * Builds the ordered task list for one burst of battle events.
 *
 * When an `audio` player is supplied, events that carry a sound effect enqueue a
 * zero-duration task that plays it at the visual moment — `hit` as an HP bar
 * starts draining, `heal` as a treated bar refills, `faint` alongside the faint
 * marker. The `audio` argument is optional so existing callers and tests keep
 * working, and the synth is a safe no-op when Web Audio is unavailable.
 */
export function buildBattleTasks(
	events: BattleEvent[],
	hud: BattleHud,
	audio?: SfxPlayer,
): AnimationTask[] {
	let tasks: AnimationTask[] = [];
	let message = (text: string) => tasks.push(messageTask(text, hud));
	let sfx = (event: BattleEvent) => {
		if (!audio) return;
		let name = sfxForBattleEvent(event);
		if (name) tasks.push(callbackTask(() => audio.playSynthSfx(name)));
	};

	for (let event of events) {
		switch (event.type) {
			case "move-used":
				message(`${hud.nameAt(event.user)} used ${hud.moveName(event.moveId)}!`);
				break;
			case "effectiveness":
				if (event.effectiveness === 0) message("It doesn't affect it...");
				else if (event.effectiveness < 1) message("It's not very effective...");
				else if (event.effectiveness > 1) message("It's super effective!");
				break;
			case "critical-hit":
				message("A critical hit!");
				break;
			case "damage-dealt":
				sfx(event);
				tasks.push(hpTask(event.target, event.remainingHP, hud));
				break;
			case "move-missed":
				message(`${hud.nameAt(event.user)}'s attack missed!`);
				break;
			case "move-failed":
				message("But it failed!");
				break;
			case "escape-failed":
				message("Couldn't get away!");
				break;
			case "item-used": {
				message(`Used the ${event.itemId}.`);
				if (event.revived) message(`${hud.nameAt(event.user)} was revived!`);
				// Only the acting slot has a rendered HP bar; drive it toward the
				// reported HP so healing a benched teammate stays a no-op on screen.
				if (event.healed > 0 || event.revived) {
					sfx(event);
					tasks.push(hpTask(event.user, event.remainingHP, hud));
				}
				break;
			}
			case "status-applied":
				message(`${hud.nameAt(event.target)} was afflicted by ${event.status}!`);
				break;
			case "volatile-applied":
				message(`${hud.nameAt(event.target)} — ${event.effect.replace(/-/g, " ")}!`);
				break;
			case "stat-stage-changed":
				message(`${hud.nameAt(event.target)}'s stat ${event.stages > 0 ? "rose" : "fell"}!`);
				break;
			case "side-effect-applied":
				message(`${event.effect.replace(/-/g, " ")} took effect!`);
				break;
			case "field-effect-applied":
				message(`${event.effect.replace(/-/g, " ")} filled the field!`);
				break;
			case "hazard-triggered":
				message(`${hud.nameAt(event.target)} was hurt by ${event.effect.replace(/-/g, " ")}!`);
				break;
			case "creature-switched":
				message(`Go, ${hud.nameAt(event.target)}!`);
				break;
			case "creature-fainted":
				tasks.push(messageTask(`${hud.nameAt(event.target)} fainted!`, hud));
				sfx(event);
				tasks.push(faintTask(event.target, hud));
				break;
			// turn-started / turn-ended / requests / battle-started / battle-finished:
			// bookkeeping the scene handles directly.
		}
	}

	return tasks;
}

/** A task that reveals `text` character by character, then lingers. */
function messageTask(text: string, hud: BattleHud): AnimationTask {
	let writer = new Typewriter(text, MESSAGE_SPEED);
	let linger = 0;
	return {
		update(dt) {
			writer.update(dt);
			hud.setMessage(writer.visibleText);
			if (!writer.done) return false;
			linger += dt;
			return linger >= MESSAGE_LINGER_MS;
		},
	};
}

/** A task that points a slot's HP bar at `remaining` and waits for it to settle. */
function hpTask(position: BattlePosition, remaining: number, hud: BattleHud): AnimationTask {
	let started = false;
	return {
		update() {
			if (!started) {
				hud.setHp(position, remaining);
				started = true;
			}
			return hud.isSettled(position);
		},
	};
}

/** A task that marks a slot fainted after a short beat. */
function faintTask(position: BattlePosition, hud: BattleHud): AnimationTask {
	let elapsed = 0;
	return {
		update(dt) {
			elapsed += dt;
			if (elapsed < 300) return false;
			hud.markFainted(position);
			return true;
		},
	};
}
