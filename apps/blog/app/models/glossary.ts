/**
 * Glossary entries: a term, an optional alias shown as its title, and a definition, each
 * listed on the glossary page and found by search under either name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { field } from "@sdxc/data-model";

import { Posts } from "./posts";

export const Glossary = Posts.extend("glossary", {
	meta: {
		slug: field.text().required().default(""),
		term: field.text().required().default(""),
		title: field.text(),
		definition: field.text().required().default(""),
	},

	methods: {
		/** Every live entry, newest first by creation. */
		findAll() {
			return this.newest().all();
		},
	},
});

/** A glossary entry, as reads return it. */
export type GlossaryEntry = ModelRow<typeof Glossary>;

export default Glossary;
