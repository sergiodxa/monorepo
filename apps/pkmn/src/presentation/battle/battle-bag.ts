/**
 * The in-battle Bag menu.
 *
 * Selecting "Bag" from the action menu no longer auto-throws a ball or auto-uses a
 * medicine; it opens this menu so the player chooses what to use. The menu lists
 * the player's battle-usable items — capture balls and recovery medicines — each
 * with its remaining count, and classifies the chosen one: a ball routes to the
 * capture flow, a medicine routes to the in-battle `use-item` turn (opening a small
 * target picker over the active party members first). Cancel returns to the action
 * menu. It owns only selection state and input handling and reuses the shared list
 * widget and window; the battle scene decides what each returned intent dispatches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Item } from "~/game/data/item";

import { isMedicineEffect } from "~/game/systems/medicine-system";

import { type InputManager } from "../core/input";
import { ListMenu } from "../render/list-menu";
import { drawText } from "../render/text";
import * as theme from "../render/theme";
import { Window } from "../render/window";

import type { SfxPlayer } from "./battle-sfx";

/** How a chosen bag item is used in battle. */
export type BattleItemUse = "ball" | "medicine" | null;

/**
 * Classifies how one item is used from the in-battle bag.
 *
 * Capture balls (a capture-multiplier effect, the classic "…ball" family) route to
 * the capture attempt; recovery medicines (an HP/status-healing effect) route to
 * the `use-item` turn. Everything else — held items, battle stat boosters, PP or EV
 * items, misc records, or an unknown id — returns null so the bag leaves it out.
 * This is the pure decision the "Bag no longer auto-captures" regression asserts.
 */
export function battleItemUse(item: Item | undefined): BattleItemUse {
	if (!item) return null;
	if ("effect" in item && isMedicineEffect(item.effect)) return "medicine";
	if ("effect" in item && isCaptureEffect(item.effect)) return "ball";
	return null;
}

/** Whether an item effect is a capture-multiplier (ball) effect. */
function isCaptureEffect(effect: unknown): boolean {
	return (
		typeof effect === "object" &&
		effect !== null &&
		"multiplier" in effect &&
		typeof (effect as { multiplier: unknown }).multiplier === "number"
	);
}

/** One usable battle item as the bag presents it. */
export interface BattleBagItem {
	/** The item's content id, used to dispatch the chosen action. */
	id: string;
	/** The display name shown in the list. */
	name: string;
	/** How many the player holds. */
	count: number;
	/** How selecting it is routed. */
	use: Exclude<BattleItemUse, null>;
}

/** A confirmed bag decision handed back to the battle scene. */
export type BattleBagResult =
	| { kind: "ball"; itemId: string }
	| { kind: "medicine"; itemId: string; target: number }
	| { kind: "cancel" };

/** Drives the in-battle item list and (for medicine) its target picker. */
export class BattleBag {
	/** The item list, or the target picker once a medicine is chosen. */
	private mode: "items" | "target" = "items";

	/** The scrolling list widget shared with every other menu. */
	private readonly list: ListMenu;

	/** The target picker for a chosen medicine. */
	private readonly picker: ListMenu;

	/** The medicine awaiting a target, set while `mode` is "target". */
	private pendingMedicine: string | null = null;

	/**
	 * @param audio - Optional effect player forwarded to the list widgets.
	 */
	constructor(audio?: SfxPlayer) {
		this.list = new ListMenu(5, audio);
		this.picker = new ListMenu(5, audio);
	}

	/** Attaches the effect player to both list widgets after construction. */
	useAudio(audio: SfxPlayer): this {
		this.list.useAudio(audio);
		this.picker.useAudio(audio);
		return this;
	}

	/** Returns the bag to its initial item-list state. */
	reset() {
		this.mode = "items";
		this.pendingMedicine = null;
		this.list.reset();
		this.picker.reset();
	}

	/**
	 * Advances the bag from input, returning a decision when one is confirmed.
	 *
	 * `items` are the usable battle items and `targetNames` name the medicine
	 * targets (the active party members). Confirming a ball returns it immediately;
	 * confirming a medicine opens the target picker, and confirming a target returns
	 * the medicine plus its target index. Cancelling the item list returns to the
	 * action menu; cancelling the picker steps back to the item list.
	 */
	update(
		input: InputManager,
		items: BattleBagItem[],
		targetNames: string[],
	): BattleBagResult | null {
		if (this.mode === "target") return this.updateTarget(input, targetNames);

		this.list.update(input, items.length);
		if (this.list.cancelled(input)) return { kind: "cancel" };
		if (!this.list.confirmed(input) || items.length === 0) return null;

		let entry = items[this.list.selected];
		if (!entry) return null;
		if (entry.use === "ball") return { kind: "ball", itemId: entry.id };

		// A medicine needs a target: open the picker over the active party members.
		this.pendingMedicine = entry.id;
		this.mode = "target";
		this.picker.reset();
		return null;
	}

	/** Handles the medicine target picker. */
	private updateTarget(input: InputManager, targetNames: string[]): BattleBagResult | null {
		this.picker.update(input, targetNames.length);
		if (this.picker.cancelled(input)) {
			this.mode = "items";
			this.pendingMedicine = null;
			return null;
		}
		if (!this.picker.confirmed(input) || targetNames.length === 0) return null;
		let itemId = this.pendingMedicine;
		if (itemId === null) return null;
		return { kind: "medicine", itemId, target: this.picker.selected };
	}

	/** Draws the active bag panel (item list or target picker). */
	render(ctx: CanvasRenderingContext2D, items: BattleBagItem[], targetNames: string[]) {
		if (this.mode === "target") {
			if (targetNames.length === 0) {
				Window.frame(ctx, 4, 112, 232, 44);
				drawText(ctx, "No one to use it on.", 12, 120, { color: theme.TEXT.muted });
				return;
			}
			this.picker.render(ctx, targetNames, 4, 112, 232);
			return;
		}

		if (items.length === 0) {
			Window.frame(ctx, 4, 112, 232, 44);
			drawText(ctx, "No usable items.", 12, 120, { color: theme.TEXT.muted });
			return;
		}
		let labels = items.map((item) => `${item.name}  x${item.count}`);
		this.list.render(ctx, labels, 4, 112, 232);
	}
}
