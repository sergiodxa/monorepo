import type { Database } from "remix/data-table";

import { Post } from "~/models/post";

export namespace GlossaryPost {
	/**
	 * Metadata stored in a glossary post.
	 * It defines the term and definition shown on glossary entries.
	 *
	 * @example
	 * let meta: GlossaryPost.Meta = {
	 * 	slug: "http-cache",
	 * 	term: "HTTP Cache",
	 * 	definition: "A mechanism for storing HTTP responses.",
	 * };
	 */
	export interface Meta {
		slug: string;
		term: string;
		title?: string;
		definition: string;
	}

	/**
	 * Input used to create a glossary post record.
	 * It combines shared post creation fields with glossary metadata.
	 *
	 * @example
	 * let input: GlossaryPost.CreateInput = {
	 * 	authorId: "user_123",
	 * 	meta: {
	 * 		slug: "http-cache",
	 * 		term: "HTTP Cache",
	 * 		definition: "A mechanism for storing HTTP responses.",
	 * 	},
	 * };
	 */
	export interface CreateInput extends Post.TypedCreateInput<Meta> {}

	/**
	 * Input used to update an existing glossary post.
	 * It combines shared post update fields with partial glossary metadata changes.
	 *
	 * @example
	 * let input: GlossaryPost.UpdateInput = {
	 * 	meta: {
	 * 		definition: "Updated definition",
	 * 	},
	 * };
	 */
	export interface UpdateInput extends Post.TypedUpdateInput<Meta> {}
}

export class GlossaryPost {
	static postType = "glossary" as const;

	/**
	 * Returns all glossary posts.
	 * It delegates retrieval to the shared typed post query helper.
	 *
	 * @param db Database client used to run operations.
	 * @returns List of glossary posts with glossary metadata.
	 * @example
	 * let terms = await GlossaryPost.findAll(db);
	 */
	static findAll(db: Database) {
		return Post.findAllForType<typeof this.postType, GlossaryPost.Meta>(db, this.postType);
	}

	static count(db: Database) {
		return Post.countForType(db, this.postType);
	}

	/**
	 * Returns one glossary post by its unique id.
	 * It keeps metadata typing aligned with the glossary post type.
	 *
	 * @param db Database client used to run operations.
	 * @param id Post identifier to look up.
	 * @returns Matching glossary post or null when it does not exist.
	 * @example
	 * let term = await GlossaryPost.findById(db, "post_123");
	 */
	static findById(db: Database, id: string) {
		return Post.findByIdForType<typeof this.postType, GlossaryPost.Meta>(db, this.postType, id);
	}

	/**
	 * Returns one glossary post by its slug.
	 * This is useful when resolving glossary routes from URL segments.
	 *
	 * @param db Database client used to run operations.
	 * @param slug Glossary slug to look up.
	 * @returns Matching glossary post or null when it does not exist.
	 * @example
	 * let term = await GlossaryPost.findBySlug(db, "http-cache");
	 */
	static findBySlug(db: Database, slug: string) {
		return Post.findBySlugForType<typeof this.postType, GlossaryPost.Meta>(db, this.postType, slug);
	}

	/**
	 * Returns glossary posts authored by a specific user.
	 * It applies the glossary post type filter before querying by author.
	 *
	 * @param db Database client used to run operations.
	 * @param authorId Author identifier used to filter results.
	 * @returns List of glossary posts for the given author.
	 * @example
	 * let terms = await GlossaryPost.findByAuthorId(db, "user_123");
	 */
	static findByAuthorId(db: Database, authorId: string) {
		return Post.findByAuthorIdForType<typeof this.postType, GlossaryPost.Meta>(
			db,
			this.postType,
			authorId,
		);
	}

	/**
	 * Creates a new glossary post.
	 * It persists shared post fields together with typed glossary metadata.
	 *
	 * @param db Database client used to run operations.
	 * @param input Data required to create the glossary post.
	 * @returns Newly created glossary post record.
	 * @example
	 * let term = await GlossaryPost.create(db, {
	 * 	authorId: "user_123",
	 * 	meta: {
	 * 		slug: "http-cache",
	 * 		term: "HTTP Cache",
	 * 		definition: "A mechanism for storing HTTP responses.",
	 * 	},
	 * });
	 */
	static create(db: Database, input: GlossaryPost.CreateInput) {
		return Post.createForType<typeof this.postType, GlossaryPost.Meta>(db, this.postType, input);
	}

	/**
	 * Updates an existing glossary post by id.
	 * It applies partial changes while preserving glossary metadata typing.
	 *
	 * @param db Database client used to run operations.
	 * @param id Post identifier to update.
	 * @param input Data changes to apply.
	 * @returns Updated glossary post or null when it does not exist.
	 * @example
	 * let term = await GlossaryPost.update(db, "post_123", {
	 * 	meta: { definition: "Updated definition" },
	 * });
	 */
	static update(db: Database, id: string, input: GlossaryPost.UpdateInput) {
		return Post.updateForType<typeof this.postType, GlossaryPost.Meta>(
			db,
			this.postType,
			id,
			input,
		);
	}

	/**
	 * Deletes a post record by id.
	 * It removes the stored glossary post from persistence.
	 *
	 * @param db Database client used to run operations.
	 * @param id Post identifier to remove.
	 * @returns Result of the delete operation.
	 * @example
	 * let deleted = await GlossaryPost.destroy(db, "post_123");
	 */
	static destroy(db: Database, id: string) {
		return Post.destroy(db, id);
	}
}
