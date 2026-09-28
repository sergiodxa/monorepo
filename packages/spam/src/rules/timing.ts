/**
 * The timing rule: people take seconds to read and type, and bots post the instant a form loads
 * or replay one captured long ago. It needs a render time the visitor cannot forge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Signal, SpamCheck } from "../check.js";

/**
 * Scores a submission sent too soon after its form rendered, a render time in the future or long
 * past. A submission without `renderedAt` draws nothing.
 *
 * @example timing({ minSeconds: 5 })
 */
export function timing(options: timing.Options = {}): SpamCheck {
	let minSeconds = options.minSeconds ?? 3;
	let maxAgeSeconds = options.maxAgeSeconds ?? 86_400;
	let fastScore = options.fastScore ?? 6;
	let staleScore = options.staleScore ?? 2;

	return {
		name: "timing",
		stage: "local",
		check(submission): Signal[] {
			if (submission.renderedAt === undefined) return [];
			let submittedAt = submission.submittedAt ?? new Date();
			let seconds = (submittedAt.getTime() - submission.renderedAt.getTime()) / 1000;
			if (seconds < 0) {
				return [
					{ check: "timing.future", score: fastScore, detail: "rendered after it was submitted" },
				];
			}
			if (seconds < minSeconds) {
				return [
					{
						check: "timing.fast",
						score: fastScore,
						detail: `submitted ${seconds.toFixed(1)}s after the form rendered`,
					},
				];
			}
			if (seconds > maxAgeSeconds) {
				return [
					{
						check: "timing.stale",
						score: staleScore,
						detail: `submitted ${Math.round(seconds / 3600)}h after the form rendered`,
					},
				];
			}
			return [];
		},
	};
}

/** The options {@link timing} takes. */
export namespace timing {
	/** Limits and weights for the timing rule. */
	export interface Options {
		/** @default 3 */
		minSeconds?: number;
		/** @default 86400 */
		maxAgeSeconds?: number;
		/** Scored for a submission faster than `minSeconds` or rendered in the future. @default 6 */
		fastScore?: number;
		/** Scored for a submission older than `maxAgeSeconds`. @default 2 */
		staleScore?: number;
	}
}
