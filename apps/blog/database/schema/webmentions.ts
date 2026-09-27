/**
 * Data-table schema for the Webmention tables: the mentions received for each post,
 * keyed by their source/target pair, the per-host moderation policy, and the targets
 * each post has notified, which is what lets a removed link be notified too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { validateTimestamps } from "./validations/timestamps";

/**
 * A received mention and what its source said when last verified. Only an `approved`
 * row renders under its post; `deleted` keeps the pair so a later resend updates it.
 */
export const webmentions = table({
	name: "webmentions",
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
	columns: {
		id: c.text().primaryKey(),
		created_at: c.text(),
		updated_at: c.text(),
		source: c.text(),
		target: c.text(),
		status: c.enum(["pending", "approved", "rejected", "deleted"]),
		kind: c.enum(["reply", "like", "repost", "bookmark", "mention"]),
		url: c.text(),
		author_name: c.text().nullable(),
		author_url: c.text().nullable(),
		author_photo: c.text().nullable(),
		name: c.text().nullable(),
		content_html: c.text().nullable(),
		content_text: c.text().nullable(),
		published_at: c.text().nullable(),
		post_id: c.text().references("posts", "id", "fk_webmentions_post_id").onDelete("cascade"),
	},
	validate({ value }) {
		return validateTimestamps(value, [
			{ name: "created_at", nullable: false },
			{ name: "updated_at", nullable: false },
			{ name: "published_at", nullable: true },
		]);
	},
});

/** Persisted mention row. */
export type SelectWebmention = TableRow<typeof webmentions>;

/**
 * How mentions from one source host are moderated: `allow` approves each verified
 * mention on arrival, `block` drops the host's requests at the endpoint.
 */
export const webmentionDomains = table({
	name: "webmention_domains",
	primaryKey: "host",
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
	columns: {
		host: c.text().primaryKey(),
		created_at: c.text(),
		updated_at: c.text(),
		policy: c.enum(["allow", "block"]),
	},
});

/** Persisted moderation policy row. */
export type SelectWebmentionDomain = TableRow<typeof webmentionDomains>;

/**
 * A target a post notified, and what its endpoint answered. Kept while the post links
 * to it, so an update that drops the link still notifies the target once more.
 */
export const webmentionSends = table({
	name: "webmention_sends",
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
	columns: {
		id: c.text().primaryKey(),
		created_at: c.text(),
		updated_at: c.text(),
		target: c.text(),
		status: c.enum(["sent", "no-endpoint", "failed"]),
		endpoint: c.text().nullable(),
		code: c.integer().nullable(),
		location: c.text().nullable(),
		post_id: c.text().references("posts", "id", "fk_webmention_sends_post_id").onDelete("cascade"),
	},
});

/** Persisted send row. */
export type SelectWebmentionSend = TableRow<typeof webmentionSends>;
