/**
 * Histogram diff, the alignment `git diff --histogram` draws: find the longest run of lines
 * whose rarest line is as rare as possible on the old side, split there, and repeat on both
 * halves. Regions whose common lines are all too frequent fall back to Myers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Budget } from "./myers.js";

import { markRange, myersDiscarding } from "./myers.js";

/** Lines occurring more often than this on the old side are too common to anchor a split. */
const MAX_CHAIN_LENGTH = 64;

/** The best anchor found in one region, as inclusive ranges on both sides. */
interface Anchor {
	found: boolean;
	/** A common line exists but every one is more frequent than `MAX_CHAIN_LENGTH`. */
	hasCommon: boolean;
	/** The occurrence count of the anchor's rarest line, starting above the cap. */
	count: number;
	begin1: number;
	end1: number;
	begin2: number;
	end2: number;
}

/**
 * Per-diff scratch space indexed by line id or old-side position. `stamp` tags which region
 * last wrote an id's record, so nothing is cleared between regions.
 */
interface Index {
	stamp: Int32Array;
	first: Int32Array;
	count: Int32Array;
	next: Int32Array;
	serial: number;
}

/**
 * Indexes `a[aLo, aHi)`: each id's first position and occurrence count, and for each position
 * the next one holding the same id (or -1).
 */
function scan(a: Int32Array, aLo: number, aHi: number, index: Index): void {
	index.serial++;
	let { stamp, first, count, next, serial } = index;
	for (let ptr = aHi - 1; ptr >= aLo; ptr--) {
		let id = a[ptr]!;
		if (stamp[id] === serial) {
			next[ptr] = first[id]!;
			first[id] = ptr;
			count[id]!++;
		} else {
			stamp[id] = serial;
			first[id] = ptr;
			count[id] = 1;
			next[ptr] = -1;
		}
	}
}

/**
 * Extends every occurrence of `b[bPtr]` on the old side into the longest common run around it
 * and keeps the run if it is longer than the best so far or its rarest line is rarer.
 *
 * @returns The next new-side position worth trying: past the end of the longest run found.
 */
function tryAnchor(
	a: Int32Array,
	aLo: number,
	aHi: number,
	b: Int32Array,
	bLo: number,
	bHi: number,
	bPtr: number,
	index: Index,
	anchor: Anchor,
	budget: Budget,
): number {
	let bNext = bPtr + 1;
	let id = b[bPtr]!;
	if (index.stamp[id] !== index.serial) return bNext;
	let records = index.count[id]!;
	anchor.hasCommon = true;
	if (records > anchor.count) return bNext;
	let { count, next } = index;
	let as = index.first[id]!;
	for (;;) {
		let np = next[as]!;
		let bs = bPtr;
		let ae = as;
		let be = bs;
		let rc = records;
		while (aLo < as && bLo < bs && a[as - 1] === b[bs - 1]) {
			as--;
			bs--;
			if (rc > 1) rc = Math.min(rc, count[a[as]!]!);
		}
		while (ae < aHi - 1 && be < bHi - 1 && a[ae + 1] === b[be + 1]) {
			ae++;
			be++;
			if (rc > 1) rc = Math.min(rc, count[a[ae]!]!);
		}
		budget.remaining -= ae - as + 1;
		if (bNext <= be) bNext = be + 1;
		if (anchor.end1 - anchor.begin1 < ae - as || rc < anchor.count) {
			anchor.found = true;
			anchor.begin1 = as;
			anchor.begin2 = bs;
			anchor.end1 = ae;
			anchor.end2 = be;
			anchor.count = rc;
		}
		if (np === -1) break;
		while (np <= ae) {
			np = next[np]!;
			if (np === -1) return bNext;
		}
		as = np;
	}
	return bNext;
}

/** Scans the region and returns its best anchor. */
function findAnchor(
	a: Int32Array,
	aLo: number,
	aHi: number,
	b: Int32Array,
	bLo: number,
	bHi: number,
	index: Index,
	budget: Budget,
): Anchor {
	scan(a, aLo, aHi, index);
	budget.remaining -= aHi - aLo;
	let anchor: Anchor = {
		found: false,
		hasCommon: false,
		count: MAX_CHAIN_LENGTH + 1,
		begin1: 0,
		end1: 0,
		begin2: 0,
		end2: 0,
	};
	let bPtr = bLo;
	while (bPtr < bHi) bPtr = tryAnchor(a, aLo, aHi, b, bLo, bHi, bPtr, index, anchor, budget);
	return anchor;
}

/**
 * Marks the changed lines of `a[aLo, aHi)` × `b[bLo, bHi)` with histogram alignment. Regions
 * wait on an explicit stack, left half first, so the order of anchors matches git's recursion
 * and the call stack stays flat for any input shape.
 *
 * @param ids How many distinct line ids `a` and `b` use, sizing the per-id scratch space.
 */
export function histogram(
	a: Int32Array,
	aLo: number,
	aHi: number,
	b: Int32Array,
	bLo: number,
	bHi: number,
	ids: number,
	changedA: Uint8Array,
	changedB: Uint8Array,
	budget: Budget,
): void {
	let index: Index = {
		stamp: new Int32Array(ids),
		first: new Int32Array(ids),
		count: new Int32Array(ids),
		next: new Int32Array(a.length),
		serial: 0,
	};
	let seen: Uint8Array | undefined;
	let stack = [aLo, aHi, bLo, bHi];
	while (stack.length > 0) {
		let y1 = stack.pop()!;
		let y0 = stack.pop()!;
		let x1 = stack.pop()!;
		let x0 = stack.pop()!;
		if (x0 === x1 || y0 === y1) {
			markRange(changedA, x0, x1);
			markRange(changedB, y0, y1);
			continue;
		}
		if (budget.remaining <= 0) {
			budget.approximate = true;
			markRange(changedA, x0, x1);
			markRange(changedB, y0, y1);
			continue;
		}
		let anchor = findAnchor(a, x0, x1, b, y0, y1, index, budget);
		if (anchor.hasCommon && anchor.count > MAX_CHAIN_LENGTH) {
			seen ??= new Uint8Array(ids);
			myersDiscarding(a, x0, x1, b, y0, y1, changedA, changedB, budget, seen);
		} else if (anchor.found) {
			stack.push(anchor.end1 + 1, x1, anchor.end2 + 1, y1, x0, anchor.begin1, y0, anchor.begin2);
		} else {
			markRange(changedA, x0, x1);
			markRange(changedB, y0, y1);
		}
	}
}
