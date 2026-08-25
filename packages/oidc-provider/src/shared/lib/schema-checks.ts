/**
 * Reusable `remix/data-schema` field checks for input validation.
 *
 * Models and controllers compose these via `pipe()` to enforce lengths, URL,
 * email, and hex-color formats consistently across the provider's schemas.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Check } from "remix/data-schema";

/**
 * Check that a string has a minimum length.
 * @param min - The minimum length
 * @param message - Optional custom error message
 * @returns A Check function for use with pipe()
 * @example
 * s.string().pipe(minLength(1, "Name is required"));
 */
export function minLength(min: number, message?: string): Check<string> {
	return {
		check: (value) => value.length >= min,
		message: message ?? `Must be at least ${min} characters`,
		code: "minLength",
		values: { min },
	};
}

/**
 * Check that a string has a maximum length.
 * @param max - The maximum length
 * @param message - Optional custom error message
 * @returns A Check function for use with pipe()
 */
export function maxLength(max: number, message?: string): Check<string> {
	return {
		check: (value) => value.length <= max,
		message: message ?? `Must be at most ${max} characters`,
		code: "maxLength",
		values: { max },
	};
}

/**
 * Check that a string matches a URL format.
 * @param message - Optional custom error message
 * @returns A Check function for use with pipe()
 */
export function url(message?: string): Check<string> {
	return {
		check: (value) => {
			try {
				new URL(value);
				return true;
			} catch {
				return false;
			}
		},
		message: message ?? "Must be a valid URL",
		code: "url",
	};
}

/**
 * Check that a string matches a URL format with HTTPS only.
 * @param message - Optional custom error message
 * @returns A Check function for use with pipe()
 */
export function httpsUrl(message?: string): Check<string> {
	return {
		check: (value) => {
			try {
				let parsed = new URL(value);
				return parsed.protocol === "https:";
			} catch {
				return false;
			}
		},
		message: message ?? "Must be a valid HTTPS URL",
		code: "httpsUrl",
	};
}

/**
 * Check that a string is a valid email format.
 * @param message - Optional custom error message
 * @returns A Check function for use with pipe()
 */
export function email(message?: string): Check<string> {
	return {
		check: (value) => {
			let parts = value.split("@");
			if (parts.length !== 2) return false;
			let [local, domain] = parts;
			if (!local || !domain) return false;
			if (local.length === 0 || domain.length === 0) return false;
			if (!domain.includes(".")) return false;
			if (value.includes(" ")) return false;
			return true;
		},
		message: message ?? "Must be a valid email address",
		code: "email",
	};
}

/**
 * Check that a string is a valid hex color.
 * Matches #RGB, #RRGGBB, or #RRGGBBAA formats.
 * @param message - Optional custom error message
 * @returns A Check function for use with pipe()
 */
export function hexColor(message?: string): Check<string> {
	return {
		check: (value) => {
			return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value);
		},
		message: message ?? "Must be a valid hex color (e.g. #FF0000)",
		code: "hexColor",
	};
}

/**
 * Common field length limits for validation.
 */
export let LIMITS = {
	/** Short names: client name, resource name, etc. */
	name: { min: 1, max: 100 },
	description: { min: 0, max: 500 },
	url: { min: 1, max: 2048 },
	scope: { min: 1, max: 50 },
	email: { min: 3, max: 254 },
} as const;
