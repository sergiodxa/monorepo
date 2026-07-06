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

/** A single combatant's HP bar with an eased displayed value. */
export class HpBar {
	/** The HP value currently drawn, eased toward `target`. */
	private displayed: number;

	/** The HP value the bar is easing toward. */
	private target: number;

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

	/** Points the bar at a new HP value (and optionally a new maximum). */
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

	/** Draws the bar frame, fill, and (optionally) the HP fraction at `(x, y)`. */
	draw(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, showNumbers: boolean) {
		let ratio = this.max > 0 ? Math.max(0, Math.min(1, this.displayed / this.max)) : 0;
		let height = 5;

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
			drawText(ctx, `${Math.ceil(this.displayed)}/${this.max}`, x + width, y + height + 2, {
				align: "right",
				color: theme.HP_BAR_COLOR.numbers,
			});
		}
	}
}
