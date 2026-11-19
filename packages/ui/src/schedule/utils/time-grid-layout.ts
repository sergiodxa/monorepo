/**
 * Lays a day's timed events out side by side and a range's all-day spans out in rows, the two
 * placements a calendar's time grid needs. Events that overlap share their cluster's width in
 * columns, and an event widens into the columns to its right that are free for its whole length.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A timed event as the layout reads it: minutes from the day's start. */
export interface TimedItem {
	id: string;
	start: number;
	end: number;
}

/** Where an event sits within its overlap cluster. */
export interface TimedPlacement {
	/** Its column, from 0. */
	column: number;
	/** How many columns its cluster splits into. */
	columns: number;
	/** How many columns it spans, from its own rightwards. */
	span: number;
}

/** An all-day span as the layout reads it: indexes of its first and last visible day. */
export interface SpanItem {
	id: string;
	first: number;
	last: number;
}

/**
 * The end a placement compares against: a zero-length event still blocks the minute it marks,
 * so two events at the same instant never draw on top of each other.
 */
function blockingEnd(item: TimedItem): number {
	return Math.max(item.end, item.start + 1);
}

/** Whether two events share any minute. */
function overlaps(a: TimedItem, b: TimedItem): boolean {
	return a.start < blockingEnd(b) && b.start < blockingEnd(a);
}

/**
 * Places a day's events: events whose times chain together by overlap form a cluster split into
 * as many columns as it needs at its busiest, each event in the first column free at its start
 * (earlier starts first, longer events first on a tie), then widened rightwards while free.
 *
 * @param items The day's events, in any order.
 * @returns Each event's placement, keyed by its id.
 * @example layoutTimedItems([{ id: "a", start: 540, end: 600 }, { id: "b", start: 570, end: 630 }]) // a column 0 of 2, b column 1 of 2
 */
export function layoutTimedItems(items: TimedItem[]): Map<string, TimedPlacement> {
	let sorted = items
		.slice()
		.sort(
			(a, b) => a.start - b.start || blockingEnd(b) - blockingEnd(a) || a.id.localeCompare(b.id),
		);
	let placements = new Map<string, TimedPlacement>();
	let cluster: Array<{ item: TimedItem; column: number }> = [];
	let columnEnds: number[] = [];
	let clusterEnd = -Infinity;

	/** Fixes the finished cluster's column count and each event's span. */
	function close(): void {
		let columns = columnEnds.length;
		for (let entry of cluster) {
			let span = 1;
			while (
				entry.column + span < columns &&
				!cluster.some(
					(other) => other.column === entry.column + span && overlaps(other.item, entry.item),
				)
			) {
				span += 1;
			}
			placements.set(entry.item.id, { column: entry.column, columns, span });
		}
		cluster = [];
		columnEnds = [];
	}

	for (let item of sorted) {
		if (item.start >= clusterEnd) close();
		let column = columnEnds.findIndex((end) => end <= item.start);
		if (column === -1) {
			column = columnEnds.length;
			columnEnds.push(blockingEnd(item));
		} else {
			columnEnds[column] = blockingEnd(item);
		}
		cluster.push({ item, column });
		clusterEnd = Math.max(clusterEnd, blockingEnd(item));
	}
	close();
	return placements;
}

/**
 * Stacks all-day spans into rows: longer spans first so they claim the top rows, then each in
 * the first row that is free across all of its days.
 *
 * @param items The spans, clipped to the visible days.
 * @returns Each span's row from 0, keyed by its id, and how many rows the lane needs.
 */
export function layoutSpanItems(items: SpanItem[]): { rows: Map<string, number>; count: number } {
	let sorted = items
		.slice()
		.sort(
			(a, b) =>
				a.first - b.first || b.last - b.first - (a.last - a.first) || a.id.localeCompare(b.id),
		);
	let taken: Array<Array<[number, number]>> = [];
	let rows = new Map<string, number>();
	for (let item of sorted) {
		let row = taken.findIndex((ranges) =>
			ranges.every(([first, last]) => item.last < first || item.first > last),
		);
		if (row === -1) {
			row = taken.length;
			taken.push([]);
		}
		taken[row]!.push([item.first, item.last]);
		rows.set(item.id, row);
	}
	return { rows, count: taken.length };
}
