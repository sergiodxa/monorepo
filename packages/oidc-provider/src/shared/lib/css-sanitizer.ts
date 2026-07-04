/**
 * CSS sanitizer to prevent CSS injection attacks.
 *
 * Dangerous patterns that can be exploited:
 * - url() with external domains (data exfiltration)
 * - expression() (IE-specific JS execution)
 * - -moz-binding (Firefox XBL binding)
 * - behavior: (IE-specific)
 * - @import (loading external stylesheets)
 * - javascript: pseudo-protocol
 */

/**
 * Patterns that are dangerous in custom CSS.
 * These can be used for data exfiltration, XSS, or other attacks.
 */
const DANGEROUS_PATTERNS = [
	/javascript\s*:/gi,
	/expression\s*\(/gi,
	/-moz-binding\s*:/gi,
	/behavior\s*:/gi,
	/@import\s/gi,
	/data\s*:/gi,
	/vbscript\s*:/gi,
];

/**
 * URL patterns that could be used for data exfiltration.
 * Allows relative URLs and same-origin, but blocks external URLs.
 */
const EXTERNAL_URL_PATTERN = /url\s*\(\s*['"]?\s*(https?:\/\/|\/\/)/gi;

/**
 * Sanitizes custom CSS by removing dangerous patterns.
 * @param css - The CSS string to sanitize
 * @returns The sanitized CSS, or null if the CSS is entirely unsafe
 */
export function sanitizeCss(css: string | null | undefined): string | null {
	if (!css) return null;

	let sanitized = css;

	for (let pattern of DANGEROUS_PATTERNS) {
		if (pattern.test(sanitized)) {
			pattern.lastIndex = 0;
			sanitized = sanitized.replace(pattern, "/* removed */");
		}
	}

	if (EXTERNAL_URL_PATTERN.test(sanitized)) {
		EXTERNAL_URL_PATTERN.lastIndex = 0;
		sanitized = sanitized.replace(EXTERNAL_URL_PATTERN, "url(/* external url removed */");
	}

	let trimmed = sanitized
		.replace(/\/\*.*?\*\//g, "")
		.replace(/\s+/g, "")
		.trim();
	if (!trimmed) return null;

	return sanitized;
}

/**
 * Validates that CSS doesn't contain dangerous patterns.
 * @param css - The CSS string to validate
 * @returns True if the CSS is safe, false otherwise
 */
export function isValidCss(css: string | null | undefined): boolean {
	if (!css) return true;

	for (let pattern of DANGEROUS_PATTERNS) {
		if (pattern.test(css)) {
			return false;
		}
	}

	if (EXTERNAL_URL_PATTERN.test(css)) {
		return false;
	}

	return true;
}

/**
 * Error thrown when CSS validation fails.
 */
export class UnsafeCssError extends Error {
	constructor(message = "CSS contains potentially unsafe patterns") {
		super(message);
		this.name = "UnsafeCssError";
	}
}
