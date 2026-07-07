/**
 * An animated battle HP bar.
 *
 * Each bar tracks a displayed value that eases toward the true HP the engine
 * reports, so damage and healing read as a smooth drain or refill rather than a
 * jump. The fill color follows the classic thresholds (green, yellow, red) and
 * the bar can be told to drive the low-HP beep. Drawing is procedural so bars
 * render without a windowskin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { drawText } from "../render/text";
import * as theme from "../render/theme";

import { hpText } from "./status-layout";

/** A single combatant's HP bar with an eased displayed value. */
export class HpBar {
	/** The HP value currently drawn, eased toward `target`. */
	private displayed: number;

	/** The HP value the bar is easing toward. */
	private target: number;

	/**
	 * Identifies the creature the bar currently tracks.
	 *
	 * A slot's bar is reused across replacements, so the fresh combatant would
	 * otherwise inherit the fainted one's `displayed` value and ease *up* from 0 to
	 * full. `bindTo` records the active creature and snaps the bar when it changes,
	 * so the bar always tracks the actually-active creature (guards against Bug 2).
	 */
	private creatureKey: string | null = null;

	/**
	 * @param max - Maximum HP, the full-bar value.
	 * @param current - Starting HP, shown immediately.
	 */
	constructor(
		private max: number,
		current: number,
	) {
		this.displayed = current;
		this.target = current;
	}

	/**
	 * Binds the bar to the creature now occupying its slot, snapping on a change.
	 *
	 * When the slot's creature changes (a replacement or voluntary switch) the bar
	 * jumps straight to the new creature's HP instead of easing from the previous
	 * occupant's displayed value, so a fresh full-HP creature never animates up from
	 * a fainted 0. On the first bind and on unchanged keys the displayed value is
	 * left alone so ordinary damage/heal easing is unaffected.
	 */
	bindTo(creatureKey: string, current: number, max = this.max) {
		if (this.creatureKey !== creatureKey) {
			// A new creature took the slot: snap straight to its HP so a full-HP
			// replacement never eases up from the previous occupant's value.
			this.creatureKey = creatureKey;
			this.max = max;
			this.displayed = current;
			this.target = current;
			return;
		}
		// Same creature: track its HP the ordinary way, so damage/heal still eases.
		this.setTarget(current, max);
	}

	/**
	 * Points the bar at a new HP value (and optionally a new maximum).
	 *
	 * Both a drain and a legitimate refill (a heal or revive on the *same* creature)
	 * ease toward the new value. A refill caused by a *different* creature taking the
	 * slot — the fainted-then-replaced case that is Bug 2 — is not reached here: the
	 * scene rebinds the bar through `bindTo`, which snaps rather than easing, so the
	 * bar never climbs up from a fainted 0.
	 */
	setTarget(current: number, max = this.max) {
		this.max = max;
		this.target = current;
	}

	/** Eases the displayed value toward the target by `dt` milliseconds. */
	update(dt: number) {
		if (this.displayed === this.target) return;
		let rate = (this.max / 1000) * dt; // ~1s to cross a full bar
		if (this.displayed < this.target) this.displayed = Math.min(this.target, this.displayed + rate);
		else this.displayed = Math.max(this.target, this.displayed - rate);
	}

	/** True once the displayed value has reached the target. */
	get settled(): boolean {
		return Math.abs(this.displayed - this.target) < 0.5;
	}

	/** The bar's fixed pixel height. */
	static readonly HEIGHT = 5;

	/**
	 * Draws the bar frame and fill at `(x, y)`, and optionally the HP fraction.
	 *
	 * When numbers are shown they are drawn right-aligned to the bar's right edge at
	 * `numbersY`, which the caller sizes so the text sits *inside* the status box
	 * above the bar rather than spilling below it. The number color is a dark theme
	 * value so it reads clearly on the light window panel.
	 */
	draw(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		width: number,
		showNumbers: boolean,
		numbersY = y,
	) {
		let ratio = this.max > 0 ? Math.max(0, Math.min(1, this.displayed / this.max)) : 0;
		let height = HpBar.HEIGHT;

		ctx.fillStyle = theme.HP_BAR_COLOR.outline;
		ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
		ctx.fillStyle = theme.HP_BAR_COLOR.track;
		ctx.fillRect(x, y, width, height);
		ctx.fillStyle =
			ratio > 0.5
				? theme.HP_BAR_COLOR.fillHigh
				: ratio > 0.2
					? theme.HP_BAR_COLOR.fillMedium
					: theme.HP_BAR_COLOR.fillLow;
		ctx.fillRect(x, y, Math.round(width * ratio), height);

		if (showNumbers) {
			drawText(ctx, hpText(Math.ceil(this.displayed), this.max), x + width, numbersY, {
				align: "right",
				color: theme.HP_BAR_COLOR.numbers,
			});
		}
	}
}
