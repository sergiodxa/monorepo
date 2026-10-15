/**
 * A virtual terminal: an output stream that applies the cursor movement, erasing and wrapping a
 * real terminal does, so a test reads the screen a person would see instead of the escape
 * sequences that drew it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Output } from "./screen.js";

/** A CSI escape sequence: parameters and the final letter. */
// oxlint-disable-next-line eslint/no-control-regex -- CSI sequences start with the ESC control character
const CSI = /^\u001B\[([0-9;?]*)([A-Za-z])/;

/** A screen that keeps every row written to it, scrolling never discarding one. */
export class VirtualTerminal implements Output {
	readonly isTTY = true;
	readonly columns: number;
	#rows: string[][] = [[]];
	#row = 0;
	#column = 0;

	/** @param columns - The width text wraps at */
	constructor(columns: number) {
		this.columns = columns;
	}

	/** Applies `text` as a terminal would. */
	write(text: string): boolean {
		let index = 0;
		while (index < text.length) {
			let rest = text.slice(index);
			let sequence = CSI.exec(rest);
			if (sequence !== null) {
				this.#control(sequence[1] as string, sequence[2] as string);
				index += sequence[0].length;
				continue;
			}
			let character = String.fromCodePoint(rest.codePointAt(0) as number);
			index += character.length;
			if (character === "\r") this.#column = 0;
			else if (character === "\n") this.#moveTo(this.#row + 1, 0);
			else if (character === "\u001B") continue;
			else this.#print(character);
		}
		return true;
	}

	/** The screen as text: each row without trailing spaces, trailing empty rows dropped. */
	screen(): string {
		let lines = this.#rows.map((row) => row.join("").replace(/\s+$/, ""));
		while (lines.length > 0 && lines.at(-1) === "") lines.pop();
		return lines.join("\n");
	}

	/** Prints one character, wrapping first when the previous one filled the row. */
	#print(character: string): void {
		if (this.#column >= this.columns) this.#moveTo(this.#row + 1, 0);
		let row = this.#rows[this.#row] as string[];
		while (row.length < this.#column) row.push(" ");
		row[this.#column] = character;
		this.#column += 1;
	}

	#moveTo(row: number, column: number): void {
		this.#row = Math.max(0, row);
		this.#column = Math.max(0, column);
		while (this.#rows.length <= this.#row) this.#rows.push([]);
	}

	/** Applies one CSI sequence; styling and cursor visibility change nothing on the text. */
	#control(parameters: string, command: string): void {
		let count = parameters === "" ? 1 : Number.parseInt(parameters, 10) || 1;
		let row = this.#rows[this.#row] as string[];
		switch (command) {
			case "A":
				this.#moveTo(this.#row - count, this.#column);
				break;
			case "B":
				this.#moveTo(this.#row + count, this.#column);
				break;
			case "C":
				this.#column = Math.min(this.columns, this.#column + count);
				break;
			case "D":
				this.#column = Math.max(0, this.#column - count);
				break;
			case "G":
				this.#column = count - 1;
				break;
			case "K":
				row.length = Math.min(row.length, this.#column);
				break;
			case "J":
				row.length = Math.min(row.length, this.#column);
				this.#rows.length = this.#row + 1;
				break;
			default:
				break;
		}
	}
}
