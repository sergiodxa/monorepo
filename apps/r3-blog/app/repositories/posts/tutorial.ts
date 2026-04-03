import type { Database } from "remix/data-table";

import { and, eq, inList } from "remix/data-table";

import { Post } from "~/app/repositories/post";
import { postMeta, posts } from "~/database/schema";

export namespace TutorialPost {
	export interface Meta {
		title: string;
		slug: string;
		excerpt: string;
		content: string;
		tags?: string | Array<string>;
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

	export interface RelatedItem {
		slug: string;
		title: string;
		matchedTag: string;
	}
}

let TUTORIAL_META_KEYS = ["title", "slug", "excerpt", "content", "tags"];

function tutorialMetaValue(
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

function parseTags(raw: string | undefined): Array<string> {
	if (!raw) return [];

	try {
		let parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		let tags: Array<string> = [];
		for (let value of parsed) {
			if (typeof value !== "string") continue;
			let normalized = value.trim();
			if (!normalized) continue;
			if (tags.includes(normalized)) continue;
			tags.push(normalized);
		}

		return tags;
	} catch {
		let normalized = raw.trim();
		if (!normalized) return [];
		return [normalized];
	}
}

function serializeTags(input: TutorialPost.Meta["tags"]): string | undefined {
	if (typeof input === "undefined") return undefined;

	let source = Array.isArray(input) ? input : [input];
	let tags: Array<string> = [];

	for (let value of source) {
		if (typeof value !== "string") continue;
		let normalized = value.trim();
		if (!normalized) continue;
		if (tags.includes(normalized)) continue;
		tags.push(normalized);
	}

	if (tags.length === 0) return undefined;

	return JSON.stringify(tags);
}

let tutorialMetaCodec: Post.MetaCodec<TutorialPost.Meta> = {
	serialize(meta) {
		let values = {
			title: meta.title,
			slug: meta.slug,
			excerpt: meta.excerpt,
			content: meta.content,
			tags: serializeTags(meta.tags),
		};

		let rows: Array<{ key: string; value: string }> = [];
		for (let key of TUTORIAL_META_KEYS) {
			let value = values[key as keyof typeof values];
			if (typeof value === "undefined") continue;
			rows.push({ key, value });
		}

		return rows;
	},
	deserialize(rows) {
		let tags = parseTags(tutorialMetaValue(rows, "tags"));
		return {
			title: tutorialMetaValue(rows, "title") ?? "",
			slug: tutorialMetaValue(rows, "slug") ?? "",
			excerpt: tutorialMetaValue(rows, "excerpt") ?? "",
			content: tutorialMetaValue(rows, "content") ?? "",
			tags: tags.length > 0 ? tags : undefined,
		};
	},
};

export class TutorialPost {
	static postType = "tutorial" as const;

	static findAll(db: Database) {
		return Post.findAllForType<"tutorial", TutorialPost.Meta>(db, this.postType, tutorialMetaCodec);
	}

	static count(db: Database) {
		return Post.countForType(db, this.postType);
	}

	static findById(db: Database, id: string) {
		return Post.findByIdForType<"tutorial", TutorialPost.Meta>(
			db,
			this.postType,
			id,
			tutorialMetaCodec,
		);
	}

	static findBySlug(db: Database, slug: string) {
		return Post.findBySlugForType<"tutorial", TutorialPost.Meta>(
			db,
			this.postType,
			slug,
			tutorialMetaCodec,
		);
	}

	static create(db: Database, input: TutorialPost.CreateInput) {
		return Post.createForType<"tutorial", TutorialPost.Meta>(
			db,
			this.postType,
			input,
			tutorialMetaCodec,
		);
	}

	static update(db: Database, id: string, input: TutorialPost.UpdateInput) {
		return Post.updateForType<"tutorial", TutorialPost.Meta>(
			db,
			this.postType,
			id,
			input,
			tutorialMetaCodec,
		);
	}

	static destroy(db: Database, id: string) {
		return Post.destroy(db, id);
	}

	static tags(metaTags: string | string[] | undefined): Array<string> {
		if (Array.isArray(metaTags)) {
			return metaTags.filter((tag): tag is string => typeof tag === "string");
		}

		if (typeof metaTags === "string") return [metaTags];

		return [];
	}

	static async findRelatedByTags(
		db: Database,
		currentPostId: string,
		tags: Array<string>,
		limit = 3,
	): Promise<Array<TutorialPost.RelatedItem>> {
		if (tags.length === 0) return [];

		let tutorials = await this.findAll(db);
		let related: Array<TutorialPost.RelatedItem> = [];

		for (let tutorial of tutorials) {
			if (tutorial.id === currentPostId) continue;

			let tutorialTags = this.tags(tutorial.meta.tags);
			let match = tutorialTags.find((tag) => tags.includes(tag));
			if (!match) continue;

			related.push({
				slug: tutorial.meta.slug,
				title: tutorial.meta.title,
				matchedTag: match,
			});

			if (related.length >= limit) break;
		}

		return related;
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
			.orderBy("posts.created_at", "desc")
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
}
