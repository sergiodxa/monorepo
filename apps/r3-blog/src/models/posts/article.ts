import type { Database } from "remix/data-table";

import { and, eq, inList } from "remix/data-table";

import { Post } from "~/models/post";
import { postMeta, posts } from "~/schema";

export namespace ArticlePost {
	/**
	 * Metadata stored in an article post.
	 * It includes content and optional SEO fields used to render article pages.
	 *
	 * @example
	 * let meta: ArticlePost.Meta = {
	 * 	slug: "my-first-article",
	 * 	title: "My First Article",
	 * 	locale: "en",
	 * 	content: "# Hello world",
	 * 	excerpt: "Intro text",
	 * };
	 */
	export interface Meta {
		slug: string;
		title: string;
		locale: string;
		content: string;
		excerpt?: string;
		canonical_url?: string;
	}

	/**
	 * Input used to create an article post record.
	 * It combines shared post creation fields with article metadata.
	 *
	 * @example
	 * let input: ArticlePost.CreateInput = {
	 * 	authorId: "user_123",
	 * 	meta: {
	 * 		slug: "my-first-article",
	 * 		title: "My First Article",
	 * 		locale: "en",
	 * 		content: "# Hello world",
	 * 	},
	 * };
	 */
	export interface CreateInput extends Post.TypedCreateInput<Meta> {}

	/**
	 * Input used to update an existing article post.
	 * It combines shared post update fields with partial article metadata changes.
	 *
	 * @example
	 * let input: ArticlePost.UpdateInput = {
	 * 	meta: {
	 * 		excerpt: "Updated excerpt",
	 * 	},
	 * };
	 */
	export interface UpdateInput extends Post.TypedUpdateInput<Meta> {}

	export interface ListItem {
		id: string;
		title: string;
		slug: string;
		created_at: string;
		published_at: string | null;
	}
}

export class ArticlePost {
	static postType = "article" as const;

	/**
	 * Returns all article posts.
	 * It delegates retrieval to the shared typed post query helper.
	 *
	 * @param db Database client used to run operations.
	 * @returns List of article posts with article metadata.
	 * @example
	 * let articles = await ArticlePost.findAll(db);
	 */
	static findAll(db: Database) {
		return Post.findAllForType<typeof this.postType, ArticlePost.Meta>(db, this.postType);
	}

	static async listItems(db: Database): Promise<Array<ArticlePost.ListItem>> {
		let rows = await db
			.query(posts)
			.join(postMeta, and(eq(postMeta.post_id, posts.id), inList(postMeta.key, ["title", "slug"])))
			.where({ type: this.postType })
			.select({
				id: posts.id,
				created_at: posts.created_at,
				published_at: posts.published_at,
				meta_key: postMeta.key,
				meta_value: postMeta.value,
			})
			.all();

		let byId = new Map<string, ArticlePost.ListItem>();

		for (let row of rows) {
			let item = byId.get(row.id);

			if (!item) {
				item = {
					id: row.id,
					title: `Article ${row.id}`,
					slug: row.id,
					created_at: row.created_at,
					published_at: row.published_at,
				};
				byId.set(row.id, item);
			}

			if (row.meta_key === "title" && row.meta_value.trim()) item.title = row.meta_value;
			if (row.meta_key === "slug" && row.meta_value.trim()) item.slug = row.meta_value;
		}

		let items = [...byId.values()];

		items.sort((a, b) => {
			let aDate = Date.parse(a.published_at ?? a.created_at);
			let bDate = Date.parse(b.published_at ?? b.created_at);
			return bDate - aDate;
		});

		return items;
	}

	static count(db: Database) {
		return Post.countForType(db, this.postType);
	}

	/**
	 * Returns one article post by its unique id.
	 * It keeps metadata typing aligned with the article post type.
	 *
	 * @param db Database client used to run operations.
	 * @param id Post identifier to look up.
	 * @returns Matching article post or null when it does not exist.
	 * @example
	 * let article = await ArticlePost.findById(db, "post_123");
	 */
	static findById(db: Database, id: string) {
		return Post.findByIdForType<typeof this.postType, ArticlePost.Meta>(db, this.postType, id);
	}

	/**
	 * Returns one article post by its slug.
	 * This is useful when resolving article routes from URL segments.
	 *
	 * @param db Database client used to run operations.
	 * @param slug Article slug to look up.
	 * @returns Matching article post or null when it does not exist.
	 * @example
	 * let article = await ArticlePost.findBySlug(db, "my-first-article");
	 */
	static findBySlug(db: Database, slug: string) {
		return Post.findBySlugForType<typeof this.postType, ArticlePost.Meta>(db, this.postType, slug);
	}

	/**
	 * Returns article posts authored by a specific user.
	 * It applies the article post type filter before querying by author.
	 *
	 * @param db Database client used to run operations.
	 * @param authorId Author identifier used to filter results.
	 * @returns List of article posts for the given author.
	 * @example
	 * let articles = await ArticlePost.findByAuthorId(db, "user_123");
	 */
	static findByAuthorId(db: Database, authorId: string) {
		return Post.findByAuthorIdForType<typeof this.postType, ArticlePost.Meta>(
			db,
			this.postType,
			authorId,
		);
	}

	/**
	 * Creates a new article post.
	 * It persists shared post fields together with typed article metadata.
	 *
	 * @param db Database client used to run operations.
	 * @param input Data required to create the article post.
	 * @returns Newly created article post record.
	 * @example
	 * let article = await ArticlePost.create(db, {
	 * 	authorId: "user_123",
	 * 	meta: {
	 * 		slug: "my-first-article",
	 * 		title: "My First Article",
	 * 		locale: "en",
	 * 		content: "# Hello world",
	 * 	},
	 * });
	 */
	static create(db: Database, input: ArticlePost.CreateInput) {
		return Post.createForType<typeof this.postType, ArticlePost.Meta>(db, this.postType, input);
	}

	/**
	 * Updates an existing article post by id.
	 * It applies partial changes while preserving article metadata typing.
	 *
	 * @param db Database client used to run operations.
	 * @param id Post identifier to update.
	 * @param input Data changes to apply.
	 * @returns Updated article post or null when it does not exist.
	 * @example
	 * let article = await ArticlePost.update(db, "post_123", {
	 * 	meta: { excerpt: "Updated excerpt" },
	 * });
	 */
	static update(db: Database, id: string, input: ArticlePost.UpdateInput) {
		return Post.updateForType<typeof this.postType, ArticlePost.Meta>(db, this.postType, id, input);
	}

	/**
	 * Deletes a post record by id.
	 * It removes the stored article post from persistence.
	 *
	 * @param db Database client used to run operations.
	 * @param id Post identifier to remove.
	 * @returns Result of the delete operation.
	 * @example
	 * let deleted = await ArticlePost.destroy(db, "post_123");
	 */
	static destroy(db: Database, id: string) {
		return Post.destroy(db, id);
	}
}
