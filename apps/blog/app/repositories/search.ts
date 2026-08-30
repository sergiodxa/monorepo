/**
 * Cross-type search over the published corpus.
 *
 * Reads each content type through its own repository and matches in memory, the way
 * `Feed` composes the activity list. The corpus is only a few hundred posts and every
 * read here already runs on every page, so this reuses queries proven to work against
 * the app's D1 adapter. The signature is what's meant to last: swapping the internals for
 * an FTS5 index later touches only this file.
 *
 * Only published posts are returned: previews are filtered per-type, glossary filtered
 * here since `GlossaryPost.findAll` returns every row regardless of publish state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { TutorialPost } from "~/app/repositories/posts/tutorial";

/**
 * Type contracts for searching. Type-only, so the runtime logic stays on
 * {@link PostSearch}.
 */
export namespace PostSearch {
	/** The content types a search can reach. */
	export type Kind = "article" | "tutorial" | "glossary";

	/** What a caller is asking for. */
	export interface Options {
		/** Free text matched against titles, excerpts and tags. */
		query: string;
		/** Restricts the search to one type. */
		kind?: Kind;
		/** Restricts the results to posts carrying this tag. */
		tag?: string;
		/** Largest number of results to return. */
		limit?: number;
	}

	/** One hit, shaped for a machine reader. */
	export interface Result {
		kind: Kind;
		title: string;
		slug: string;
		/** The public URL of the post, so a caller can cite what it quotes. */
		url: string;
		excerpt: string | undefined;
		tags: Array<string>;
		/** Publication instant as ISO 8601 when the post has one, or `null` otherwise. */
		publishedAt: string | null;
	}
}

/** Where each kind's pages live, used to build a result's public URL. */
const KIND_PATHS: Record<PostSearch.Kind, string> = {
	article: "/articles",
	tutorial: "/tutorials",
	glossary: "/glossary",
};

/**
 * How a match ranks. A title hit is what somebody meant; an excerpt hit is often
 * incidental, so a post whose title matches sorts above one that merely mentions the term.
 */
const enum Relevance {
	Title = 0,
	Tag = 1,
	Body = 2,
}

/** One hit with the fields sorting needs, before projection. */
interface Candidate {
	result: PostSearch.Result;
	relevance: Relevance;
	timestamp: number;
}

/** Searches the published corpus across content types. */
export class PostSearch {
	/**
	 * Finds published posts matching `query`.
	 *
	 * Matching is a case-insensitive substring over title, excerpt and tags — the fields that
	 * name which post a caller means, far cheaper than scanning full bodies.
	 *
	 * @param db Database connection used to read each content type.
	 * @param options The query, and any narrowing by kind, tag or count.
	 * @returns Hits ordered by where the match landed, then newest first. Empty when the
	 * query is blank, since every post would otherwise match.
	 * @example
	 * let hits = await PostSearch.query(db, { query: "remix", kind: "tutorial", limit: 5 });
	 */
	static async query(db: Database, options: PostSearch.Options): Promise<Array<PostSearch.Result>> {
		let needle = options.query.trim().toLowerCase();
		if (needle === "") return [];

		let limit = options.limit ?? 10;
		if (limit <= 0) return [];

		let candidates = await this.candidates(db, options.kind);
		let tag = options.tag?.trim().toLowerCase();

		let hits: Array<Candidate> = [];
		for (let candidate of candidates) {
			if (tag !== undefined && !candidate.result.tags.some((each) => each.toLowerCase() === tag)) {
				continue;
			}

			let relevance = this.relevanceOf(candidate.result, needle);
			if (relevance === undefined) continue;

			hits.push({ ...candidate, relevance });
		}

		hits.sort((left, right) => {
			if (left.relevance !== right.relevance) return left.relevance - right.relevance;
			return right.timestamp - left.timestamp;
		});

		return hits.slice(0, limit).map((hit) => hit.result);
	}

	/**
	 * Reads every searchable post of the requested kinds.
	 *
	 * @param db Database connection used to read each content type.
	 * @param kind Restricts the read to one type, or reads all three when absent.
	 * @returns Every published post, projected and stamped for sorting.
	 */
	private static async candidates(
		db: Database,
		kind: PostSearch.Kind | undefined,
	): Promise<Array<Candidate>> {
		let wanted = kind ? [kind] : (["article", "tutorial", "glossary"] as const);

		let batches = await Promise.all(
			wanted.map(async (each) => {
				if (each === "article") return this.articles(db);
				if (each === "tutorial") return this.tutorials(db);
				return this.glossary(db);
			}),
		);

		return batches.flat();
	}

	/** Published articles, projected. */
	private static async articles(db: Database): Promise<Array<Candidate>> {
		let articles = await ArticlePost.findAll(db, { includePreview: false });

		return articles.map((article) =>
			this.candidate("article", article, {
				title: article.meta.title,
				slug: article.meta.slug,
				excerpt: article.meta.excerpt,
				tags: [],
			}),
		);
	}

	/** Published tutorials, projected with their tags. */
	private static async tutorials(db: Database): Promise<Array<Candidate>> {
		let tutorials = await TutorialPost.findAll(db, { includePreview: false });

		return tutorials.map((tutorial) =>
			this.candidate("tutorial", tutorial, {
				title: tutorial.meta.title,
				slug: tutorial.meta.slug,
				excerpt: tutorial.meta.excerpt,
				tags: TutorialPost.tags(tutorial.meta.tags),
			}),
		);
	}

	/**
	 * Published glossary entries, projected.
	 *
	 * Filtered here because `GlossaryPost.findAll` returns every row regardless of publish
	 * state; this method keeps only the published ones searchable.
	 */
	private static async glossary(db: Database): Promise<Array<Candidate>> {
		let entries = await GlossaryPost.findAll(db);

		return entries
			.filter((entry) => Post.isPublishedAt(entry.published_at))
			.map((entry) =>
				this.candidate("glossary", entry, {
					title: entry.meta.title ?? entry.meta.term,
					slug: entry.meta.slug,
					excerpt: entry.meta.definition,
					tags: [],
				}),
			);
	}

	/**
	 * Builds one candidate, resolving its URL and its sort timestamp.
	 *
	 * A timestamp that fails to parse sorts as oldest, keeping the post present in results
	 * with its ordering pushed to the end.
	 */
	private static candidate(
		kind: PostSearch.Kind,
		post: { published_at: string | null; created_at: string },
		projection: { title: string; slug: string; excerpt: string | undefined; tags: Array<string> },
	): Candidate {
		let timestamp = Post.timestampFromPublishedOrCreated(post);

		return {
			relevance: Relevance.Body,
			timestamp: Number.isNaN(timestamp) ? 0 : timestamp,
			result: {
				kind,
				title: projection.title,
				slug: projection.slug,
				url: `${KIND_PATHS[kind]}/${projection.slug}`,
				excerpt: projection.excerpt,
				tags: projection.tags,
				publishedAt: Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString(),
			},
		};
	}

	/**
	 * Where a needle matched, or `undefined` when nothing matched.
	 *
	 * @param result The projected post.
	 * @param needle The query, already trimmed and lowercased.
	 */
	private static relevanceOf(result: PostSearch.Result, needle: string): Relevance | undefined {
		if (result.title.toLowerCase().includes(needle)) return Relevance.Title;
		if (result.tags.some((tag) => tag.toLowerCase().includes(needle))) return Relevance.Tag;
		if (result.excerpt?.toLowerCase().includes(needle)) return Relevance.Body;
		return undefined;
	}
}
