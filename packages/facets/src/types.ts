/**
 * The shapes a facet set reads and returns: the filters a URL carries, the counts each facet
 * shows beside its options, and the applied filters a chip row lists. Every shape is keyed by
 * facet name, so a typo in a facet name is a type error at the call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** How a facet matches records: by listed values, by a numeric interval, or by a yes/no test. */
export type FacetKind = "terms" | "range" | "toggle";

/** A facet set's facets by name, each mapped to its kind. */
export type FacetShape = Record<string, FacetKind>;

/**
 * A numeric interval with either end open. `min` is inclusive and `max` exclusive, so
 * adjacent buckets never both claim a record sitting on their shared edge.
 */
export interface NumberRange {
	min: number | null;
	max: number | null;
}

/**
 * The selection for every facet: the values chosen on a terms facet (empty when none),
 * the interval on a range facet (both ends `null` when none), and whether a toggle is on.
 */
export type Filters<D extends FacetShape> = {
	[K in keyof D]: D[K] extends "terms" ? string[] : D[K] extends "range" ? NumberRange : boolean;
};

/** One option of a terms facet, counted with every other facet's filter applied. */
export interface TermCount {
	value: string;
	count: number;
	/** Whether the filters choose this value; a chosen value stays listed at a count of 0. */
	selected: boolean;
}

/** One bucket of a range facet: `[min, max)`, where a `null` max is open-ended. */
export interface BucketCount {
	min: number;
	max: number | null;
	count: number;
	/** Whether the range filter is exactly this bucket's interval. */
	selected: boolean;
}

/**
 * A range facet's counts, plus the smallest and largest value among the records the other
 * facets leave, for a slider's bounds; both are `null` when no record carries a value.
 */
export interface RangeCounts {
	min: number | null;
	max: number | null;
	buckets: BucketCount[];
}

/** How many records a toggle would leave on, counted with every other facet applied. */
export interface ToggleCount {
	count: number;
	selected: boolean;
}

/** The counts every facet shows, in the shape its kind calls for. */
export type Counts<D extends FacetShape> = {
	[K in keyof D]: D[K] extends "terms"
		? TermCount[]
		: D[K] extends "range"
			? RangeCounts
			: ToggleCount;
};

/** The records that pass every filter, how many there are, and every facet's counts. */
export interface FacetResult<T, D extends FacetShape> {
	/** The matching records in their input order; sorting and paging stay with the caller. */
	items: T[];
	total: number;
	counts: Counts<D>;
}

/**
 * One filter in effect, for a row of removable chips: a chosen term, a range, or a toggle
 * that is on. `filters` is the full selection with only this one removed, ready to serialize
 * into the chip's link.
 */
export interface AppliedFilter<D extends FacetShape> {
	facet: keyof D & string;
	kind: FacetKind;
	value: string | NumberRange | true;
	filters: Filters<D>;
}

/** The facet names of one kind, such as every terms facet for `toggle()`. */
export type FacetsOfKind<D extends FacetShape, K extends FacetKind> = {
	[N in keyof D]: D[N] extends K ? N : never;
}[keyof D] &
	string;
