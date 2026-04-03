import type { Database } from "remix/data-table";

import { and, eq, inList } from "remix/data-table";

import { Post } from "~/app/repositories/post";
import { postMeta, posts } from "~/database/schema";

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

let ARTICLE_META_KEYS = ["slug", "title", "locale", "content", "excerpt", "canonical_url"];

function articleMetaValue(
	rows: Array<{ key: string; value: string; created_at: string; updated_at: string }>,
	key: string,
) {
	let sortedRows = [...rows].sort((a, b) => {
		let keyCompare = String(a.key).localeCompare(String(b.key));
		if (keyCompare !== 0) return keyCompare;

		let updatedCompare = String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
		if (updatedCompare !== 0) return updatedCompare;

		return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
	});

	for (let row of sortedRows) {
		if (row.key === key) return row.value;
	}

	return undefined;
}

let articleMetaCodec: Post.MetaCodec<ArticlePost.Meta> = {
	serialize(meta) {
		let values = {
			slug: meta.slug,
			title: meta.title,
			locale: meta.locale,
			content: meta.content,
			excerpt: meta.excerpt,
			canonical_url: meta.canonical_url,
		};

		let rows: Array<{ key: string; value: string }> = [];
		for (let key of ARTICLE_META_KEYS) {
			let value = values[key as keyof typeof values];
			if (typeof value === "undefined") continue;
			rows.push({ key, value });
		}

		return rows;
	},
	deserialize(rows) {
		return {
			slug: articleMetaValue(rows, "slug") ?? "",
			title: articleMetaValue(rows, "title") ?? "",
			locale: articleMetaValue(rows, "locale") ?? "en",
			content: articleMetaValue(rows, "content") ?? "",
			excerpt: articleMetaValue(rows, "excerpt"),
			canonical_url: articleMetaValue(rows, "canonical_url"),
		};
	},
};

export class ArticlePost {
	static postType = "article" as const;

	static findAll(db: Database) {
		return Post.findAllForType<"article", ArticlePost.Meta>(db, this.postType, articleMetaCodec);
	}

	static count(db: Database) {
		return Post.countForType(db, this.postType);
	}

	static findById(db: Database, id: string) {
		return Post.findByIdForType<"article", ArticlePost.Meta>(
			db,
			this.postType,
			id,
			articleMetaCodec,
		);
	}

	static findBySlug(db: Database, slug: string) {
		return Post.findBySlugForType<"article", ArticlePost.Meta>(
			db,
			this.postType,
			slug,
			articleMetaCodec,
		);
	}

	static create(db: Database, input: ArticlePost.CreateInput) {
		return Post.createForType<"article", ArticlePost.Meta>(
			db,
			this.postType,
			input,
			articleMetaCodec,
		);
	}

	static update(db: Database, id: string, input: ArticlePost.UpdateInput) {
		return Post.updateForType<"article", ArticlePost.Meta>(
			db,
			this.postType,
			id,
			input,
			articleMetaCodec,
		);
	}

	static destroy(db: Database, id: string) {
		return Post.destroy(db, id);
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
}
