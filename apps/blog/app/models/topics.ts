/**
 * Topics: saved searches with a title and a Markdown description, each listed on its own page
 * with its own feeds. The query is stored canonical, so one search is one topic, and a kind's
 * built-in topic keeps the slug and query its fixed routes and the registry rely on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { isFailure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v7";
import { fail, inList } from "remix/data-table";

import type { SelectTopic } from "~/database/schema";

import { KINDS, POST_KINDS } from "~/app/models/kinds";
import { PostSearch } from "~/app/models/search";
import { topics } from "~/database/schema";

/** A slug: lowercase words of letters and digits joined by single hyphens. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Whether a slug names a kind's built-in topic, whose page and feeds answer at fixed routes
 * at the root; such a topic keeps its slug and query, and is never deleted.
 *
 * @param slug A topic slug.
 */
export function isBuiltInTopic(slug: string): boolean {
	return KINDS.some((kind) => POST_KINDS[kind].topic === slug);
}

/**
 * The canonical query of the topic listing every post tagged `tag`, or `null` for a tag that
 * cannot be written as a filter value, such as one holding a quote.
 *
 * @param tag A post's tag as stored.
 */
export function tagQuery(tag: string): string | null {
	if (tag.includes('"') || tag.trim() === "") return null;
	let canonical = PostSearch.canonical(`tag:"${tag.trim()}"`);
	return isFailure(canonical) ? null : canonical.data;
}

export const Topics = createModel(topics, {
	optional: ["id", "description"],

	scopes: {
		alphabetical: (query) => query.orderBy("title", "asc").orderBy("slug", "asc"),
	},

	methods: {
		/** Every topic, by title. */
		findAll() {
			return this.alphabetical().all();
		},

		/**
		 * The topic saved for a search, matched by its canonical text, so any spelling of the
		 * search finds it; `null` for a search no topic saves or that cannot run.
		 *
		 * @param text The search as typed.
		 */
		async findByQuery(text: string): Promise<SelectTopic | null> {
			let canonical = PostSearch.canonical(text);
			if (isFailure(canonical)) return null;
			return this.findBy({ query: canonical.data });
		},

		/**
		 * The topics listing exactly one tag's posts, keyed by the tag as given, in one read; a
		 * tag without such a topic is absent from the map.
		 *
		 * @param tags Tags as a post stores them.
		 */
		async findForTags(tags: ReadonlyArray<string>): Promise<Map<string, SelectTopic>> {
			let queries = new Map<string, string>();
			for (let tag of tags) {
				let query = tagQuery(tag);
				if (query !== null) queries.set(tag, query);
			}
			if (queries.size === 0) return new Map();

			let rows = await this.query()
				.where(inList("query", [...new Set(queries.values())]))
				.all();
			let byQuery = new Map(rows.map((row) => [row.query, row]));
			let found = new Map<string, SelectTopic>();
			for (let [tag, query] of queries) {
				let topic = byQuery.get(query);
				if (topic) found.set(tag, topic);
			}
			return found;
		},
	},

	callbacks: {
		/** A topic needs a slug fit for a URL, a title, and a query search can run. */
		async validate(values) {
			if (values.slug !== undefined && !SLUG.test(values.slug)) {
				return fail("Use lowercase letters, digits and single hyphens.", ["slug"]);
			}
			if (values.title !== undefined && values.title.trim() === "") {
				return fail("A topic needs a title.", ["title"]);
			}
			if (values.query !== undefined) {
				let canonical = PostSearch.canonical(values.query);
				if (isFailure(canonical)) {
					return fail(canonical.error.issues[0]?.message ?? "This search cannot run.", ["query"]);
				}
			}
		},

		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? generateUUID(),
				title: values.title.trim(),
				description: values.description ?? "",
				query: canonicalOr(values.query),
			};
		},

		/** A built-in topic keeps its slug and its query; any other change goes through. */
		async beforeUpdate(values, _ctx, before) {
			let query = values.query === undefined ? undefined : canonicalOr(values.query);
			if (isBuiltInTopic(before.slug)) {
				let moved = values.slug !== undefined && values.slug !== before.slug;
				let requeried = query !== undefined && query !== before.query;
				if (moved || requeried) {
					return fail("A kind's topic keeps its slug and query.", [moved ? "slug" : "query"]);
				}
			}
			return {
				...values,
				...(values.title === undefined ? {} : { title: values.title.trim() }),
				...(query === undefined ? {} : { query }),
			};
		},

		/** A kind's topic serves the kind's own page and feeds, so it stays. */
		async beforeDelete(row) {
			if (isBuiltInTopic(row.slug)) return fail("A kind's topic cannot be deleted.");
		},
	},
});

/**
 * A query's canonical text, or the query as given when it cannot run, which `validate` has
 * already refused before any `before*` callback reads it.
 */
function canonicalOr(query: string): string {
	let canonical = PostSearch.canonical(query);
	return isFailure(canonical) ? query : canonical.data;
}

/** A topic, as reads return it. */
export type Topic = ModelRow<typeof Topics>;

export default Topics;
