/**
 * The one owner of the terminal during a run: a live region at the bottom of stderr that tasks
 * and prompts redraw in place, with every other write going above it. A write clears the region,
 * writes, and redraws it, so command output and spinner frames never interleave.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { visibleWidth } from "./style.js";

/** A writable stream a CLI prints to; `process.stdout` and `process.stderr` are ones. */
export interface Output {
	write(text: string): unknown;
	isTTY?: boolean;
	/** The terminal's width in columns. */
	columns?: number;
}

/** Hides the cursor while the region is drawn. */
const HIDE_CURSOR = "\u001B[?25l";

/** Shows it again. */
const SHOW_CURSOR = "\u001B[?25h";

/** Erases from the cursor to the end of the screen. */
const ERASE_DOWN = "\u001B[J";

/** The width assumed for a stream that does not report one. */
const DEFAULT_COLUMNS = 80;

/** The live region on stderr and every write that goes around it. */
export class Screen {
	/** The stream the region is drawn on. */
	readonly stderr: Output;

	/** The lines the region shows now. */
	#lines: readonly string[] = [];

	/** How many terminal rows those lines take, wrapping included. */
	#rows = 0;

	#cursorHidden = false;

	/** How many callers hold the region for themselves (a prompt, a child process). */
	#holds = 0;

	/** Redraws the region's usual content when nobody holds it. */
	#refresh: () => void = () => undefined;

	/** @param stderr - The stream the region is drawn on */
	constructor(stderr: Output) {
		this.stderr = stderr;
	}

	/** The terminal's width. */
	get columns(): number {
		let columns = this.stderr.columns ?? 0;
		return columns > 0 ? columns : DEFAULT_COLUMNS;
	}

	/** Whether a prompt or a child process holds the region. */
	get held(): boolean {
		return this.#holds > 0;
	}

	/** Sets what the region shows when nobody holds it: the running tasks. */
	onRefresh(refresh: () => void): void {
		this.#refresh = refresh;
	}

	/** Replaces the region with `lines`; an empty list clears it and shows the cursor. */
	paint(lines: readonly string[]): void {
		let text = this.#erase();
		if (lines.length === 0) {
			if (this.#cursorHidden) text += SHOW_CURSOR;
			this.#cursorHidden = false;
			this.#lines = [];
			if (text !== "") this.stderr.write(text);
			return;
		}
		if (!this.#cursorHidden) text += HIDE_CURSOR;
		this.#cursorHidden = true;
		text += lines.join("\n");
		this.#lines = lines;
		this.#rows = lines.reduce((rows, line) => rows + this.#rowsOf(line), 0);
		this.stderr.write(text);
	}

	/**
	 * Writes `text` to `target` above the region: the region is cleared first and redrawn
	 * after, when `target` shares the terminal with it.
	 */
	write(target: Output, text: string): void {
		let shared = target === this.stderr || target.isTTY === true;
		if (this.#rows === 0 || !shared) {
			target.write(text);
			return;
		}
		let lines = this.#lines;
		this.paint([]);
		target.write(text);
		this.paint(lines);
	}

	/** Takes the region for a prompt or a child process, clearing what the tasks drew. */
	hold(): void {
		this.#holds += 1;
		if (this.#holds === 1) this.paint([]);
	}

	/** Gives the region back, and the tasks redraw it. */
	release(): void {
		this.#holds = Math.max(0, this.#holds - 1);
		if (this.#holds === 0) this.#refresh();
	}

	/** Clears the region and shows the cursor, as any exit must leave the terminal. */
	restore(): void {
		this.paint([]);
		if (this.#cursorHidden) this.stderr.write(SHOW_CURSOR);
		this.#cursorHidden = false;
	}

	/** The sequence that erases the region, leaving the cursor where it began. */
	#erase(): string {
		if (this.#rows === 0) return "";
		let up = this.#rows > 1 ? `\u001B[${this.#rows - 1}A` : "";
		this.#rows = 0;
		return `\r${up}${ERASE_DOWN}`;
	}

	/** How many rows `line` takes once the terminal wraps it. */
	#rowsOf(line: string): number {
		return Math.max(1, Math.ceil(visibleWidth(line) / this.columns));
	}
}
