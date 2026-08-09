/**
 * Result shapes the runner produces and the reporter renders: per-test
 * outcomes and the suite roll-up. Failures travel as structured `SpecError`s
 * (spans, expected/observed, remedies), never as pre-rendered strings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SpecError } from "./errors";

/** How one test ended. */
export type TestStatus = "passed" | "failed";

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
	/**
	 * Wall-clock duration of the whole run in milliseconds: the elapsed time
	 * from just before the first test starts to just after the last one finishes,
	 * spanning sequential and concurrent runs alike. This is deliberately not the
	 * sum of the per-test {@link TestResult.durationMs}: under concurrency those
	 * overlap in time, so their sum overcounts elapsed time. The summary reports
	 * this figure so it tracks real elapsed time at every concurrency.
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
