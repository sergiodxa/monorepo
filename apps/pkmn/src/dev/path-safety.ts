/**
 * Pure path-safety guard for the dev-tools export action. It validates a caller
 * supplied relative path before any disk write, rejecting traversal (`..`),
 * absolute paths, and anything outside the allow-listed `src/content` and
 * `src/assets` trees so a tool can never overwrite arbitrary files.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, type Result, success } from "@pkg/result";

/**
 * Directory prefixes (relative to the app root) that an export is allowed to
 * write into. A path must live under one of these trees to be accepted.
 */
export const ALLOWED_WRITE_PREFIXES = ["src/content/", "src/assets/"] as const;

/**
 * Machine-readable reason codes describing why a candidate path was rejected.
 * Carried on {@link PathSafetyError} so callers can branch or map to a response
 * without parsing free-form message strings.
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
 * Validates that `candidate` is a safe, allow-listed relative write path.
 *
 * The path must be non-empty, use forward slashes, contain no `..` segment, not
 * be absolute, be already normalized (no `.` or empty segments), and resolve
 * under one of {@link ALLOWED_WRITE_PREFIXES}. On success the path is returned
 * unchanged so callers can pass it straight to a scoped `Bun.write`.
 *
 * @param candidate The raw, untrusted path supplied by an export payload.
 * @returns Success with the validated path, or failure with a {@link PathSafetyError}.
 */
export function validateWritePath(candidate: string): Result<string, PathSafetyError> {
	if (candidate.length === 0) return failure(new PathSafetyError("empty", candidate));

	// Backslashes could smuggle a Windows-style traversal or absolute path past
	// the forward-slash checks below, so reject them outright.
	if (candidate.includes("\\")) return failure(new PathSafetyError("backslash", candidate));

	// POSIX absolute paths and Windows drive letters both escape the app root.
	if (candidate.startsWith("/")) return failure(new PathSafetyError("absolute", candidate));
	if (/^[A-Za-z]:/.test(candidate)) return failure(new PathSafetyError("absolute", candidate));

	let segments = candidate.split("/");

	// A `..` segment climbs out of the allow-listed tree regardless of prefix.
	if (segments.includes("..")) return failure(new PathSafetyError("traversal", candidate));

	// `.` and empty segments (from `//` or a trailing slash) mean the caller sent
	// a non-normalized path; refuse rather than silently normalizing it.
	if (segments.some((segment) => segment === "." || segment === "")) {
		return failure(new PathSafetyError("not-normalized", candidate));
	}

	if (!ALLOWED_WRITE_PREFIXES.some((prefix) => candidate.startsWith(prefix))) {
		return failure(new PathSafetyError("outside-allowlist", candidate));
	}

	return success(candidate);
}
