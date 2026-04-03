import type { Post } from "~/app/repositories/post";

import routes from "~/routes/web";

export namespace PostRelatedViewModel {
	export interface Item {
		href: string;
		label: string;
		reason: string;
	}

	export interface Page {
		items: Array<Item>;
	}
}

export class PostRelatedViewModel {
	static index(items: Array<Post.RelatedByTypeItem>): PostRelatedViewModel.Page {
		return {
			items: items.map((item) => ({
				href: routes.post.href({ postType: "tutorials", postSlug: item.slug }),
				label: item.title,
				reason: `Because both uses ${item.matchedTag}`,
			})),
		};
	}
}
