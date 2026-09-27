/**
 * Validation for the Webmention moderation screen: the queue a moderator is looking at
 * and the decision a moderation form submits for one mention.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, enum_, object } from "remix/data-schema";

/**
 * `approve` and `reject` decide one mention; `allow` also approves every later mention
 * from its source host on arrival, and `block` rejects the host's mentions and drops
 * its future requests.
 */
export const WebmentionDecisionSchema = object({
	decision: enum_(["approve", "reject", "allow", "block"]),
	/** The queue to return to, so moderating keeps the moderator where they were. */
	status: defaulted(enum_(["pending", "approved", "rejected"]), "pending"),
});

/** The queue shown; anything missing or unknown shows what awaits moderation. */
export const WebmentionQueueSchema = object({
	status: defaulted(enum_(["pending", "approved", "rejected"]), "pending"),
});
