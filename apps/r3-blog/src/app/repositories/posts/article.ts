import type { Database } from "remix/data-table";

import { and, eq, inList } from "remix/data-table";

import { postMeta, posts } from "~/app/models";
import { Post } from "~/app/repositories/post";
import { articleMetaCodec } from "~/app/repositories/posts/meta-codecs";

import { createTypedPostModel } from "./typed-post-model";

export namespace ArticlePost {
	export interface Meta {
		slug: string;
		title: string;
		locale: string;
		content: string;
		excerpt?: string;
		canonical_url?: string;
	}

	export interface CreateInput extends Post.TypedCreateInput<Meta> {}

	export interface UpdateInput extends Post.TypedUpdateInput<Meta> {}

	export interface ListItem {
		id: string;
		title: string;
		slug: string;
		created_at: string;
		published_at: string | null;
	}
}

class ArticlePostBase extends createTypedPostModel<"article", ArticlePost.Meta>(
	"article",
	articleMetaCodec,
) {}

export class ArticlePost extends ArticlePostBase {
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
}
