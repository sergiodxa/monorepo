/**
 * Layout and colour checks a browser test runs against a mounted page: horizontal overflow,
 * text that falls under WCAG contrast against what it sits on, and the heading outline. A
 * reviewer's eye, written down so a regression fails a run instead of a review.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The widths every page is held to, from the smallest phone to a wide laptop. */
export const WIDTHS = [320, 375, 768, 1024, 1280, 1440] as const;

/** A text node that fails contrast, with what it says and the ratio it reached. */
export interface ContrastFailure {
	text: string;
	ratio: number;
	required: number;
}

/** One pixel to resolve any CSS colour (oklch, color-mix, a variable) into sRGB bytes. */
let probe: CanvasRenderingContext2D | undefined;

/**
 * Paints `colour` over `under` and reads the pixel back, so transparency and every colour
 * syntax the browser understands resolve to the sRGB the reader actually sees.
 */
function paint(
	colour: string,
	under: readonly number[] = [255, 255, 255],
): [number, number, number] {
	probe ??=
		document.createElement("canvas").getContext("2d", { willReadFrequently: true }) ?? undefined;
	if (!probe) throw new Error("No 2D canvas to resolve colours with");
	probe.clearRect(0, 0, 1, 1);
	probe.fillStyle = `rgb(${under.join(" ")})`;
	probe.fillRect(0, 0, 1, 1);
	probe.fillStyle = colour;
	probe.fillRect(0, 0, 1, 1);
	let [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data;
	return [r, g, b];
}

/** Relative luminance of an sRGB colour, per WCAG 2. */
function luminance(rgb: readonly number[]): number {
	let [r = 0, g = 0, b = 0] = rgb.map((channel) => {
		let c = channel / 255;
		return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Whether a colour covers what is under it completely: it paints the same over black and white. */
function opaque(colour: string): boolean {
	return paint(colour, [0, 0, 0]).join() === paint(colour, [255, 255, 255]).join();
}

/** The solid colour behind `element`: its painted backgrounds, stacked up to the first opaque one. */
function backdrop(element: Element): [number, number, number] {
	let layers: string[] = [];
	for (let node: Element | null = element; node; node = node.parentElement) {
		let colour = getComputedStyle(node).backgroundColor;
		if (!colour || colour === "rgba(0, 0, 0, 0)" || colour === "transparent") continue;
		layers.push(colour);
		if (opaque(colour)) break;
	}
	let base: [number, number, number] = [255, 255, 255];
	for (let colour of [...layers].reverse()) base = paint(colour, base);
	return base;
}

/**
 * Lists every visible text run under `root` whose colour falls short of 4.5:1 against its
 * backdrop, or 3:1 when it is large (24px, or 18.66px bold). Skips text inside elements a
 * reader cannot see, and inside drawn images, which are named as a whole.
 *
 * @param root - The subtree to audit.
 * @returns The failures, empty when every run passes.
 */
export function contrastFailures(root: Element): ContrastFailure[] {
	let failures: ContrastFailure[] = [];
	let walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		let text = node.textContent?.trim();
		let element = node.parentElement;
		if (!text || !element || element.closest("svg, [aria-hidden='true'], [hidden]")) continue;
		let rect = element.getBoundingClientRect();
		let style = getComputedStyle(element);
		if (rect.width === 0 || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
		if (element.closest("[data-slot='visually-hidden'], .sr-only") || rect.width <= 1) continue;
		let under = backdrop(element);
		let fore = paint(style.color, under);
		let [one, two] = [luminance(fore), luminance(under)];
		let ratio = (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
		let size = Number.parseFloat(style.fontSize);
		let large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
		let required = large ? 3 : 4.5;
		if (ratio < required)
			failures.push({ text: text.slice(0, 40), ratio: Number(ratio.toFixed(2)), required });
	}
	return failures;
}

/**
 * Measures how far the page reaches past the viewport's right edge.
 *
 * @returns The overflow in pixels; 0 when nothing scrolls sideways.
 */
export function horizontalOverflow(): number {
	return Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * Lists the elements wider than the viewport, by their tag and slot, to say what overflowed.
 *
 * @param root - The subtree to search.
 * @returns A short description of each offender.
 */
export function overflowingElements(root: Element): string[] {
	let limit = document.documentElement.clientWidth;
	return [...root.querySelectorAll("*")]
		.filter((element) => {
			let rect = element.getBoundingClientRect();
			return rect.right > limit + 1 && !element.closest("[data-slot='code-stage'] pre, pre");
		})
		.map(
			(element) => `${element.tagName.toLowerCase()}[${element.getAttribute("data-slot") ?? ""}]`,
		);
}

/**
 * Reads the heading levels under `root` in document order.
 *
 * @param root - The subtree to read.
 * @returns Each heading's level.
 */
export function headingLevels(root: Element): number[] {
	return [...root.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((heading) =>
		Number(heading.tagName.slice(1)),
	);
}
