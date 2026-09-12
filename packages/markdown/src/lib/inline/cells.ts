/**
 * The doubly linked list the inline phase builds into. Emphasis wraps a run of
 * finished nodes in place and a link moves everything after its opener inside
 * itself, so the list has to splice in the middle of what is already written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../../index.js";

/** One finished node, carrying the source span the list needs to trim and re-span it. */
export interface Cell {
	node: Markdown.Inline;
	/** Index in the leaf's text where the node's source begins. */
	start: number;
	/** Index one past the node's last source character. */
	end: number;
	/** Whether the node's value is the source between {@link Cell.start} and {@link Cell.end}, so a caller may trim it. */
	verbatim: boolean;
	previous: Cell | null;
	next: Cell | null;
}

/** The nodes one run has produced so far, in source order. */
export class Cells {
	#head: Cell | null = null;
	#tail: Cell | null = null;

	/** The most recent node, which is what a newline and an autolink read to decide what they may trim. */
	get last(): Cell | null {
		return this.#tail;
	}

	/**
	 * @param node - The node to add
	 * @param start - Index in the leaf's text where its source begins
	 * @param end - Index one past its last source character
	 * @param verbatim - Whether the node's value is that source, unchanged
	 * @returns The cell holding it, which a delimiter or a bracket keeps a handle on
	 */
	append(node: Markdown.Inline, start: number, end: number, verbatim = false): Cell {
		let cell: Cell = { node, start, end, verbatim, previous: this.#tail, next: null };

		if (this.#tail) this.#tail.next = cell;
		else this.#head = cell;

		this.#tail = cell;

		return cell;
	}

	/**
	 * @param after - The cell the new one follows
	 * @param node - The node to add
	 * @param start - Index in the leaf's text where its source begins
	 * @param end - Index one past its last source character
	 * @returns The cell holding it
	 */
	insertAfter(after: Cell, node: Markdown.Inline, start: number, end: number): Cell {
		let cell: Cell = { node, start, end, verbatim: false, previous: after, next: after.next };

		if (after.next) after.next.previous = cell;
		else this.#tail = cell;

		after.next = cell;

		return cell;
	}

	/**
	 * @param cell - The cell to drop, whose node leaves the tree entirely
	 */
	remove(cell: Cell): void {
		if (cell.previous) cell.previous.next = cell.next;
		else this.#head = cell.next;

		if (cell.next) cell.next.previous = cell.previous;
		else this.#tail = cell.previous;

		cell.previous = null;
		cell.next = null;
	}

	/**
	 * Lifts a half-open run of cells out of the list, which is how an emphasis
	 * span and a link claim the nodes written between their delimiters.
	 *
	 * @param from - The first cell to take, or `null` to take nothing
	 * @param to - The cell to stop before, or `null` to take the rest
	 * @returns The nodes taken, in source order
	 */
	extract(from: Cell | null, to: Cell | null): Markdown.Inline[] {
		let taken: Markdown.Inline[] = [];
		let cursor = from;

		while (cursor && cursor !== to) {
			let next = cursor.next;
			taken.push(cursor.node);
			this.remove(cursor);
			cursor = next;
		}

		return taken;
	}

	/** @returns Every node still in the list, in source order */
	toArray(): Markdown.Inline[] {
		let nodes: Markdown.Inline[] = [];

		for (let cursor = this.#head; cursor; cursor = cursor.next) nodes.push(cursor.node);

		return nodes;
	}
}
