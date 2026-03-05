/**
 * Shared URI validation utilities for OAuth 2.0 endpoints.
 * Enforces security constraints on redirect URIs, logout URIs, and logo URLs.
 */

/** Allowed URI schemes for production. */
export const ALLOWED_SCHEMES = ["https"];

/** Allowed URI schemes for localhost addresses. */
export const LOCALHOST_SCHEMES = ["http", "https"];

/** Hostnames considered as localhost for development purposes. */
export const LOCALHOST_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** Dangerous schemes that should never be allowed to prevent XSS attacks. */
export const FORBIDDEN_SCHEMES = ["javascript", "data", "vbscript", "file"];

/** Error thrown when a URI is malformed. */
export class InvalidUriError extends Error {
	override name = "InvalidUriError";
	constructor(message: string = "Invalid URI") {
		super(message);
	}
}

/** Error thrown when a URI uses a forbidden or unsafe scheme. */
export class UnsafeSchemeError extends Error {
	override name = "UnsafeSchemeError";
	constructor(scheme: string, context: string = "URI") {
		super(`Unsafe ${context} scheme: ${scheme}. Only HTTPS is allowed (HTTP for localhost).`);
	}
}

interface ValidateSchemeOptions {
	/** Context for error messages (e.g., "redirect URI", "logout URI", "logo URL") */
	context?: string;
}

/**
 * Validates that a URI has a safe scheme.
 * HTTPS is required for production; HTTP is allowed for localhost.
 * Dangerous schemes (javascript:, data:, vbscript:, file:) are rejected to prevent XSS.
 * @param uri - URI to validate
 * @param options - Validation options
 * @throws {InvalidUriError} If URI is malformed
 * @throws {UnsafeSchemeError} If URI uses a forbidden scheme
 */
export function validateScheme(uri: string, options?: ValidateSchemeOptions): void {
	let context = options?.context ?? "URI";

	let parsed: URL;
	try {
		parsed = new URL(uri);
	} catch {
		throw new InvalidUriError(`Invalid ${context} format`);
	}

	let scheme = parsed.protocol.replace(":", "").toLowerCase();

	if (FORBIDDEN_SCHEMES.includes(scheme)) {
		throw new UnsafeSchemeError(scheme, context);
	}

	let hostname = parsed.hostname.toLowerCase();
	let isLocalhost = LOCALHOST_HOSTS.includes(hostname) || hostname.endsWith(".localhost");

	if (isLocalhost) {
		if (!LOCALHOST_SCHEMES.includes(scheme)) {
			throw new UnsafeSchemeError(scheme, context);
		}
	} else {
		if (!ALLOWED_SCHEMES.includes(scheme)) {
			throw new UnsafeSchemeError(scheme, context);
		}
	}
}

/**
 * Checks if a hostname is considered localhost for development purposes.
 * @param hostname - Hostname to check
 * @returns True if the hostname is localhost
 */
export function isLocalhostHost(hostname: string): boolean {
	let normalized = hostname.toLowerCase();
	return LOCALHOST_HOSTS.includes(normalized) || normalized.endsWith(".localhost");
}
