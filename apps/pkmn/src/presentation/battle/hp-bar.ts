/**
 * An animated battle HP bar.
 *
 * Eases the displayed value toward the HP the engine reports, so damage and
 * healing read as a smooth drain or refill. The fill color follows green,
 * yellow, and red thresholds as the ratio drops.
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
	 * `bindTo` snaps the bar directly to a freshly slotted creature's HP when the
	 * key changes, guarding against the fainted-then-replaced case (Bug 2).
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
	 * A changed key jumps the bar straight to the new HP; an unchanged key eases
	 * toward it as ordinary damage or healing.
	 */
	bindTo(creatureKey: string, current: number, max = this.max) {
		if (this.creatureKey !== creatureKey) {
			this.creatureKey = creatureKey;
			this.max = max;
			this.displayed = current;
			this.target = current;
			return;
		}
		this.setTarget(current, max);
	}

	/**
	 * Points the bar at a new HP value (and optionally a new maximum), easing
	 * toward it for drains and for heals or revives on the same creature.
	 */
	setTarget(current: number, max = this.max) {
		this.max = max;
		this.target = current;
	}

	/**
	 * Eases the displayed value toward the target by `dt` milliseconds, moving at
	 * a rate that crosses a full bar in about a second.
	 */
	update(dt: number) {
		if (this.displayed === this.target) return;
		let rate = (this.max / 1000) * dt;
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
	 * `numbersY` lets the caller place the HP text inside the status box above
	 * the bar, in a dark theme color readable on the light window panel.
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
