import type { ArticlePost } from "~/app/repositories/posts/article";

import { Post } from "~/app/repositories/post";
import routes from "~/routes/web";

export namespace ArticlesViewModel {
	export interface Item {
		href: string;
		label: string;
		preview: boolean;
	}

	export interface Page {
		items: Array<Item>;
	}
}

export class ArticlesViewModel {
	static index(articles: Array<ArticlePost.ListItem>): ArticlesViewModel.Page {
		let items = articles.map((article) => {
			let href = routes.post.href({ postType: "articles", postSlug: article.slug });
			let isPublished = Post.isPublishedAt(article.published_at);

			return {
				href,
				label: article.title,
				preview: !isPublished,
			};
		});

		return { items };
	}
}
