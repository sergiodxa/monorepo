/**
 * The catalog's row per feed, as the feed's own object moves it through its life: named
 * once it has read the document, stamped when it publishes, retired when its last reader
 * leaves, revived inside the grace period, and dropped by the purge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";

import { catalogFeeds } from "~/database/catalog-schema";

/**
 * The feeds anybody has ever followed. Each life-cycle write is one statement answering
 * whether a row matched, so a feed the purge already dropped reads as not landed.
 */
export const CatalogFeeds = createModel(catalogFeeds, {
	methods: {
		/** Moves the activity stamp to `at`, which only a poll that stored an item does. */
		async stamp(feedId: string, at: number): Promise<boolean> {
			let { affectedRows } = await this.query()
				.where({ id: feedId })
				.update({ last_active_at: at });
			return affectedRows > 0;
		},

		/** Replaces the address the row was minted with by the title the publisher gave. */
		async rename(feedId: string, title: string): Promise<boolean> {
			let { affectedRows } = await this.query().where({ id: feedId }).update({ title });
			return affectedRows > 0;
		},

		/** Starts the feed's grace period at `at`, keeping its id for a follower inside it. */
		async retire(feedId: string, at: number): Promise<boolean> {
			let { affectedRows } = await this.query().where({ id: feedId }).update({ retired_at: at });
			return affectedRows > 0;
		},

		/** Returns the feed to service, which is safe on a feed that was never retired. */
		async revive(feedId: string): Promise<boolean> {
			let { affectedRows } = await this.query().where({ id: feedId }).update({ retired_at: null });
			return affectedRows > 0;
		},

		/** Drops the row, which only the purge that cleared the feed's object may do. */
		async purge(feedId: string): Promise<boolean> {
			let { affectedRows } = await this.query().where({ id: feedId }).delete();
			return affectedRows > 0;
		},
	},
});

export default CatalogFeeds;
