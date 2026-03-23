import type { Database } from "remix/data-table";

import { and, eq, inList } from "remix/data-table";

import { Post } from "~/models/post";
import { postMeta, posts } from "~/schema";

export namespace TutorialPost {
	/**
	 * Metadata stored in a tutorial post.
	 * It includes the route slug and content fields used to render tutorials.
	 *
	 * @example
	 * let meta: TutorialPost.Meta = {
	 * 	title: "Build a blog with React Router",
	 * 	slug: "build-blog-react-router",
	 * 	excerpt: "Step-by-step guide",
	 * 	content: "# Tutorial content",
	 * 	tags: ["react-router", "cloudflare"],
	 * };
	 */
	export interface Meta {
		title: string;
		slug: string;
		excerpt: string;
		content: string;
		tags?: string | Array<string>;
	}

	/**
	 * Input used to create a tutorial post record.
	 * It combines shared post creation fields with tutorial metadata.
	 *
	 * @example
	 * let input: TutorialPost.CreateInput = {
	 * 	authorId: "user_123",
	 * 	meta: {
	 * 		title: "Build a blog with React Router",
	 * 		slug: "build-blog-react-router",
	 * 		excerpt: "Step-by-step guide",
	 * 		content: "# Tutorial content",
	 * 	},
	 * };
	 */
	export interface CreateInput extends Post.TypedCreateInput<Meta> {}

	/**
	 * Input used to update an existing tutorial post.
	 * It combines shared post update fields with partial tutorial metadata changes.
	 *
	 * @example
	 * let input: TutorialPost.UpdateInput = {
	 * 	meta: {
	 * 		excerpt: "Updated summary",
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

export class TutorialPost {
	static postType = "tutorial" as const;

	/**
	 * Returns all tutorial posts.
	 * It delegates retrieval to the shared typed post query helper.
	 *
	 * @param db Database client used to run operations.
	 * @returns List of tutorial posts with tutorial metadata.
	 * @example
	 * let tutorials = await TutorialPost.findAll(db);
	 */
	static findAll(db: Database) {
		return Post.findAllForType<typeof this.postType, TutorialPost.Meta>(db, this.postType);
	}

	static async listItems(db: Database): Promise<Array<TutorialPost.ListItem>> {
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

		let byId = new Map<string, TutorialPost.ListItem>();

		for (let row of rows) {
			let item = byId.get(row.id);

			if (!item) {
				item = {
					id: row.id,
					title: `Tutorial ${row.id}`,
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
	 * Returns one tutorial post by its unique id.
	 * It keeps metadata typing aligned with the tutorial post type.
	 *
	 * @param db Database client used to run operations.
	 * @param id Post identifier to look up.
	 * @returns Matching tutorial post or null when it does not exist.
	 * @example
	 * let tutorial = await TutorialPost.findById(db, "post_123");
	 */
	static findById(db: Database, id: string) {
		return Post.findByIdForType<typeof this.postType, TutorialPost.Meta>(db, this.postType, id);
	}

	/**
	 * Returns one tutorial post by its slug.
	 * This is useful when resolving tutorial routes from URL segments.
	 *
	 * @param db Database client used to run operations.
	 * @param slug Tutorial slug to look up.
	 * @returns Matching tutorial post or null when it does not exist.
	 * @example
	 * let tutorial = await TutorialPost.findBySlug(db, "build-blog-react-router");
	 */
	static findBySlug(db: Database, slug: string) {
		return Post.findBySlugForType<typeof this.postType, TutorialPost.Meta>(db, this.postType, slug);
	}

	/**
	 * Returns tutorial posts authored by a specific user.
	 * It applies the tutorial post type filter before querying by author.
	 *
	 * @param db Database client used to run operations.
	 * @param authorId Author identifier used to filter results.
	 * @returns List of tutorial posts for the given author.
	 * @example
	 * let tutorials = await TutorialPost.findByAuthorId(db, "user_123");
	 */
	static findByAuthorId(db: Database, authorId: string) {
		return Post.findByAuthorIdForType<typeof this.postType, TutorialPost.Meta>(
			db,
			this.postType,
			authorId,
		);
	}

	/**
	 * Creates a new tutorial post.
	 * It persists shared post fields together with typed tutorial metadata.
	 *
	 * @param db Database client used to run operations.
	 * @param input Data required to create the tutorial post.
	 * @returns Newly created tutorial post record.
	 * @example
	 * let tutorial = await TutorialPost.create(db, {
	 * 	authorId: "user_123",
	 * 	meta: {
	 * 		title: "Build a blog with React Router",
	 * 		slug: "build-blog-react-router",
	 * 		excerpt: "Step-by-step guide",
	 * 		content: "# Tutorial content",
	 * 	},
	 * });
	 */
	static create(db: Database, input: TutorialPost.CreateInput) {
		return Post.createForType<typeof this.postType, TutorialPost.Meta>(db, this.postType, input);
	}

	/**
	 * Updates an existing tutorial post by id.
	 * It applies partial changes while preserving tutorial metadata typing.
	 *
	 * @param db Database client used to run operations.
	 * @param id Post identifier to update.
	 * @param input Data changes to apply.
	 * @returns Updated tutorial post or null when it does not exist.
	 * @example
	 * let tutorial = await TutorialPost.update(db, "post_123", {
	 * 	meta: { excerpt: "Updated summary" },
	 * });
	 */
	static update(db: Database, id: string, input: TutorialPost.UpdateInput) {
		return Post.updateForType<typeof this.postType, TutorialPost.Meta>(
			db,
			this.postType,
			id,
			input,
		);
	}

	/**
	 * Deletes a post record by id.
	 * It removes the stored tutorial post from persistence.
	 *
	 * @param db Database client used to run operations.
	 * @param id Post identifier to remove.
	 * @returns Result of the delete operation.
	 * @example
	 * let deleted = await TutorialPost.destroy(db, "post_123");
	 */
	static destroy(db: Database, id: string) {
		return Post.destroy(db, id);
	}
}
