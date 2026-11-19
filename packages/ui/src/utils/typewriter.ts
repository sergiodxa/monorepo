/**
 * Reveals rendered text character by character without touching its DOM: the unrevealed rest
 * is a range in the `ui-typewriter` CSS highlight, which `typewriterText()` paints transparent,
 * so the text keeps its final layout and a screen reader gets all of it at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The CSS highlight holding every typewriter's unrevealed text. */
export const TYPEWRITER_HIGHLIGHT = "ui-typewriter";

/** Marks an element where typing holds; its value is the hold in milliseconds. */
export const TYPEWRITER_PAUSE_ATTRIBUTE = "data-typewriter-pause";

/** Multiplies the typing speed of the text inside an element; `0.5` types at half speed. */
export const TYPEWRITER_SPEED_ATTRIBUTE = "data-typewriter-speed";

/** How long a pause element holds the typing when its value is empty or not a positive number. */
const DEFAULT_PAUSE_MS = 400;

/** One character's place in the text and the moment it appears. */
interface Step {
	node: Text;
	offset: number;
	at: number;
}

/**
 * The shared highlight the unrevealed ranges go in, registered on first use.
 *
 * @returns The highlight, or `undefined` where the browser lacks the Custom Highlight API, which
 * leaves the text fully painted from the start.
 */
function unrevealed(): Highlight | undefined {
	if (typeof CSS === "undefined" || !("highlights" in CSS)) return undefined;
	let existing = CSS.highlights.get(TYPEWRITER_HIGHLIGHT);
	if (existing !== undefined) return existing;
	let created = new Highlight();
	CSS.highlights.set(TYPEWRITER_HIGHLIGHT, created);
	return created;
}

/**
 * The speed multiplier around a text node: the product of every speed attribute from the node
 * up to `root`, so nested speeds compound.
 *
 * @param node - A text node inside `root`.
 * @param root - The element being typed, where the search stops.
 * @returns The multiplier; `0.5` types at half speed.
 */
function speedAt(node: Node, root: Element): number {
	let rate = 1;
	let element = node.parentElement;
	while (element !== null && element !== root.parentElement) {
		let value = Number(element.getAttribute(TYPEWRITER_SPEED_ATTRIBUTE));
		if (Number.isFinite(value) && value > 0) rate *= value;
		if (element === root) break;
		element = element.parentElement;
	}
	return rate;
}

/**
 * When each character of `root` appears, honoring speed and pause markup.
 *
 * @param root - The element being typed.
 * @param charactersPerSecond - The base typing speed.
 * @returns One step per character, in reading order.
 */
function schedule(root: Element, charactersPerSecond: number): Step[] {
	let steps: Step[] = [];
	let time = 0;
	let walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
	let interval = 1000 / charactersPerSecond;
	for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
		if (node instanceof Element && node.hasAttribute(TYPEWRITER_PAUSE_ATTRIBUTE)) {
			let pause = Number(node.getAttribute(TYPEWRITER_PAUSE_ATTRIBUTE));
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

/**
 * Types out the text of one element. Construct it once the element is in the document, which
 * hides the text, call `start()` to type, and `dispose()` when the element leaves. Paint the
 * host with `typewriterText()` from `@sdxc/ui/styles` so the hidden text stays invisible.
 *
 * @example
 * let writer = new Typewriter(paragraph);
 * writer.start(40);
 * await writer.done;
 */
export class Typewriter {
	#root: Element;
	#range: Range;
	#steps: Step[] = [];
	#shown = 0;
	#start = 0;
	#timer: number | undefined;
	#complete = false;
	#resolve: () => void = () => undefined;
	/** Settles once the whole text is visible, typed out or finished early. */
	readonly done: Promise<void>;

	/**
	 * Hides the whole text, ready to type.
	 *
	 * @param root - The element whose text is typed.
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

	/** True once the text is fully visible. */
	get finished(): boolean {
		return this.#complete;
	}

	/**
	 * Starts typing.
	 *
	 * @param charactersPerSecond - The base typing speed; `0` or less shows the text at once.
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

	/** Shows the rest of the text at once, as a click during typing usually asks. */
	finish(): void {
		clearTimeout(this.#timer);
		this.#complete = true;
		this.#shown = this.#steps.length;
		unrevealed()?.delete(this.#range);
		this.#resolve();
	}

	/** Stops typing and releases the highlight range, leaving `done` unsettled. */
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
