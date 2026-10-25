/**
 * The archive and page documents a history walk has stored for one feed. Each row makes
 * the next request for its document conditional and keeps the link the walk followed from
 * it, so a retried walk passes over a page answered with 304 without reading it again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";

import type { SelectPage } from "~/database/feed-schema";

import { createModel } from "~/app/models/feed/context";
import { pages } from "~/database/feed-schema";

/** The documents a walk of the feed's history has already stored. */
export const Pages = createModel(pages, {
	methods: {
		/** The stored record of the document at `url`, or `null` for one never stored. */
		at(url: string): Promise<SelectPage | null> {
			return this.findBy({ url });
		},

		/**
		 * Records the document at `page.url` as stored, replacing what an earlier walk wrote
		 * for it in one statement.
		 */
		async record(page: SelectPage): Promise<void> {
			let existing = await this.findBy({ url: page.url });

			if (existing === null) {
				unwrap(await this.create(page));
				return;
			}

			await this.query().where({ url: page.url }).update(page);
		},
	},
});

export default Pages;
