import { parameterize } from "inflected";

import routes from "~/routes/web";

export namespace ArticleViewModel {
	export interface SourceIndexItem {
		id: string;
		title: string;
		slug: string;
		preview: boolean;
	}

	export interface SourceEditItem {
		id: string;
		title?: string;
		slug?: string;
		locale?: string;
		excerpt?: string;
		canonical_url?: string;
		content?: string;
		published_at: string | null;
	}

	export interface SourceFormData {
		title: string;
		slug?: string;
		locale: string;
		excerpt?: string;
		canonical_url?: string;
		content: string;
		published_at?: string;
	}

	export interface InputIndex {
		items: Array<SourceIndexItem>;
	}

	export interface InputNew {}

	export interface InputNotFound {
		id?: string;
	}

	export interface InputEdit {
		article: SourceEditItem;
	}

	export interface InputForm {
		data: SourceFormData;
	}
}

export class ArticleViewModel {
	static index(input: ArticleViewModel.InputIndex) {
		return input.items.map((article) => ({
			id: article.id,
			title: article.title,
			publicHref: routes.post.href({ postType: "articles", postSlug: article.slug }),
			preview: article.preview,
			href: routes.cms.articles.edit.href({ id: article.id }),
			deleteAction: routes.cms.articles.destroy.href({ id: article.id }),
		}));
	}

	static new(_input: ArticleViewModel.InputNew) {
		return {
			title: "New Article",
			description: "Write a new article to share your knowledge with the world.",
			mode: "new" as const,
			action: routes.cms.articles.index.href(),
			submitLabel: "Create Article",
			values: {
				title: "",
				slug: "",
				locale: "en",
				excerpt: "",
				canonical_url: "",
				content: "",
				published_at: "",
			},
		};
	}

	static notFound(input: ArticleViewModel.InputNotFound) {
		return {
			title: "Article Not Found",
			description: `Article ${input.id} was not found.`,
			mode: "new" as const,
			action: routes.cms.articles.index.href(),
			submitLabel: "Create Article",
			values: {
				title: "",
				slug: "",
				locale: "en",
				excerpt: "",
				canonical_url: "",
				content: "",
				published_at: "",
			},
		};
	}

	static edit(input: ArticleViewModel.InputEdit) {
		let article = input.article;

		return {
			title: `Edit Article ${article.title ?? ""}`,
			description: `Editing article at ${routes.post.href({ postType: "articles", postSlug: article.slug ?? "" })}.`,
			mode: "edit" as const,
			action: routes.cms.articles.update.href({ id: article.id }),
			submitLabel: "Save Article",
			deleteAction: routes.cms.articles.destroy.href({ id: article.id }),
			values: {
				title: article.title ?? "",
				slug: article.slug ?? "",
				locale: article.locale ?? "en",
				excerpt: article.excerpt ?? "",
				canonical_url: article.canonical_url ?? "",
				content: article.content ?? "",
				published_at: this.toDateInputValue(article.published_at),
			},
		};
	}

	static input(input: ArticleViewModel.InputForm) {
		let { data } = input;

		return {
			published_at: this.parsePublishedAt(data.published_at),
			meta: {
				title: data.title,
				slug: data.slug || parameterize(data.title),
				locale: data.locale,
				excerpt: data.excerpt,
				canonical_url: data.canonical_url,
				content: data.content,
			},
		};
	}

	private static parsePublishedAt(value: string | undefined): string | null {
		if (!value) return null;
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			let parsed = new Date(`${value}T00:00:00.000Z`);
			if (Number.isNaN(parsed.getTime())) return null;
			return parsed.toISOString();
		}
		let parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return null;
		return parsed.toISOString();
	}

	private static toDateInputValue(value: string | null): string {
		if (!value) return "";
		let parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return "";
		return parsed.toISOString().slice(0, 10);
	}
}
