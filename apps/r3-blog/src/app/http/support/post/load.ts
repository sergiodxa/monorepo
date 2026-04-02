import type { Database } from "remix/data-table";

import { ArticlePost } from "~/app/repositories/posts/article";
import { TutorialPost } from "~/app/repositories/posts/tutorial";

import type { PostType } from "./request";

type ArticleRecord = Awaited<ReturnType<typeof ArticlePost.findBySlug>>;
type TutorialRecord = Awaited<ReturnType<typeof TutorialPost.findBySlug>>;

interface LoadedArticlePost {
	postType: "articles";
	post: NonNullable<ArticleRecord>;
}

interface LoadedTutorialPost {
	postType: "tutorials";
	post: NonNullable<TutorialRecord>;
	tags: Array<string>;
	related: Array<TutorialPost.RelatedItem>;
}

export type LoadedPostByType = LoadedArticlePost | LoadedTutorialPost;

export async function loadPostByType(
	database: Database,
	postType: PostType,
	postSlug: string,
): Promise<LoadedPostByType | null> {
	if (postType === "articles") {
		let post = await ArticlePost.findBySlug(database, postSlug);
		if (!post) return null;

		return {
			postType,
			post,
		};
	}

	let post = await TutorialPost.findBySlug(database, postSlug);
	if (!post) return null;

	let tags = TutorialPost.tags(post.meta.tags);
	let related = await TutorialPost.findRelatedByTags(database, post.id, tags, 3);

	return {
		postType,
		post,
		tags,
		related,
	};
}
