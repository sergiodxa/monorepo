import type { Database } from "remix/data-table";

import { Post } from "~/models/post";

export namespace LikePost {
	/**
	 * Metadata stored in a like post.
	 * It captures the title and URL of the linked resource.
	 *
	 * @example
	 * let meta: LikePost.Meta = {
	 * 	title: "Interesting article",
	 * 	url: "https://example.com/article",
	 * };
	 */
	export interface Meta {
		title: string;
		url: string;
	}

	/**
	 * Input used to create a like post record.
	 * It combines shared post creation fields with like metadata.
	 *
	 * @example
	 * let input: LikePost.CreateInput = {
	 * 	authorId: "user_123",
	 * 	meta: {
	 * 		title: "Interesting article",
	 * 		url: "https://example.com/article",
	 * 	},
	 * };
	 */
	export interface CreateInput extends Post.TypedCreateInput<Meta> {}

	/**
	 * Input used to update an existing like post.
	 * It combines shared post update fields with partial like metadata changes.
	 *
	 * @example
	 * let input: LikePost.UpdateInput = {
	 * 	meta: {
	 * 		title: "Updated title",
	 * 	},
	 * };
	 */
	export interface UpdateInput extends Post.TypedUpdateInput<Meta> {}
}

export class LikePost {
	static postType = "like" as const;

	static normalizeUrl(url: string) {
		if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
			return url;
		}

		return `https://${url}`;
	}

	static waybackSnapshotUrl(url: string, created_at: string) {
		let created = new Date(created_at);
		if (Number.isNaN(created.getTime())) return null;

		let date = created
			.toISOString()
			.replaceAll("-", "")
			.replaceAll(":", "")
			.replaceAll(".", "")
			.replace("T", "");

		return `https://web.archive.org/web/${date}/${url}`;
	}

	/**
	 * Returns all like posts.
	 * It delegates retrieval to the shared typed post query helper.
	 *
	 * @param db Database client used to run operations.
	 * @returns List of like posts with like metadata.
	 * @example
	 * let likes = await LikePost.findAll(db);
	 */
	static findAll(db: Database) {
		return Post.findAllForType<typeof this.postType, LikePost.Meta>(db, this.postType);
	}

	static count(db: Database) {
		return Post.countForType(db, this.postType);
	}

	/**
	 * Returns one like post by its unique id.
	 * It keeps metadata typing aligned with the like post type.
	 *
	 * @param db Database client used to run operations.
	 * @param id Post identifier to look up.
	 * @returns Matching like post or null when it does not exist.
	 * @example
	 * let like = await LikePost.findById(db, "post_123");
	 */
	static findById(db: Database, id: string) {
		return Post.findByIdForType<typeof this.postType, LikePost.Meta>(db, this.postType, id);
	}

	/**
	 * Returns like posts authored by a specific user.
	 * It applies the like post type filter before querying by author.
	 *
	 * @param db Database client used to run operations.
	 * @param authorId Author identifier used to filter results.
	 * @returns List of like posts for the given author.
	 * @example
	 * let likes = await LikePost.findByAuthorId(db, "user_123");
	 */
	static findByAuthorId(db: Database, authorId: string) {
		return Post.findByAuthorIdForType<typeof this.postType, LikePost.Meta>(
			db,
			this.postType,
			authorId,
		);
	}

	/**
	 * Creates a new like post.
	 * It persists shared post fields together with typed like metadata.
	 *
	 * @param db Database client used to run operations.
	 * @param input Data required to create the like post.
	 * @returns Newly created like post record.
	 * @example
	 * let like = await LikePost.create(db, {
	 * 	authorId: "user_123",
	 * 	meta: {
	 * 		title: "Interesting article",
	 * 		url: "https://example.com/article",
	 * 	},
	 * });
	 */
	static create(db: Database, input: LikePost.CreateInput) {
		return Post.createForType<typeof this.postType, LikePost.Meta>(db, this.postType, input);
	}

	/**
	 * Updates an existing like post by id.
	 * It applies partial changes while preserving like metadata typing.
	 *
	 * @param db Database client used to run operations.
	 * @param id Post identifier to update.
	 * @param input Data changes to apply.
	 * @returns Updated like post or null when it does not exist.
	 * @example
	 * let like = await LikePost.update(db, "post_123", {
	 * 	meta: { title: "Updated title" },
	 * });
	 */
	static update(db: Database, id: string, input: LikePost.UpdateInput) {
		return Post.updateForType<typeof this.postType, LikePost.Meta>(db, this.postType, id, input);
	}

	/**
	 * Deletes a post record by id.
	 * It removes the stored like post from persistence.
	 *
	 * @param db Database client used to run operations.
	 * @param id Post identifier to remove.
	 * @returns Result of the delete operation.
	 * @example
	 * let deleted = await LikePost.destroy(db, "post_123");
	 */
	static destroy(db: Database, id: string) {
		return Post.destroy(db, id);
	}
}
