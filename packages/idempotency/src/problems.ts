/**
 * The four refusals the draft defines, as entries an app spreads into its own
 * `defineProblems` catalog so each gets a `type` under the app's error reference.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ProblemEntry } from "@sdxc/problem";

/**
 * Problem entries keyed by the builder names the middleware calls. The slugs are the wire
 * contract clients match on, so they stay fixed.
 * @example defineProblems("https://docs.example.com/errors/", { ...IDEMPOTENCY_PROBLEM_ENTRIES })
 */
export const IDEMPOTENCY_PROBLEM_ENTRIES = {
	idempotencyKeyMissing: {
		slug: "idempotency-key-missing",
		status: 400,
		title: "This request requires an Idempotency-Key header",
	},
	idempotencyKeyInvalid: {
		slug: "idempotency-key-invalid",
		status: 400,
		title: "The Idempotency-Key header is not valid",
	},
	idempotencyKeyInUse: {
		slug: "idempotency-key-in-use",
		status: 409,
		title: "A request with this idempotency key is still being processed",
	},
	idempotencyKeyReused: {
		slug: "idempotency-key-reused",
		status: 422,
		title: "This idempotency key was already used for a different request",
	},
} as const satisfies Record<string, ProblemEntry>;
