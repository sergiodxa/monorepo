/**
 * Ordering rules and seek predicates for keyset paging.
 *
 * Keyset paging is only correct when the ordering is total, so the ordering is
 * validated before any query runs, and the seek predicate compares every sort key
 * in lexicographic order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { Predicate } from "remix/data-table";

import { failure, success } from "@sdxc/result";

import type { CursorDirection, CursorValue } from "./cursor.js";

import { InvalidCursorError, InvalidOrderingError } from "./errors.js";

/** Sort direction for one keyset ordering column. */
export type OrderDirection = "asc" | "desc";

/**
 * One keyset sort key: a column name and the direction it is read in.
 *
 * The column may be qualified (`"pings.created_at"`); the unqualified segment is
 * what is read off a result row when a cursor is minted.
 */
export type OrderByTuple = readonly [column: string, direction: OrderDirection];

/**
 * A validated sort key paired with the boundary value to seek from.
 *
 * Built only after column and value counts have been checked, so nothing
 * downstream has to cope with a missing value.
 */
export interface SeekKey {
	/** Ordering column name, exactly as the caller spelled it. */
	column: string;
	/** Direction this key is read in, which decides the comparison operator. */
	direction: OrderDirection;
	/** Boundary row's value for this column. */
	value: CursorValue;
}

/**
 * Rejects orderings that cannot page deterministically.
 *
 * A single sort key is refused unless the caller declares it unique, because rows
 * sharing that value would straddle a page boundary and be skipped or served twice.
 *
 * @param orderBy Sort keys, most significant first; the last one is the tiebreaker.
 * @param unique Whether a one-column ordering is already unique, such as a primary key.
 * @returns The same ordering on success, or `InvalidOrderingError` describing the defect.
 * @example
 * validateOrdering([["created_at", "desc"], ["id", "desc"]], false); // success
 */
export function validateOrdering(
	orderBy: readonly OrderByTuple[],
	unique: boolean,
): Result<readonly OrderByTuple[], InvalidOrderingError> {
	if (orderBy.length === 0) {
		return failure(new InvalidOrderingError("at least one sort key is required"));
	}

	let seen = new Set<string>();
	for (let [column] of orderBy) {
		if (column.trim().length === 0) {
			return failure(new InvalidOrderingError("a sort key has an empty column name"));
		}
		if (seen.has(column)) {
			return failure(new InvalidOrderingError(`column "${column}" appears more than once`));
		}
		seen.add(column);
	}

	if (orderBy.length === 1 && !unique) {
		return failure(
			new InvalidOrderingError(
				"a single sort key needs a unique tiebreaker column, or `unique: true` when the column is already unique",
			),
		);
	}

	return success(orderBy);
}

/**
 * Pairs an ordering with a decoded cursor's values, rejecting any mismatch.
 *
 * The cursor names the columns it was minted for, so an ordering change since it
 * was issued is caught here instead of producing a page seeked on the wrong key.
 *
 * @param orderBy The ordering the query will actually run with.
 * @param columns Column names recorded in the cursor.
 * @param values Boundary values recorded in the cursor.
 * @returns Seek keys ready to build a predicate from, or `InvalidCursorError`.
 */
export function zipSeekKeys(
	orderBy: readonly OrderByTuple[],
	columns: readonly string[],
	values: readonly CursorValue[],
): Result<SeekKey[], InvalidCursorError> {
	if (columns.length !== orderBy.length) {
		return failure(new InvalidCursorError("issued for a different ordering"));
	}

	let keys: SeekKey[] = [];

	for (let [index, tuple] of orderBy.entries()) {
		let [column, direction] = tuple;
		if (columns[index] !== column) {
			return failure(new InvalidCursorError("issued for a different ordering"));
		}

		let value = values[index];
		if (value === undefined) {
			return failure(new InvalidCursorError("missing a value for a sort key"));
		}

		keys.push({ column, direction, value });
	}

	return success(keys);
}

/**
 * Builds the strict lexicographic comparison that seeks past a page boundary.
 *
 * Every comparison predicate carries an explicit column and value, keeping a cursor
 * value that contains a dot, like `"a.b"`, safe as a literal in every comparison.
 *
 * @param keys Sort keys paired with the boundary values, most significant first.
 * @param direction Whether to seek forward past the boundary or backward before it.
 * @returns A predicate to add to the caller's query.
 * @example
 * buildSeekPredicate([{ column: "id", direction: "asc", value: 10 }], "after");
 */
export function buildSeekPredicate(
	keys: readonly SeekKey[],
	direction: CursorDirection,
): Predicate {
	let branches: Predicate[] = [];

	for (let [index, key] of keys.entries()) {
		let comparison: Predicate = {
			type: "comparison",
			operator: seekOperator(key.direction, direction),
			column: key.column,
			value: key.value,
			valueType: "value",
		};

		let ties = keys.slice(0, index).map<Predicate>((tie) => ({
			type: "comparison",
			operator: "eq",
			column: tie.column,
			value: tie.value,
			valueType: "value",
		}));

		if (ties.length === 0) branches.push(comparison);
		else branches.push({ type: "logical", operator: "and", predicates: [...ties, comparison] });
	}

	let [only] = branches;
	if (branches.length === 1 && only !== undefined) return only;

	return { type: "logical", operator: "or", predicates: branches };
}

/**
 * Picks the comparison operator for one sort key.
 *
 * Seeking forward means "later in the ordering", which is `>` for an ascending key
 * and `<` for a descending one; seeking backward inverts both.
 */
function seekOperator(key: OrderDirection, seek: CursorDirection): "gt" | "lt" {
	let forward = seek === "after";
	let ascending = key === "asc";
	return forward === ascending ? "gt" : "lt";
}

/**
 * Flips every direction in an ordering.
 *
 * Backward paging runs the query in reverse so the limit keeps the rows nearest the
 * cursor; the caller reverses them again, so a page always reads in requested order.
 *
 * @param orderBy Ordering to invert.
 * @returns A new ordering with each direction flipped.
 */
export function reverseOrdering(orderBy: readonly OrderByTuple[]): OrderByTuple[] {
	return orderBy.map<OrderByTuple>(([column, direction]) => [
		column,
		direction === "asc" ? "desc" : "asc",
	]);
}

/**
 * Reads a sort key's value off a result row.
 *
 * A qualified column, like `"pings.created_at"`, is read under its unqualified name;
 * an unprojected column reads as `undefined`, which fails cursor encoding.
 *
 * @param row A row returned by the query.
 * @param column Ordering column name, qualified or not.
 * @returns The row's value for that column, or `undefined` when it is not projected.
 */
export function readOrderingValue(row: unknown, column: string): unknown {
	if (typeof row !== "object" || row === null) return undefined;

	let record = row as Record<string, unknown>;
	if (column in record) return record[column];

	let segments = column.split(".");
	let unqualified = segments[segments.length - 1];
	if (unqualified !== undefined && unqualified in record) return record[unqualified];

	return undefined;
}
