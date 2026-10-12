/**
 * Whether writing more subjects into a tenant's own object would push its
 * storage past a ceiling set below the platform's hard limit, so an import can
 * be refused before it starts rather than discovered partway through one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Row writes one imported subject costs: the subject itself, its identifiers,
 * its password when one came, and its declared attributes.
 */
const ROWS_PER_SUBJECT = 5;

/**
 * Bytes one row is assumed to occupy when no measured average is supplied — a
 * small multiple of the handful of short TEXT and INTEGER columns most of this
 * object's tables carry, picked generous enough that the estimate errs toward
 * refusing a run rather than admitting one that does not fit.
 */
const DEFAULT_AVERAGE_ROW_BYTES = 256;

/**
 * A SQLite-backed Durable Object's storage is capped at 10 GB by the platform
 * itself. That figure is general platform knowledge rather than something
 * found in this repository's own vendored documentation, which covers library
 * APIs rather than the hosting platform's own service limits.
 */
const HARD_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;

/**
 * The ceiling this module actually checks against: 80% of the hard limit
 * above, leaving headroom for the object's own already-written data and for
 * the row-size estimate below being wrong in either direction.
 */
const STORAGE_CEILING_BYTES = HARD_STORAGE_LIMIT_BYTES * 0.8;

/** What {@link projectsWithinStorageCeiling} projects a run's storage cost from. */
export interface ProjectStorageCeilingInput {
	/** The object's own measured size, read fresh before a run starts. */
	currentDatabaseSize: number;
	/** How many subjects the run is about to write. */
	estimatedRows: number;
	/** A measured average row size, when one is available; a reasoned default otherwise. */
	averageRowBytes?: number;
}

/**
 * Estimates whether importing `estimatedRows` more subjects would push
 * `currentDatabaseSize` past the ceiling, so a run can be refused upfront.
 *
 * @param input - The object's current size, how many subjects the run adds,
 * and an optional measured row size.
 * @returns Whether the projected size stays within the ceiling.
 * @example
 * projectsWithinStorageCeiling({ currentDatabaseSize: 0, estimatedRows: 1000 }); // true
 */
export function projectsWithinStorageCeiling(input: ProjectStorageCeilingInput): boolean {
	let averageRowBytes = input.averageRowBytes ?? DEFAULT_AVERAGE_ROW_BYTES;
	let projectedBytes =
		input.currentDatabaseSize + input.estimatedRows * ROWS_PER_SUBJECT * averageRowBytes;

	return projectedBytes <= STORAGE_CEILING_BYTES;
}
