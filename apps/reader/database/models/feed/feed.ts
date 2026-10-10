/**
 * The single row a feed's object is built around: the document's own description, the
 * head its subscribers' cursors move towards, and the WebSub subscription it holds. The
 * object holds exactly one feed, so every member here addresses that one row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { createModel, NotFound } from "@sdxc/data-model";
import { failure, success } from "@sdxc/result";

import type { SelectFeed } from "~/database/feed-schema";

import { feed, HUB_COOLOFF_MS } from "~/database/feed-schema";
import { FEED_ROW_ID } from "~/database/refresh";

/** The hub a subscription is being requested from, with the credentials it is made under. */
export interface PendingHub {
	url: string;
	topic: string;
	/** The shared secret every notification from the hub is signed with. */
	secret: string;
	/** The unguessable half of the callback URL. */
	token: string;
}

/** The feed's single row, which every RPC the object answers reads first. */
export const Feed = createModel(feed, {
	optional: ["head", "failure_count", "hub_state", "hub_notifications", "hub_misses"],

	methods: {
		/** The feed's row, or `null` for an object nothing has subscribed to yet. */
		current(): Promise<SelectFeed | null> {
			return this.findBy({ id: FEED_ROW_ID });
		},

		/**
		 * Writes `values` onto the feed's row in one statement, touching `updated_at` unless
		 * `values` sets it, and fails with `NotFound` while the object holds no feed yet.
		 */
		async change(values: Partial<SelectFeed>): Promise<Result<void, NotFound>> {
			let { affectedRows } = await this.query().where({ id: FEED_ROW_ID }).update(values);
			if (affectedRows === 0) return failure(new NotFound("feed", { id: FEED_ROW_ID }));
			return success(undefined);
		},

		/**
		 * Moves the subscription to `pending` with fresh credentials, which a hub may verify
		 * before the request that asked for it has even returned.
		 */
		async awaitHub(hub: PendingHub, now: number): Promise<Result<void, NotFound>> {
			return await this.change({
				hub_url: hub.url,
				hub_topic: hub.topic,
				hub_state: "pending",
				hub_secret: hub.secret,
				hub_token: hub.token,
				hub_lease_until: null,
				hub_misses: 0,
				updated_at: now,
			});
		},

		/**
		 * Confirms the pending subscription under the lease the hub granted, which is what
		 * decides when it stops delivering and so when the renewal is due.
		 *
		 * @param leaseSeconds - The lease the hub reported, in seconds.
		 */
		async activateHub(leaseSeconds: number, now: number): Promise<Result<void, NotFound>> {
			return await this.change({
				hub_state: "active",
				hub_lease_until: now + leaseSeconds * 1000,
				hub_lease_seconds: leaseSeconds,
				hub_misses: 0,
				updated_at: now,
			});
		},

		/**
		 * Writes the subscription columns back to a state holding no subscription, keeping the
		 * hub the document advertises so a demotion can tell a new one from the old. A `failed`
		 * hub is held off for {@link HUB_COOLOFF_MS}.
		 *
		 * @param hubUrl - The hub the document advertises, or `null` where it advertises none.
		 */
		async clearHub(
			state: "none" | "failed",
			hubUrl: string | null,
			now: number,
		): Promise<Result<void, NotFound>> {
			return await this.change({
				hub_url: hubUrl,
				hub_topic: null,
				hub_state: state,
				hub_secret: null,
				hub_token: null,
				hub_lease_until: state === "failed" ? now + HUB_COOLOFF_MS : null,
				hub_lease_seconds: null,
				hub_misses: 0,
				updated_at: now,
			});
		},
	},
});

export default Feed;
