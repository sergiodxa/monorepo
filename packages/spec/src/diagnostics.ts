/**
 * Result shapes the runner produces and the reporter renders: per-test
 * outcomes and the suite roll-up. Failures travel as structured `SpecError`s
 * (spans, expected/observed, remedies), never as pre-rendered strings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SpecError } from "./errors.js";

/**
 * How one test ended. `flaky` is a pass a retry produced, kept apart from
 * `passed` so retries absorb infrastructure noise without hiding a test on
 * its way to failing permanently.
 */
export type TestStatus = "passed" | "failed" | "skipped" | "flaky";

/** The outcome of executing one test. */
export interface TestResult {
	/** The test's title as written in the spec. */
	title: string;
	/** Path of the file the test lives in. */
	file: string;
	/** Whether every statement held. */
	status: TestStatus;
	/** The failure that ended the test, when it failed. */
	error?: SpecError;
	/**
	 * The failures of the attempts that did not pass, in attempt order. A
	 * `flaky` result keeps them so a retry's success still reports what went
	 * wrong the first time.
	 */
	attempts?: SpecError[];
	/** Why the test was skipped, from the `skip` prefix's optional reason. */
	reason?: string;
	/** Wall-clock duration of the test in milliseconds. */
	durationMs: number;
}

/** The outcome of one `spec run`. */
export interface SuiteResult {
	/** Per-test outcomes in execution order. */
	results: TestResult[];
	/** Count of passed tests. */
	passed: number;
	/** Count of failed tests. */
	failed: number;
	/** Count of tests the `skip` prefix kept from running. */
	skipped: number;
	/** Count of tests that failed at least once and then passed on a retry. */
	flaky: number;
	/** What this run was called, which `--run-id=` replays. */
	runId: string;
	/**
	 * Wall-clock duration of the whole run in milliseconds, from just before
	 * the first test starts to just after the last one finishes. Tracks real
	 * elapsed time at any concurrency, since concurrent {@link TestResult.durationMs} values overlap.
	 */
	wallMs: number;
}

/**
 * Where the reporter writes. The CLI passes stdout/stderr; tests pass a
 * buffer. Product output goes through this sink, never through a logger.
 */
export interface Sink {
	/** Append text verbatim; the reporter controls its own newlines. */
	write(text: string): void;
}
