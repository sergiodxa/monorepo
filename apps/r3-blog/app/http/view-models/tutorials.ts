import type { TutorialPost } from "~/app/repositories/posts/tutorial";

import { Post } from "~/app/repositories/post";
import routes from "~/routes/web";

export namespace TutorialsViewModel {
	export interface Item {
		href: string;
		label: string;
		preview: boolean;
	}

	export interface Page {
		items: Array<Item>;
	}
}

export class TutorialsViewModel {
	static index(tutorials: Array<TutorialPost.ListItem>): TutorialsViewModel.Page {
		let items = tutorials.map((tutorial) => {
			let href = routes.post.href({ postType: "tutorials", postSlug: tutorial.slug });
			let isPublished = Post.isPublishedAt(tutorial.published_at);

			return {
				href,
				label: tutorial.title,
				preview: !isPublished,
			};
		});

		return { items };
	}
}
