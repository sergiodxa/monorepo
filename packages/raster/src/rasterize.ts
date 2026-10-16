/**
 * Turns flattened edges into per-pixel coverage with exact-area accumulation: each edge adds
 * the signed area it sweeps to the cells it crosses, and a running sum along each row yields
 * the winding-weighted coverage. Antialiasing is analytic, with no supersampling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Coverage of a path within its clipped bounding box, one value per pixel in `0–1`. */
export interface Coverage {
	x: number;
	y: number;
	width: number;
	height: number;
	values: Float32Array;
}

/**
 * Computes the coverage of `segments` on a canvas of the given size, or `null` when the
 * path lies entirely outside it. Area left of the canvas is folded onto column 0, so a
 * shape extending past the left edge still covers the pixels right of it.
 *
 * @param segments - Flattened edges, four numbers each: `x0, y0, x1, y1`
 * @param rule - `nonzero` clamps the winding sum; `evenodd` folds it so overlaps cancel
 */
export function rasterize(
	segments: readonly number[],
	canvasWidth: number,
	canvasHeight: number,
	rule: "nonzero" | "evenodd" = "nonzero",
): Coverage | null {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let index = 0; index < segments.length; index += 4) {
		let x0 = segments[index] ?? 0;
		let y0 = segments[index + 1] ?? 0;
		let x1 = segments[index + 2] ?? 0;
		let y1 = segments[index + 3] ?? 0;
		minX = Math.min(minX, x0, x1);
		maxX = Math.max(maxX, x0, x1);
		minY = Math.min(minY, y0, y1);
		maxY = Math.max(maxY, y0, y1);
	}
	let left = Math.max(0, Math.floor(minX));
	let top = Math.max(0, Math.floor(minY));
	let right = Math.min(canvasWidth, Math.ceil(maxX));
	let bottom = Math.min(canvasHeight, Math.ceil(maxY));
	if (!(right > left && bottom > top)) return null;
	let width = right - left;
	let height = bottom - top;
	let stride = width + 2;
	let accumulation = new Float32Array(stride * height);
	for (let index = 0; index < segments.length; index += 4) {
		accumulate(
			accumulation,
			stride,
			width,
			height,
			(segments[index] ?? 0) - left,
			(segments[index + 1] ?? 0) - top,
			(segments[index + 2] ?? 0) - left,
			(segments[index + 3] ?? 0) - top,
		);
	}
	let values = new Float32Array(width * height);
	for (let row = 0; row < height; row++) {
		let sum = 0;
		for (let column = 0; column < width; column++) {
			sum += accumulation[row * stride + column] ?? 0;
			let winding = Math.abs(sum);
			values[row * width + column] =
				rule === "nonzero" ? Math.min(1, winding) : 1 - Math.abs(1 - (winding % 2));
		}
	}
	return { x: left, y: top, width, height, values };
}

/**
 * Adds one edge's signed area to the accumulation buffer. Rows outside `0–height` are
 * skipped and x is clamped to `0–width`, which keeps the area an off-canvas part of the
 * edge sweeps while never writing outside the buffer.
 */
function accumulate(
	buffer: Float32Array,
	stride: number,
	width: number,
	height: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
): void {
	if (ay === by) return;
	let direction = ay < by ? 1 : -1;
	let [x0, y0, x1, y1] = ay < by ? [ax, ay, bx, by] : [bx, by, ax, ay];
	let slope = (x1 - x0) / (y1 - y0);
	let x = x0;
	let startRow = Math.max(0, Math.floor(y0));
	if (y0 < 0) x -= y0 * slope;
	let endRow = Math.min(height, Math.ceil(y1));
	for (let row = startRow; row < endRow; row++) {
		let base = row * stride;
		let dy = Math.min(row + 1, y1) - Math.max(row, y0);
		let xNext = x + slope * dy;
		let d = dy * direction;
		let from = Math.min(width, Math.max(0, Math.min(x, xNext)));
		let to = Math.min(width, Math.max(0, Math.max(x, xNext)));
		let fromCell = Math.floor(from);
		let toCell = Math.ceil(to);
		if (toCell <= fromCell + 1) {
			let middle = 0.5 * (from + to) - fromCell;
			add(buffer, base + fromCell, d - d * middle);
			add(buffer, base + fromCell + 1, d * middle);
		} else {
			let inverse = 1 / (to - from);
			let fromFraction = from - fromCell;
			let firstArea = 0.5 * inverse * (1 - fromFraction) ** 2;
			let toFraction = to - toCell + 1;
			let lastArea = 0.5 * inverse * toFraction * toFraction;
			add(buffer, base + fromCell, d * firstArea);
			if (toCell === fromCell + 2) {
				add(buffer, base + fromCell + 1, d * (1 - firstArea - lastArea));
			} else {
				let secondArea = inverse * (1.5 - fromFraction);
				add(buffer, base + fromCell + 1, d * (secondArea - firstArea));
				for (let cell = fromCell + 2; cell < toCell - 1; cell++)
					add(buffer, base + cell, d * inverse);
				let beforeLast = secondArea + (toCell - fromCell - 3) * inverse;
				add(buffer, base + toCell - 1, d * (1 - beforeLast - lastArea));
			}
			add(buffer, base + toCell, d * lastArea);
		}
		x = xNext;
	}
}

/** Adds `amount` to one accumulation cell. */
function add(buffer: Float32Array, index: number, amount: number): void {
	buffer[index] = (buffer[index] ?? 0) + amount;
}
