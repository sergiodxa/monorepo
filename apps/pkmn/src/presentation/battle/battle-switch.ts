/**
 * The in-battle creature switch/replacement picker.
 *
 * A forced replacement (after a faint) blocks cancel and auto-sends when
 * only one healthy creature remains; a voluntary switch allows cancel back
 * to the action menu. Confirming returns the chosen team-local index.
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
 * `lose` means no healthy creature remains; `auto` sends the lone survivor
 * with no prompt; `prompt` asks the player to choose among two or more.
 */
export type ReplacementDecision =
	| { kind: "lose" }
	| { kind: "auto"; creature: number }
	| { kind: "prompt"; choices: number[] };

/**
 * Decides how to fill a forced replacement from its eligible bench choices.
 *
 * `choices` is already filtered to healthy, non-active benched creatures:
 * zero means the side has lost, one auto-sends, two or more prompt.
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
	name: string;
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
 * A `forced` picker ignores cancel so a fainted creature is always replaced;
 * an unforced one lets cancel return to the action menu.
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
	 * Cancel resolves only when the picker is unforced; a forced replacement
	 * ignores it so the player cannot leave a slot empty.
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
