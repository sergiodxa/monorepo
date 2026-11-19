/**
 * The three facet definitions a set is built from, and how each reads a record, matches it
 * against a selection and counts it. Each definition owns its query parameters, so parsing,
 * serializing and counting a facet all agree on one spelling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { NumberRange } from "./types.js";

/** Longest single term value a URL may carry; longer text is a malformed link, not a value. */
export const MAX_TERM_LENGTH = 200;

/** How many values one terms facet may select from a URL unless its options say otherwise. */
export const DEFAULT_TERM_LIMIT = 50;

/** Options for a terms facet. */
export interface TermsOptions {
	/** The query parameter the facet reads and writes. @default the facet name */
	param?: string;
	/**
	 * The values the facet accepts, in display order. Declared values are listed even at a
	 * count of 0, and a URL naming any other value fails to parse.
	 */
	values?: readonly string[];
	/** The most values one URL may select. @default 50 */
	limit?: number;
}

/** Options for a range facet. */
export interface RangeOptions {
	/** The parameter holding the inclusive lower end. @default `<name>_min` */
	minParam?: string;
	/** The parameter holding the exclusive upper end. @default `<name>_max` */
	maxParam?: string;
	/**
	 * Ascending bucket edges: `[0, 25, 50]` counts `[0, 25)`, `[25, 50)` and `[50, ∞)`.
	 * A value below the first edge falls in no bucket, so start at the lowest possible value.
	 * @default []
	 */
	buckets?: readonly number[];
}

/** Options for a toggle facet. */
export interface ToggleOptions {
	/** The query parameter the facet reads and writes. @default the facet name */
	param?: string;
}

/** A terms facet as a set stores it. */
export interface TermsEntry<T> {
	kind: "terms";
	name: string;
	param: string;
	values: readonly string[] | null;
	limit: number;
	read(record: T): string | readonly string[] | null | undefined;
}

/** A range facet as a set stores it. */
export interface RangeEntry<T> {
	kind: "range";
	name: string;
	minParam: string;
	maxParam: string;
	buckets: readonly number[];
	read(record: T): number | null | undefined;
}

/** A toggle facet as a set stores it. */
export interface ToggleEntry<T> {
	kind: "toggle";
	name: string;
	param: string;
	read(record: T): boolean;
}

/** Any facet a set stores. */
export type FacetEntry<T> = TermsEntry<T> | RangeEntry<T> | ToggleEntry<T>;

/**
 * Reads a record's terms as a deduplicated list, so a record tagged twice with one value
 * counts once and a missing value counts nowhere.
 */
export function readTerms<T>(entry: TermsEntry<T>, record: T): string[] {
	let raw = entry.read(record);
	if (raw === null || raw === undefined) return [];
	if (typeof raw === "string") return [raw];
	return [...new Set(raw)];
}

/** Whether a selection on this facet narrows the records at all. */
export function isActive(selection: unknown): boolean {
	if (Array.isArray(selection)) return selection.length > 0;
	if (typeof selection === "boolean") return selection;
	if (isRange(selection)) return selection.min !== null || selection.max !== null;
	return false;
}

/** Whether a value has the shape of a range selection. */
export function isRange(value: unknown): value is NumberRange {
	return typeof value === "object" && value !== null && "min" in value && "max" in value;
}

/** Whether a number falls in `[min, max)`, with a `null` end left open. */
export function inRange(value: number, range: NumberRange): boolean {
	if (range.min !== null && value < range.min) return false;
	if (range.max !== null && value >= range.max) return false;
	return true;
}

/**
 * Whether a record passes one facet's selection. Within a terms facet the chosen values are
 * alternatives (any one matches); a range needs a value inside it; a toggle needs `true`.
 */
export function matches<T>(entry: FacetEntry<T>, record: T, selection: unknown): boolean {
	if (!isActive(selection)) return true;
	if (entry.kind === "terms") {
		let chosen = selection as string[];
		return readTerms(entry, record).some((value) => chosen.includes(value));
	}
	if (entry.kind === "range") {
		let value = entry.read(record);
		return (
			typeof value === "number" &&
			Number.isFinite(value) &&
			inRange(value, selection as NumberRange)
		);
	}
	return entry.read(record) === true;
}
