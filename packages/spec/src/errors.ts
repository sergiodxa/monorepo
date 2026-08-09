/**
 * The error taxonomy every fallible function in this package returns through
 * `@pkg/result`. Each class carries the structured fields diagnostics need —
 * spans, expected/observed values, denial remedies — so the reporter formats
 * errors without string-parsing them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PermissionKind } from "./permissions";
import type { Span } from "./source";
import type { Value } from "./values";

/**
 * Machine-readable category of a failure, stable across message rewording.
 * Reporters branch on this, never on message text.
 */
export type DiagnosticCode =
	| "parse-error"
	| "load-error"
	| "duplicate-definition"
	| "unknown-name"
	| "ambiguous-name"
	| "expectation-failed"
	| "permission-denied"
	| "tool-error"
	| "workspace-escape"
	| "usage-error";

/** Base class for every failure this package reports as a `Result` error. */
export class SpecError extends Error {
	/** Stable failure category; see {@link DiagnosticCode}. */
	code: DiagnosticCode;
	/** Path of the `.spec` file involved, when the failure has one. */
	file?: string;
	/** Source range of the failing statement, when known. */
	span?: Span;
	/** An actionable suggestion, e.g. the exact `--allow-*` flag to add. */
	remedy?: string;

	/**
	 * @param code - Stable failure category.
	 * @param message - Human-readable one-line description.
	 */
	constructor(code: DiagnosticCode, message: string) {
		super(message);
		this.name = "SpecError";
		this.code = code;
	}
}

/** A lexical or syntactic failure while reading a `.spec` file. */
export class ParseError extends SpecError {
	/**
	 * @param message - What the parser expected and what it found.
	 * @param file - Path of the file being parsed.
	 * @param span - Range of the offending text.
	 */
	constructor(message: string, file?: string, span?: Span) {
		super("parse-error", message);
		this.name = "ParseError";
		this.file = file;
		this.span = span;
	}
}

/**
 * A suite-level failure before any test runs: unreadable directories,
 * duplicate definitions, or a file that failed to parse during loading.
 */
export class LoadError extends SpecError {
	/**
	 * @param code - `"load-error"` or `"duplicate-definition"`.
	 * @param message - What prevented the suite from loading.
	 */
	constructor(code: DiagnosticCode, message: string) {
		super(code, message);
		this.name = "LoadError";
	}
}

/**
 * A name that resolved to nothing (`unknown-name`) or to more than one
 * candidate (`ambiguous-name`). The runtime never guesses; it reports the
 * candidates and asks for a qualified name.
 */
export class ResolutionError extends SpecError {
	/** Fully qualified candidates, populated for ambiguity errors. */
	candidates: string[];

	/**
	 * @param code - `"unknown-name"` or `"ambiguous-name"`.
	 * @param message - The name and, when ambiguous, its candidates.
	 * @param candidates - Fully qualified candidates for ambiguous names.
	 */
	constructor(code: DiagnosticCode, message: string, candidates: string[] = []) {
		super(code, message);
		this.name = "ResolutionError";
		this.candidates = candidates;
	}
}

/** An `expect` that did not hold, carrying both sides for the reporter. */
export class ExpectationError extends SpecError {
	/** The value the specification demanded, when the form has one. */
	expected?: Value;
	/** The value actually observed. */
	observed?: Value;

	/**
	 * @param message - One-line statement of the failed expectation.
	 * @param expected - The demanded value, when applicable.
	 * @param observed - The observed value, when applicable.
	 */
	constructor(message: string, expected?: Value, observed?: Value) {
		super("expectation-failed", message);
		this.name = "ExpectationError";
		this.expected = expected;
		this.observed = observed;
	}
}

/**
 * A capability use the caller never granted. Always names the permission,
 * the attempted resource, and the exact flag that would grant it — the
 * design suite makes this diagnostic quality a requirement, not a nicety.
 */
export class PermissionDeniedError extends SpecError {
	/** Which permission family was required. */
	permission: PermissionKind;
	/** What the spec attempted to reach: an executable, host, variable, path. */
	resource: string;

	/**
	 * @param permission - The required permission family.
	 * @param resource - The attempted resource.
	 * @param remedy - The exact `spec run` flag that would grant it.
	 */
	constructor(permission: PermissionKind, resource: string, remedy: string) {
		super(
			"permission-denied",
			`Permission denied: ${permission}. The spec attempted to reach: ${resource}`,
		);
		this.name = "PermissionDeniedError";
		this.permission = permission;
		this.resource = resource;
		this.remedy = remedy;
	}
}

/** A tool that was reached and ran, but failed on its own terms. */
export class ToolError extends SpecError {
	/**
	 * @param message - The tool's own account of the failure.
	 */
	constructor(message: string) {
		super("tool-error", message);
		this.name = "ToolError";
	}
}

/**
 * A path that would leave the isolated workspace without a host-filesystem
 * grant — reported distinctly from permission denials so traversal attempts
 * are visible as what they are.
 */
export class WorkspaceEscapeError extends SpecError {
	/** The offending path as written in the spec. */
	attemptedPath: string;

	/**
	 * @param attemptedPath - The path as the spec wrote it.
	 */
	constructor(attemptedPath: string) {
		super("workspace-escape", `Path resolves outside the test workspace: ${attemptedPath}`);
		this.name = "WorkspaceEscapeError";
		this.attemptedPath = attemptedPath;
		this.remedy = "spec run --allow-host-fs=<directory>";
	}
}
