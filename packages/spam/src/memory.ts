/**
 * A scriptable check for testing code that uses a spam filter: a test queues the signals or
 * failure the next call answers and asserts on the submissions and reports it received, with no
 * provider involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Label, Signal, SpamCheck, Submission } from "./check.js";

import { SpamCheckError } from "./check.js";

/**
 * Answers each call with the next queued outcome, or with its default signals once the queue is
 * empty. Every call and report is recorded in order.
 *
 * @example let check = new MemoryCheck().failNext("unavailable");
 */
export class MemoryCheck implements SpamCheck {
	readonly name: string;
	readonly stage: SpamCheck.Stage;

	/** Every submission checked, oldest first. */
	readonly calls: Submission[] = [];

	/** Every report received, oldest first. */
	readonly reports: MemoryCheck.Report[] = [];

	#signals: Signal[];
	#queue: Array<Result<Signal[], SpamCheckError>> = [];
	#reportFailure: SpamCheckError | null = null;

	/** @param options - The check's name, stage and default signals */
	constructor(options: MemoryCheck.Options = {}) {
		this.name = options.name ?? "memory";
		this.stage = options.stage ?? "remote";
		this.#signals = options.signals ?? [];
	}

	/** The most recent submission checked, or `undefined` before the first call. */
	get last(): Submission | undefined {
		return this.calls.at(-1);
	}

	/**
	 * Queues the signals the next call answers.
	 *
	 * @returns This check, so calls chain
	 */
	signalNext(signals: Signal[]): this {
		this.#queue.push(success(signals));
		return this;
	}

	/**
	 * Queues a failure for the next call.
	 *
	 * @returns This check, so calls chain
	 */
	failNext(code: SpamCheck.ErrorCode, message?: string): this {
		this.#queue.push(failure(new SpamCheckError(code, message)));
		return this;
	}

	/**
	 * Makes every later report fail with `code` until {@link reset}.
	 *
	 * @returns This check, so calls chain
	 */
	failReports(code: SpamCheck.ErrorCode): this {
		this.#reportFailure = new SpamCheckError(code);
		return this;
	}

	/** Forgets calls, reports, queued outcomes and report failures, keeping the default signals. */
	reset(): void {
		this.calls.length = 0;
		this.reports.length = 0;
		this.#queue = [];
		this.#reportFailure = null;
	}

	/** Records the call and answers the next queued outcome, else the default signals. */
	async check(submission: Submission): Promise<Result<Signal[], SpamCheckError>> {
		this.calls.push(submission);
		return this.#queue.shift() ?? success(this.#signals);
	}

	/** Records the report, failing when {@link failReports} asked it to. */
	async report(submission: Submission, label: Label): Promise<Result<void, SpamCheckError>> {
		this.reports.push({ submission, label });
		return this.#reportFailure === null ? success(undefined) : failure(this.#reportFailure);
	}
}

/** The types a {@link MemoryCheck} takes and records. */
export namespace MemoryCheck {
	/** How a scripted check is built. */
	export interface Options {
		/** @default "memory" */
		name?: string;
		/** @default "remote" */
		stage?: SpamCheck.Stage;
		/** What a call answers when nothing is queued. @default [] */
		signals?: Signal[];
	}

	/** One recorded moderator decision. */
	export interface Report {
		submission: Submission;
		label: Label;
	}
}
