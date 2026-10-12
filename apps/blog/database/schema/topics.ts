/**
 * Data-table schema for the `topics` table: saved searches with a title and a Markdown
 * description, each served as a page and three feeds. The slug and the canonical query are
 * both unique, so a URL names one topic and one search has one topic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { validateTimestamps } from "./validations/timestamps";

/** A saved search a reader can browse and subscribe to. */
export const topics = table({
	name: "topics",
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
	columns: {
		id: c.text().primaryKey(),
		/** The topic's URL segment, under `/topics/` or, for a kind's topic, at the root. */
		slug: c.text(),
		title: c.text(),
		/** Markdown shown under the title; empty for a topic with nothing to add. */
		description: c.text(),
		/** The search in the canonical form `PostSearch.canonical` writes, unique across topics. */
		query: c.text(),
		created_at: c.text(),
		updated_at: c.text(),
	},
	validate({ value }) {
		return validateTimestamps(value, [
			{ name: "created_at", nullable: false },
			{ name: "updated_at", nullable: false },
		]);
	},
});

/** Persisted topic row. */
export type SelectTopic = TableRow<typeof topics>;
