/**
 * Utilities for handling timestamp conversions.
 *
 * The database stores timestamps as INTEGER (Unix milliseconds), but the application
 * creates them as ISO strings. This module provides utilities to normalize timestamps
 * to ISO strings for API responses.
 */

/**
 * Converts a timestamp value to an ISO string.
 * Handles both integer timestamps (from older records) and ISO strings (from newer records).
 *
 * @param value - A timestamp as either a Unix timestamp (number) or ISO string
 * @returns The timestamp as an ISO 8601 string
 */
export function toIsoString(value: string | number): string {
	if (typeof value === "number") {
		return new Date(value).toISOString();
	}
	return value;
}

/**
 * Converts an optional timestamp value to an ISO string or null.
 * Handles both integer timestamps (from older records) and ISO strings (from newer records).
 *
 * @param value - A timestamp as either a Unix timestamp (number), ISO string, or null/undefined
 * @returns The timestamp as an ISO 8601 string, or null if the input is null/undefined
 */
export function toIsoStringOptional(value: string | number | null | undefined): string | null {
	if (value == null) return null;
	return toIsoString(value);
}
