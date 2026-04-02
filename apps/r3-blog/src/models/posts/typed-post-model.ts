import type { Database } from "remix/data-table";

import { Post } from "~/models/post";

export function createTypedPostModel<postType extends Post.Type, meta extends object>(
	type: postType,
	codec: Post.MetaCodec<meta>,
) {
	return class TypedPostModel {
		static postType = type;

		static findAll(db: Database) {
			return Post.findAllForType<postType, meta>(db, type, codec);
		}

		static count(db: Database) {
			return Post.countForType(db, type);
		}

		static findById(db: Database, id: string) {
			return Post.findByIdForType<postType, meta>(db, type, id, codec);
		}

		static findBySlug(db: Database, slug: string) {
			return Post.findBySlugForType<postType, meta>(db, type, slug, codec);
		}

		static findByAuthorId(db: Database, authorId: string) {
			return Post.findByAuthorIdForType<postType, meta>(db, type, authorId, codec);
		}

		static create(db: Database, input: Post.TypedCreateInput<meta>) {
			return Post.createForType<postType, meta>(db, type, input, codec);
		}

		static update(db: Database, id: string, input: Post.TypedUpdateInput<meta>) {
			return Post.updateForType<postType, meta>(db, type, id, input, codec);
		}

		static destroy(db: Database, id: string) {
			return Post.destroy(db, id);
		}
	};
}
