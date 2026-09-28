/**
 * The scoring pipeline: runs checks cheapest stage first, adds their signals and maps the total
 * to a verdict. A check that fails or overruns its deadline adds nothing and is reported, so a
 * provider outage lowers the filter's confidence without ever deciding a verdict.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Label, Signal, SpamCheck, Submission } from "./check.js";

import { SpamCheckError } from "./check.js";

/** Scores a submission and forwards moderators' decisions to the checks that learn from them. */
export interface SpamFilter {
	/**
	 * Scores one submission. Local checks run first; when they already reach the spam threshold,
	 * no remote or escalation check runs. Escalation runs only in the unsure band.
	 */
	check(submission: Submission): Promise<SpamFilter.Assessment>;

	/**
	 * Sends a moderator's decision to every check that implements `report`, in parallel.
	 *
	 * @returns The checks whose report failed; empty when every one succeeded
	 */
	report(submission: Submission, label: Label): Promise<SpamFilter.Failure[]>;
}

/** The types a {@link SpamFilter} reads and returns. */
export namespace SpamFilter {
	/** How a filter is built. */
	export interface Options {
		checks: readonly SpamCheck[];
		/**
		 * The totals where a submission becomes `unsure` and `spam`. A total at or above `spam` is
		 * spam, at or above `unsure` is unsure, and anything lower is ham.
		 *
		 * @default { unsure: 5, spam: 10 }
		 */
		thresholds?: Thresholds;
		/**
		 * Milliseconds each remote or escalation check may take before it fails with `timeout`.
		 *
		 * @default 1500
		 */
		timeout?: number;
	}

	/** See {@link Options.thresholds}. */
	export interface Thresholds {
		unsure: number;
		spam: number;
	}

	/** The verdict and every piece of evidence behind it. */
	export interface Assessment {
		verdict: Verdict;
		/** The sum of every signal's score. */
		score: number;
		signals: Signal[];
		/** Checks that ran and failed, so the verdict lacks their evidence. */
		failures: Failure[];
	}

	/** `unsure` is the band a moderator reviews. */
	export type Verdict = "ham" | "unsure" | "spam";

	/** A check that produced no evidence, with the reason. */
	export interface Failure {
		check: string;
		error: SpamCheckError;
	}
}

/** The thresholds a filter uses when none are given. */
export const DEFAULT_THRESHOLDS: SpamFilter.Thresholds = { unsure: 5, spam: 10 };

/** Milliseconds a remote or escalation check gets by default. */
const DEFAULT_TIMEOUT_MS = 1500;

/**
 * Builds a filter over `checks`. Their order within a stage has no effect on the verdict.
 *
 * @example let filter = createSpamFilter({ checks: DEFAULT_RULES });
 */
export function createSpamFilter(options: SpamFilter.Options): SpamFilter {
	let thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
	let timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
	let byStage = (stage: SpamCheck.Stage) => options.checks.filter((c) => c.stage === stage);

	return {
		async check(submission) {
			let signals: Signal[] = [];
			let failures: SpamFilter.Failure[] = [];
			let total = () => signals.reduce((sum, signal) => sum + signal.score, 0);

			for (let check of byStage("local")) {
				let outcome = await runCheck(check, submission, [...signals], undefined);
				if (isFailure(outcome)) failures.push({ check: check.name, error: outcome.error });
				else signals.push(...outcome.data);
			}

			let stages: Array<{ stage: SpamCheck.Stage; runs: (score: number) => boolean }> = [
				{ stage: "remote", runs: (score) => score < thresholds.spam },
				{
					stage: "escalation",
					runs: (score) => score >= thresholds.unsure && score < thresholds.spam,
				},
			];

			for (let { stage, runs } of stages) {
				let earlier = [...signals];
				if (!runs(total())) continue;
				let outcomes = await Promise.all(
					byStage(stage).map(async (check) => ({
						check,
						outcome: await runCheck(check, submission, earlier, timeout),
					})),
				);
				for (let { check, outcome } of outcomes) {
					if (isFailure(outcome)) failures.push({ check: check.name, error: outcome.error });
					else signals.push(...outcome.data);
				}
			}

			let score = total();
			return { verdict: verdictFor(score, thresholds), score, signals, failures };
		},

		async report(submission, label) {
			let outcomes = await Promise.all(
				options.checks.map(async (check) => {
					if (check.report === undefined) return null;
					let report = check.report.bind(check);
					return { check, outcome: await settle(() => report(submission, label)) };
				}),
			);
			return outcomes.flatMap((entry) =>
				entry !== null && isFailure(entry.outcome)
					? [{ check: entry.check.name, error: entry.outcome.error }]
					: [],
			);
		},
	};
}

/**
 * Maps a total onto a verdict. With `unsure` at or above `spam` the unsure band is empty, and
 * every total is either ham or spam.
 */
export function verdictFor(score: number, thresholds: SpamFilter.Thresholds): SpamFilter.Verdict {
	if (score >= thresholds.spam) return "spam";
	if (score >= thresholds.unsure) return "unsure";
	return "ham";
}

/**
 * Runs one check under `timeoutMs`, racing it against the deadline so a check that ignores its
 * signal still yields. A thrown error or rejected promise becomes `unavailable`.
 */
async function runCheck(
	check: SpamCheck,
	submission: Submission,
	earlier: Signal[],
	timeoutMs: number | undefined,
): Promise<Result<Signal[], SpamCheckError>> {
	let controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let deadline = new Promise<Result<Signal[], SpamCheckError>>((resolve) => {
		if (timeoutMs === undefined) return;
		timer = setTimeout(() => {
			controller.abort();
			resolve(failure(new SpamCheckError("timeout", `exceeded ${timeoutMs}ms`)));
		}, timeoutMs);
	});

	let run = settle(async () => {
		let score = earlier.reduce((sum, signal) => sum + signal.score, 0);
		let answer = await check.check(submission, {
			signal: controller.signal,
			score,
			signals: earlier,
		});
		return Array.isArray(answer) ? success(answer) : answer;
	});

	try {
		return await Promise.race([run, deadline]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Calls `work`, turning a throw or rejection into an `unavailable` failure so a third-party
 * check's bug degrades to missing evidence.
 *
 * @template T - The value a successful call carries.
 */
async function settle<T>(
	work: () => Promise<Result<T, SpamCheckError>>,
): Promise<Result<T, SpamCheckError>> {
	try {
		return await work();
	} catch (error) {
		let message = error instanceof Error ? error.message : String(error);
		return failure(new SpamCheckError("unavailable", message));
	}
}
