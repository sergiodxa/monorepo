/**
 * Pure path-safety guard for the dev-tools export action. It validates a caller
 * supplied relative path before any disk write, rejecting traversal (`..`),
 * absolute paths, and backslashes so every accepted write lands inside the
 * allow-listed `src/content` and `src/assets` trees.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, type Result, success } from "@sdxc/result";

/**
 * Directory prefixes (relative to the app root) that an export is allowed to
 * write into. A path must live under one of these trees to be accepted.
 */
export const ALLOWED_WRITE_PREFIXES = ["src/content/", "src/assets/"] as const;

/**
 * Machine-readable reason codes describing why a candidate path was rejected.
 * Carried on {@link PathSafetyError} so callers branch or map to a response off a
 * stable code.
 */
export type PathViolation =
	| "empty"
	| "absolute"
	| "traversal"
	| "backslash"
	| "not-normalized"
	| "outside-allowlist";

/**
 * Error returned by {@link validateWritePath} when a candidate path is unsafe.
 * The `violation` discriminant names the specific rule that failed.
 */
export class PathSafetyError extends Error {
	/** The specific safety rule that rejected the path. */
	readonly violation: PathViolation;

	/**
	 * @param violation The rule that rejected the candidate path.
	 * @param candidate The offending path, echoed into the message for logs.
	 */
	constructor(violation: PathViolation, candidate: string) {
		super(`Unsafe write path (${violation}): ${JSON.stringify(candidate)}`);
		this.name = "PathSafetyError";
		this.violation = violation;
	}
}

/**
 * Validates that `candidate` is a relative, normalized, forward-slash path under
 * one of {@link ALLOWED_WRITE_PREFIXES}; backslashes and `..` are rejected so a
 * Windows-style traversal stays caught, and success echoes the path unchanged.
 *
 * @param candidate The raw, untrusted path supplied by an export payload.
 * @returns Success with the validated path, or failure with a {@link PathSafetyError}.
 */
export function validateWritePath(candidate: string): Result<string, PathSafetyError> {
	if (candidate.length === 0) return failure(new PathSafetyError("empty", candidate));

	if (candidate.includes("\\")) return failure(new PathSafetyError("backslash", candidate));

	if (candidate.startsWith("/")) return failure(new PathSafetyError("absolute", candidate));
	if (/^[A-Za-z]:/.test(candidate)) return failure(new PathSafetyError("absolute", candidate));

	let segments = candidate.split("/");

	if (segments.includes("..")) return failure(new PathSafetyError("traversal", candidate));

	if (segments.some((segment) => segment === "." || segment === "")) {
		return failure(new PathSafetyError("not-normalized", candidate));
	}

	if (!ALLOWED_WRITE_PREFIXES.some((prefix) => candidate.startsWith(prefix))) {
		return failure(new PathSafetyError("outside-allowlist", candidate));
	}

	return success(candidate);
}
