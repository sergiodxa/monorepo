/**
 * Faceted filtering over records already in memory: filters parsed from and written to a URL,
 * the matching records, and each facet's counts with the other facets applied. For catalogues
 * and lists small enough to filter in the request rather than in the database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { RangeOptions, TermsOptions, ToggleOptions } from "./facet.js";
export type {
	AppliedFilter,
	BucketCount,
	Counts,
	FacetKind,
	FacetResult,
	FacetShape,
	FacetsOfKind,
	Filters,
	NumberRange,
	RangeCounts,
	TermCount,
	ToggleCount,
} from "./types.js";

export { createFacets, FacetSet } from "./facet-set.js";
