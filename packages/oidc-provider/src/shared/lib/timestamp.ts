/**
 * Utilities for handling timestamp conversions.
 *
 * The database stores timestamps as INTEGER (Unix milliseconds), but the application
 * creates them as ISO strings. This module provides utilities to normalize timestamps
 * to ISO strings for API responses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Handles both integer timestamps (from older records) and ISO strings (from newer records).
 *
 * @param value - A timestamp as either a Unix timestamp (number) or ISO string
 * @returns The timestamp as an ISO 8601 string
 * @example
 * toIsoString(1735689600000); // "2025-01-01T00:00:00.000Z"
 * toIsoString("2025-01-01T00:00:00.000Z"); // unchanged
 */
export function toIsoString(value: string | number): string {
	if (typeof value === "number") {
		return new Date(value).toISOString();
	}
	return value;
}

/**
 * Handles both integer timestamps (from older records) and ISO strings (from newer records).
 *
 * @param value - A timestamp as either a Unix timestamp (number), ISO string, or null/undefined
 * @returns The timestamp as an ISO 8601 string, or null if the input is null/undefined
 */
export function toIsoStringOptional(value: string | number | null | undefined): string | null {
	if (value == null) return null;
	return toIsoString(value);
}
