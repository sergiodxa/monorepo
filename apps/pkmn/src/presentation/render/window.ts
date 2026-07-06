/**
 * Menu and message window frames.
 *
 * RPG Maker draws every panel from one nine-slice windowskin; this module honours
 * that when a skin image is supplied and otherwise draws a clean procedural frame
 * (filled rounded rectangle plus border) so menus render before art exists. It
 * also offers a cursor glyph for list selection so every menu shares one look.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { WindowColor } from "./theme";

/** Draws framed panels and the shared selection cursor. */
export class Window {
	/**
	 * Draws a panel frame at `(x, y)` of size `w` x `h`.
	 *
	 * With a `skin` the corners are drawn fixed and the edges/center stretched
	 * (a simple nine-slice); without one a rounded, bordered box is drawn.
	 */
	static frame(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		skin?: HTMLImageElement | null,
	) {
		if (skin) {
			Window.nineSlice(ctx, skin, x, y, w, h);
			return;
		}

		let radius = 4;
		ctx.save();
		ctx.fillStyle = WindowColor.panel;
		ctx.strokeStyle = WindowColor.border;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.arcTo(x + w, y, x + w, y + h, radius);
		ctx.arcTo(x + w, y + h, x, y + h, radius);
		ctx.arcTo(x, y + h, x, y, radius);
		ctx.arcTo(x, y, x + w, y, radius);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}

	/** Draws the triangular selection cursor pointing right at `(x, y)`. */
	static cursor(ctx: CanvasRenderingContext2D, x: number, y: number) {
		ctx.save();
		ctx.fillStyle = WindowColor.cursor;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + 6, y + 4);
		ctx.lineTo(x, y + 8);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	/** Renders one windowskin as a nine-slice: fixed corners, stretched edges. */
	private static nineSlice(
		ctx: CanvasRenderingContext2D,
		skin: HTMLImageElement,
		x: number,
		y: number,
		w: number,
		h: number,
	) {
		let c = Math.min(8, Math.floor(skin.width / 3), Math.floor(skin.height / 3));
		let sw = skin.width;
		let sh = skin.height;
		let draw = (
			sx: number,
			sy: number,
			sWidth: number,
			sHeight: number,
			dx: number,
			dy: number,
			dWidth: number,
			dHeight: number,
		) => ctx.drawImage(skin, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);

		// center
		draw(c, c, sw - 2 * c, sh - 2 * c, x + c, y + c, w - 2 * c, h - 2 * c);
		// edges
		draw(c, 0, sw - 2 * c, c, x + c, y, w - 2 * c, c);
		draw(c, sh - c, sw - 2 * c, c, x + c, y + h - c, w - 2 * c, c);
		draw(0, c, c, sh - 2 * c, x, y + c, c, h - 2 * c);
		draw(sw - c, c, c, sh - 2 * c, x + w - c, y + c, c, h - 2 * c);
		// corners
		draw(0, 0, c, c, x, y, c, c);
		draw(sw - c, 0, c, c, x + w - c, y, c, c);
		draw(0, sh - c, c, c, x, y + h - c, c, c);
		draw(sw - c, sh - c, c, c, x + w - c, y + h - c, c, c);
	}
}
