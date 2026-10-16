/**
 * Reads the path data of an SVG `d` attribute into a `Path`, converting arcs to cubic
 * Béziers and mapping every point through an affine transform, so a logo or icon exported
 * from a vector editor fills on the canvas at any position and scale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Path } from "./path.js";
import type { Raster } from "./types.js";

/** The identity transform, which leaves every point where the path data puts it. */
const IDENTITY: Raster.Matrix = [1, 0, 0, 1, 0, 0];

/** How many numbers one repetition of each command reads; a flag counts as one. */
const ARITY: Readonly<Record<string, number>> = {
	m: 2,
	l: 2,
	h: 1,
	v: 1,
	c: 6,
	s: 4,
	q: 4,
	t: 2,
	a: 7,
	z: 0,
};

/** A number as SVG writes it, sticky so it matches only at the scanner's position. */
const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;

/** Whitespace as the SVG path grammar defines it. */
const WHITESPACE = /[ \t\n\f\r]/;

/**
 * Appends the path data `d` to `into`. Malformed data is a mistake in the source, so it
 * throws a `RangeError` naming the offending position instead of drawing part of a shape.
 *
 * @param d - The value of an SVG `d` attribute
 * @param into - The path the contours are appended to
 * @param transform - Maps each point before it reaches `into`
 * @throws {RangeError} When `d` breaks the SVG path grammar
 */
export function tracePathData(d: string, into: Path, transform: Raster.Matrix = IDENTITY): Path {
	let scanner = new Scanner(d);
	let [ma, mb, mc, md, me, mf] = transform;
	let mapX = (x: number, y: number) => ma * x + mc * y + me;
	let mapY = (x: number, y: number) => mb * x + md * y + mf;
	let x = 0;
	let y = 0;
	let startX = 0;
	let startY = 0;
	let open = false;
	/** The last curve's second control point, reflected by a following `S` or `T`. */
	let controlX = 0;
	let controlY = 0;
	let previous = "";

	/** Lines to `(nx, ny)`, reopening a contour at its start after a `Z`. */
	let lineTo = (nx: number, ny: number) => {
		if (!open) into.moveTo(mapX(startX, startY), mapY(startX, startY));
		open = true;
		into.lineTo(mapX(nx, ny), mapY(nx, ny));
		x = nx;
		y = ny;
	};

	/** A cubic from the pen in source coordinates; an affine map keeps a Bézier a Bézier. */
	let cubicTo = (c1x: number, c1y: number, c2x: number, c2y: number, nx: number, ny: number) => {
		if (!open) into.moveTo(mapX(startX, startY), mapY(startX, startY));
		open = true;
		into.cubicTo(
			mapX(c1x, c1y),
			mapY(c1x, c1y),
			mapX(c2x, c2y),
			mapY(c2x, c2y),
			mapX(nx, ny),
			mapY(nx, ny),
		);
		x = nx;
		y = ny;
	};

	/** A quadratic from the pen, kept quadratic so it flattens as `Path.quadTo` does. */
	let quadTo = (cx: number, cy: number, nx: number, ny: number) => {
		if (!open) into.moveTo(mapX(startX, startY), mapY(startX, startY));
		open = true;
		into.quadTo(mapX(cx, cy), mapY(cx, cy), mapX(nx, ny), mapY(nx, ny));
		x = nx;
		y = ny;
	};

	scanner.skipSeparators();
	if (!scanner.done && !/[Mm]/.test(scanner.peek())) {
		throw scanner.error("path data must start with a moveto command");
	}

	while (!scanner.skipSeparators()) {
		let letter = scanner.peek();
		let command = letter.toLowerCase();
		let arity = ARITY[command];
		if (arity === undefined || !/[A-Za-z]/.test(letter)) throw scanner.error("expected a command");
		scanner.advance();
		let relative = letter !== letter.toUpperCase();

		if (command === "z") {
			if (open) into.close();
			open = false;
			x = startX;
			y = startY;
			previous = command;
			continue;
		}

		let first = true;
		while (first || scanner.atNumber()) {
			let values = scanner.arguments(command, arity);
			let dx = relative ? x : 0;
			let dy = relative ? y : 0;
			let current = command;

			if (command === "m" && first) {
				x = startX = (values[0] ?? 0) + dx;
				y = startY = (values[1] ?? 0) + dy;
				into.moveTo(mapX(x, y), mapY(x, y));
				open = true;
			} else if (command === "m" || command === "l") {
				lineTo((values[0] ?? 0) + dx, (values[1] ?? 0) + dy);
				current = "l";
			} else if (command === "h") {
				lineTo((values[0] ?? 0) + dx, y);
			} else if (command === "v") {
				lineTo(x, (values[0] ?? 0) + dy);
			} else if (command === "c" || command === "s") {
				let [a = 0, b = 0, c = 0, e = 0, f = 0, g = 0] = values;
				let c1x = 0;
				let c1y = 0;
				let rest = [a, b, c, e];
				if (command === "c") {
					c1x = a + dx;
					c1y = b + dy;
					rest = [c, e, f, g];
				} else {
					let smooth = previous === "c" || previous === "s";
					c1x = smooth ? 2 * x - controlX : x;
					c1y = smooth ? 2 * y - controlY : y;
				}
				let [c2x = 0, c2y = 0, nx = 0, ny = 0] = rest;
				controlX = c2x + dx;
				controlY = c2y + dy;
				cubicTo(c1x, c1y, controlX, controlY, nx + dx, ny + dy);
			} else if (command === "q" || command === "t") {
				let [a = 0, b = 0, c = 0, e = 0] = values;
				let smooth = previous === "q" || previous === "t";
				let qx = command === "q" ? a + dx : smooth ? 2 * x - controlX : x;
				let qy = command === "q" ? b + dy : smooth ? 2 * y - controlY : y;
				controlX = qx;
				controlY = qy;
				quadTo(qx, qy, (command === "q" ? c : a) + dx, (command === "q" ? e : b) + dy);
			} else {
				let [rx = 0, ry = 0, rotation = 0, large = 0, sweep = 0, ex = 0, ey = 0] = values;
				arcTo(x, y, rx, ry, rotation, large === 1, sweep === 1, ex + dx, ey + dy, lineTo, cubicTo);
			}

			previous = current;
			first = false;
		}
	}
	return into.close();
}

/**
 * Converts an endpoint-parameterized elliptical arc to cubic Béziers of at most 90° each,
 * following SVG's implementation notes: a zero radius draws a straight line, and radii too
 * small to reach the endpoint grow just enough to do so.
 */
function arcTo(
	x1: number,
	y1: number,
	radiusX: number,
	radiusY: number,
	rotation: number,
	large: boolean,
	sweep: boolean,
	x2: number,
	y2: number,
	lineTo: (x: number, y: number) => void,
	cubicTo: (c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) => void,
): void {
	if (x1 === x2 && y1 === y2) return;
	let rx = Math.abs(radiusX);
	let ry = Math.abs(radiusY);
	if (rx === 0 || ry === 0) return lineTo(x2, y2);

	let phi = (rotation * Math.PI) / 180;
	let cos = Math.cos(phi);
	let sin = Math.sin(phi);
	let hx = (x1 - x2) / 2;
	let hy = (y1 - y2) / 2;
	let px = cos * hx + sin * hy;
	let py = -sin * hx + cos * hy;

	let lambda = (px * px) / (rx * rx) + (py * py) / (ry * ry);
	if (lambda > 1) {
		rx *= Math.sqrt(lambda);
		ry *= Math.sqrt(lambda);
	}

	let numerator = rx * rx * ry * ry - rx * rx * py * py - ry * ry * px * px;
	let denominator = rx * rx * py * py + ry * ry * px * px;
	let coefficient = Math.sqrt(Math.max(0, numerator / denominator)) * (large === sweep ? -1 : 1);
	let cxp = (coefficient * rx * py) / ry;
	let cyp = (-coefficient * ry * px) / rx;
	let cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
	let cy = sin * cxp + cos * cyp + (y1 + y2) / 2;

	let ux = (px - cxp) / rx;
	let uy = (py - cyp) / ry;
	let vx = (-px - cxp) / rx;
	let vy = (-py - cyp) / ry;
	let start = Math.atan2(uy, ux);
	let span = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
	if (!sweep && span > 0) span -= 2 * Math.PI;
	if (sweep && span < 0) span += 2 * Math.PI;

	let count = Math.max(1, Math.ceil(Math.abs(span) / (Math.PI / 2) - 1e-9));
	let step = span / count;
	let handle = (4 / 3) * Math.tan(step / 4);
	let pointX = (ex: number, ey: number) => cx + cos * rx * ex - sin * ry * ey;
	let pointY = (ex: number, ey: number) => cy + sin * rx * ex + cos * ry * ey;

	for (let index = 0; index < count; index++) {
		let a1 = start + index * step;
		let a2 = a1 + step;
		let e1x = Math.cos(a1) - handle * Math.sin(a1);
		let e1y = Math.sin(a1) + handle * Math.cos(a1);
		let e2x = Math.cos(a2) + handle * Math.sin(a2);
		let e2y = Math.sin(a2) - handle * Math.cos(a2);
		let last = index === count - 1;
		cubicTo(
			pointX(e1x, e1y),
			pointY(e1x, e1y),
			pointX(e2x, e2y),
			pointY(e2x, e2y),
			last ? x2 : pointX(Math.cos(a2), Math.sin(a2)),
			last ? y2 : pointY(Math.cos(a2), Math.sin(a2)),
		);
	}
}

/**
 * Walks path data one token at a time. SVG lets a number end wherever the next one cannot
 * continue it (`10-5`, `.5.5`) and lets arc flags touch (`001`), so tokens are read by what
 * the grammar expects next.
 */
class Scanner {
	#input: string;
	#position = 0;

	constructor(input: string) {
		this.#input = input;
	}

	/** True once every character is consumed. */
	get done(): boolean {
		return this.#position >= this.#input.length;
	}

	/** The character at the current position, empty at the end. */
	peek(): string {
		return this.#input[this.#position] ?? "";
	}

	advance(): void {
		this.#position++;
	}

	/**
	 * Skips whitespace and at most one comma between tokens.
	 *
	 * @returns Whether the input is exhausted
	 */
	skipSeparators(): boolean {
		let comma = false;
		while (!this.done) {
			let char = this.peek();
			if (WHITESPACE.test(char)) this.advance();
			else if (char === "," && !comma) {
				comma = true;
				this.advance();
			} else break;
		}
		return this.done;
	}

	/** Whether another set of arguments follows, which repeats the previous command. */
	atNumber(): boolean {
		this.skipSeparators();
		return /[\d.+-]/.test(this.peek());
	}

	/** Reads one repetition of `command`'s arguments, flags included. */
	arguments(command: string, arity: number): number[] {
		let values: number[] = [];
		for (let index = 0; index < arity; index++) {
			this.skipSeparators();
			let flag = command === "a" && (index === 3 || index === 4);
			values.push(flag ? this.#flag() : this.#number());
		}
		return values;
	}

	/** A `RangeError` pointing at the current position. */
	error(problem: string): RangeError {
		let found = this.done ? "end of input" : `"${this.peek()}"`;
		return new RangeError(
			`Invalid SVG path data at position ${this.#position} (${found}): ${problem}`,
		);
	}

	#number(): number {
		NUMBER.lastIndex = this.#position;
		let match = NUMBER.exec(this.#input);
		if (!match) throw this.error("expected a number");
		this.#position = NUMBER.lastIndex;
		return Number(match[0]);
	}

	#flag(): number {
		let char = this.peek();
		if (char !== "0" && char !== "1") throw this.error("expected an arc flag, 0 or 1");
		this.advance();
		return char === "1" ? 1 : 0;
	}
}
