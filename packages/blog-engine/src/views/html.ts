/**
 * Small server-side HTML helpers. The engine renders pages as HTML strings (no
 * client JS in v1), so escaping untrusted values is the caller's responsibility —
 * use {@link escape} for text and {@link attr} for attribute values.
 */

/** Escapes text for safe interpolation into HTML element content. */
export function escape(value: unknown): string {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/** Escapes a value for use inside a double-quoted HTML attribute. */
export function attr(value: unknown): string {
	return escape(value);
}

/** Joins truthy class names. */
export function classes(...values: Array<string | false | null | undefined>): string {
	return values.filter(Boolean).join(" ");
}
