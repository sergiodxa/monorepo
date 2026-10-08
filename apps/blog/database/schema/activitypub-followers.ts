/**
 * Data-table schema for `activitypub_followers`: the remote actors following a local
 * ActivityPub actor, keyed by the pair so a repeated Follow replaces its row, with the
 * inboxes deliveries go to and the Follow id an Accept echoes and an Undo names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/**
 * One remote actor following one local actor. Only `accepted` rows are listed, counted and
 * delivered to; a `pending` row stays readable so an Undo can still name its Follow.
 */
export const activityPubFollowers = table({
	name: "activitypub_followers",
	primaryKey: ["actor", "id"],
	columns: {
		/** The local actor being followed. */
		actor: c.text(),
		/** The remote actor's id. */
		id: c.text(),
		inbox: c.text(),
		/** Preferred for delivery, so one POST reaches every follower on that server. */
		shared_inbox: c.text().nullable(),
		follow_id: c.text(),
		state: c.enum(["accepted", "pending"]),
		created_at: c.text(),
		updated_at: c.text(),
	},
});

/** Persisted follower row. */
export type SelectActivityPubFollower = TableRow<typeof activityPubFollowers>;
