/**
 * The readers following one feed, a row each keyed by their OIDC subject. Whether anybody
 * is left is the question every unsubscribe and every alarm asks, since it decides whether
 * the feed polls or serves out its grace period.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";

import { subscribers } from "~/database/feed-schema";

/** Who follows the feed, which is all that keeps it polling. */
export const Subscribers = createModel(subscribers, {
	methods: {
		/**
		 * Records `userId` as a follower, keeping the first follow's timestamp. Read before
		 * written: the second follower of a feed is the common case, and it costs a read.
		 */
		async follow(userId: string, now: number): Promise<void> {
			let joined = await this.findBy({ user_id: userId });
			if (joined === null) unwrap(await this.create({ user_id: userId, subscribed_at: now }));
		},

		/** Drops `userId`, in one statement whether or not they were following. */
		async unfollow(userId: string): Promise<void> {
			await this.query().where({ user_id: userId }).delete();
		},

		/** Whether anybody follows the feed, answered from the index's first row. */
		anyone(): Promise<boolean> {
			return this.query().exists();
		},
	},
});

export default Subscribers;
