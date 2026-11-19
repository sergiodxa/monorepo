/**
 * Reveals a rendered line character by character without touching its DOM: the unrevealed
 * rest is a range in the `novel-unrevealed` CSS highlight, painted transparent, so the line
 * keeps its final layout, screen readers get the whole text at once, and markup effects run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The CSS highlight holding every player's unrevealed text. */
export const UNREVEALED_HIGHLIGHT = "novel-unrevealed";

/** How long `{#pause/}` holds the typewriter unless its element sets `data-novel-pause`. */
const DEFAULT_PAUSE_MS = 400;

/** One character's place in the line and the moment it appears. */
interface Step {
	node: Text;
	offset: number;
	at: number;
}

/**
 * The shared highlight the unrevealed ranges go in, registered on first use.
 *
 * @returns The highlight, or `undefined` where the browser lacks the Custom Highlight API.
 */
function unrevealed(): Highlight | undefined {
	if (typeof CSS === "undefined" || !("highlights" in CSS)) return undefined;
	let existing = CSS.highlights.get(UNREVEALED_HIGHLIGHT);
	if (existing !== undefined) return existing;
	let created = new Highlight();
	CSS.highlights.set(UNREVEALED_HIGHLIGHT, created);
	return created;
}

/**
 * The speed multiplier markup sets around a text node, from every `data-novel-speed` ancestor.
 *
 * @param node - A text node of the line.
 * @param root - The line element, where the search stops.
 * @returns The product of the multipliers; `0.5` reads at half speed.
 */
function speedAt(node: Node, root: Element): number {
	let rate = 1;
	let element = node.parentElement;
	while (element !== null && element !== root.parentElement) {
		let value = Number(element.dataset["novelSpeed"]);
		if (Number.isFinite(value) && value > 0) rate *= value;
		if (element === root) break;
		element = element.parentElement;
	}
	return rate;
}

/**
 * When each character of `root` appears, honoring speed markup and pauses.
 *
 * @param root - The rendered line.
 * @param charactersPerSecond - The reader's text speed.
 * @returns One step per character, in reading order.
 */
function schedule(root: Element, charactersPerSecond: number): Step[] {
	let steps: Step[] = [];
	let time = 0;
	let walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
	let interval = 1000 / charactersPerSecond;
	for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
		if (node instanceof HTMLElement && node.dataset["novelPause"] !== undefined) {
			let pause = Number(node.dataset["novelPause"]);
			time += Number.isFinite(pause) && pause > 0 ? pause : DEFAULT_PAUSE_MS;
			continue;
		}
		if (!(node instanceof Text)) continue;
		let step = interval / speedAt(node, root);
		for (let offset = 0; offset < node.data.length; offset++) {
			time += step;
			steps.push({ node, offset, at: time });
		}
	}
	return steps;
}

/** A line being revealed. */
export class Typewriter {
	#root: Element;
	#range: Range;
	#steps: Step[] = [];
	#shown = 0;
	#start = 0;
	#timer: number | undefined;
	#complete = false;
	#resolve: () => void = () => undefined;
	/** Settles once the whole line is visible, typed out or finished early. */
	readonly done: Promise<void>;

	/**
	 * Hides the whole line, ready to type.
	 *
	 * @param root - The rendered line.
	 */
	constructor(root: Element) {
		this.#root = root;
		this.#range = document.createRange();
		this.#range.selectNodeContents(root);
		unrevealed()?.add(this.#range);
		this.done = new Promise((resolve) => {
			this.#resolve = resolve;
		});
	}

	/** How many characters are visible. */
	get shown(): number {
		return this.#shown;
	}

	/** True once the line is fully visible. */
	get finished(): boolean {
		return this.#complete;
	}

	/**
	 * Starts revealing.
	 *
	 * @param charactersPerSecond - The reader's text speed; `0` or less shows the line at once.
	 */
	start(charactersPerSecond: number): void {
		if (charactersPerSecond <= 0) {
			this.finish();
			return;
		}
		this.#steps = schedule(this.#root, charactersPerSecond);
		if (this.#steps.length === 0) {
			this.finish();
			return;
		}
		this.#start = performance.now();
		this.#tick();
	}

	/** Shows the rest of the line at once, which a click during typing does. */
	finish(): void {
		clearTimeout(this.#timer);
		this.#complete = true;
		this.#shown = this.#steps.length;
		unrevealed()?.delete(this.#range);
		this.#resolve();
	}

	/** Releases the highlight range when the line leaves the screen. */
	dispose(): void {
		clearTimeout(this.#timer);
		unrevealed()?.delete(this.#range);
	}

	/** Reveals every character whose moment has passed, and waits for the next one. */
	#tick(): void {
		let elapsed = performance.now() - this.#start;
		while (this.#shown < this.#steps.length && (this.#steps[this.#shown]?.at ?? 0) <= elapsed) {
			this.#shown++;
		}
		let next = this.#steps[this.#shown];
		if (next === undefined) {
			this.finish();
			return;
		}
		this.#range.setStart(next.node, next.offset);
		this.#range.setEnd(this.#root, this.#root.childNodes.length);
		this.#timer = window.setTimeout(() => this.#tick(), Math.max(0, next.at - elapsed));
	}
}
