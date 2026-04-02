import type { Database } from "remix/data-table";

import { and, eq, inList } from "remix/data-table";

import { postMeta, posts } from "~/app/models";
import { Post } from "~/app/repositories/post";
import { tutorialMetaCodec } from "~/app/repositories/posts/meta-codecs";
import routes from "~/routes";

import { createTypedPostModel } from "./typed-post-model";

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
		href: string;
		label: string;
		reason: string;
	}
}

class TutorialPostBase extends createTypedPostModel<"tutorial", TutorialPost.Meta>(
	"tutorial",
	tutorialMetaCodec,
) {}

export class TutorialPost extends TutorialPostBase {
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
				href: routes.post.href({ postType: "tutorials", postSlug: tutorial.meta.slug }),
				label: tutorial.meta.title,
				reason: `Because both uses ${match}`,
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
