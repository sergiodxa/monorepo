/**
 * The package entrypoint: `createBackoff` and the schedule it returns, which
 * answers how long to wait after the Nth failure in milliseconds, plus the
 * option shapes a caller builds one from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type {
	Backoff,
	BackoffCurveOptions,
	BackoffOptions,
	BackoffSharedOptions,
	BackoffStepsOptions,
	Jitter,
} from "./backoff.js";

export { createBackoff } from "./backoff.js";
