/**
 * The in-battle creature switch/replacement picker.
 *
 * Two related flows share this component. A *forced replacement* opens after the
 * active creature faints and the player must send in a healthy benched creature:
 * cancel is blocked because a replacement is mandatory, and when only one healthy
 * creature remains the caller skips the picker entirely and auto-sends it. A
 * *voluntary switch* opens from the action menu's "Creatures" option: the player
 * picks a healthy benched creature to switch to, and cancel steps back to the
 * action menu. Either way the picker lists only the eligible bench creatures the
 * caller passes in and returns the chosen team-local creature index; the scene
 * decides what to dispatch. It owns only selection state and input handling and
 * reuses the shared list widget and window.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { type InputManager } from "../core/input";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { ListMenu } from "../render/list-menu";
import { drawText } from "../render/text";
import * as theme from "../render/theme";

import type { SfxPlayer } from "./battle-sfx";

/**
 * What to do when a slot needs a replacement, given its eligible bench choices.
 *
 * `lose` — no healthy creature remains, so the side is out (handled by the engine
 * outcome). `auto` — exactly one healthy creature remains, so it is sent in with
 * no prompt. `prompt` — two or more remain, so the player must choose one.
 */
export type ReplacementDecision =
	| { kind: "lose" }
	| { kind: "auto"; creature: number }
	| { kind: "prompt"; choices: number[] };

/**
 * Decides how to fill a forced replacement from its eligible bench choices.
 *
 * `choices` are the team-local creature indices the engine reports as available
 * (already filtered to healthy, non-active benched creatures). Zero means the side
 * has lost, one is auto-sent, and two or more require the player to pick. This is
 * the pure decision the "prompt vs auto-send vs lose" regression asserts.
 */
export function decideReplacement(choices: number[]): ReplacementDecision {
	if (choices.length === 0) return { kind: "lose" };
	if (choices.length === 1) return { kind: "auto", creature: choices[0]! };
	return { kind: "prompt", choices: [...choices] };
}

/** One selectable bench creature as the picker presents it. */
export interface SwitchChoice {
	/** The team-local creature index dispatched when this row is chosen. */
	creature: number;
	/** The display name shown in the list. */
	name: string;
	/** Level, shown alongside the name. */
	level: number;
	/** Current HP, shown as `current/max`. */
	currentHP: number;
	/** Maximum HP, shown as `current/max`. */
	maxHP: number;
	/** Major status label, or null when healthy. */
	status: string | null;
}

/** A confirmed picker decision handed back to the battle scene. */
export type SwitchResult = { kind: "switch"; creature: number } | { kind: "cancel" };

/**
 * Drives the switch/replacement picker over a list of eligible bench creatures.
 *
 * The picker is `forced` for a faint replacement (cancel is ignored so the player
 * cannot back out) or unforced for a voluntary switch (cancel returns to the
 * action menu). Confirming a row returns its team-local creature index. It owns
 * only selection state and reuses the shared list widget; the scene supplies the
 * choices and decides what the returned index dispatches.
 */
export class BattleSwitch {
	/** The scrolling list widget shared with every other menu. */
	private readonly list: ListMenu;

	/** Whether cancel is blocked (a faint replacement is mandatory). */
	private forced = false;

	/**
	 * @param audio - Optional effect player forwarded to the list widget.
	 */
	constructor(audio?: SfxPlayer) {
		this.list = new ListMenu(4, audio);
	}

	/** Attaches the effect player to the list widget after construction. */
	useAudio(audio: SfxPlayer): this {
		this.list.useAudio(audio);
		return this;
	}

	/** Opens the picker fresh, marking whether cancel is blocked. */
	open(forced: boolean) {
		this.forced = forced;
		this.list.reset();
	}

	/**
	 * Advances the picker from input, returning a decision when one is confirmed.
	 *
	 * Confirming a row returns its team-local creature index. Cancelling returns a
	 * `cancel` decision only when the picker is unforced (a voluntary switch); a
	 * forced faint replacement ignores cancel so the player cannot leave a slot empty.
	 */
	update(input: InputManager, choices: SwitchChoice[]): SwitchResult | null {
		this.list.update(input, choices.length);
		if (this.list.cancelled(input) && !this.forced) return { kind: "cancel" };
		if (!this.list.confirmed(input) || choices.length === 0) return null;
		let entry = choices[this.list.selected];
		if (!entry) return null;
		return { kind: "switch", creature: entry.creature };
	}

	/** Draws the full-screen picker panel with a title and each eligible creature. */
	render(ctx: CanvasRenderingContext2D, choices: SwitchChoice[]) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.party;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		drawText(ctx, this.forced ? "SEND IN WHICH?" : "SWITCH TO WHICH?", 8, 6, {
			color: theme.TEXT.default,
		});
		let labels = choices.map(
			(choice) =>
				`${choice.name}  L${choice.level}  ${choice.currentHP}/${choice.maxHP}${
					choice.status ? `  ${choice.status}` : ""
				}`,
		);
		this.list.render(ctx, labels, 8, 20, 224);
	}
}
