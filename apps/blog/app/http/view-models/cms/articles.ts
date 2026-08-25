/**
 * View model for the CMS article screens. It maps repository records into index rows,
 * edit-form state, new-form defaults, and not-found fallbacks, and normalizes submitted
 * form values into repository input (slug fallback, ISO publish-date parsing). It exists
 * to centralize CMS routing and field coercion so article controllers stay flow-focused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { slugify } from "@pkg/strings";

import routes from "~/routes/web";

/**
 * Payload contracts at the boundary between repositories/controllers and the
 * mapper methods in this module.
 */
export namespace ArticleViewModel {
	/**
	 * Minimal article shape required by the CMS index table.
	 *
	 * `preview` is precomputed by the caller and rendered as-is.
	 */
	export interface SourceIndexItem {
		id: string;
		title: string;
		slug: string;
		preview: boolean;
	}

	/**
	 * Repository article shape used to prefill the CMS edit form.
	 *
	 * Optional fields are normalized to empty strings by `edit`.
	 */
	export interface SourceEditItem {
		id: string;
		title?: string;
		slug?: string;
		locale?: string;
		excerpt?: string;
		canonical_url?: string;
		content?: string;
		/** ISO timestamp, or `null` to mark the article as published. */
		published_at: string | null;
	}

	/**
	 * Raw field values posted by the CMS create/edit form; normalize them with
	 * `input` before persisting.
	 */
	export interface SourceFormData {
		/** Source of the slug fallback when `slug` is omitted. */
		title: string;
		slug?: string;
		locale: string;
		excerpt?: string;
		canonical_url?: string;
		content: string;
		/** Empty or invalid values are coerced to `null` by `input`. */
		published_at?: string;
	}

	/** Input payload for `index`. */
	export interface InputIndex {
		items: Array<SourceIndexItem>;
	}

	/** Empty payload for `new`, kept for symmetry with the other mappers. */
	export interface InputNew {}

	/** Input payload for `notFound`. */
	export interface InputNotFound {
		id?: string;
	}

	/** Input payload for `edit`. */
	export interface InputEdit {
		article: SourceEditItem;
	}

	/** Input payload for `input`. */
	export interface InputForm {
		data: SourceFormData;
	}
}

/**
 * Converts CMS article data into view-state objects and persistence input.
 *
 * Methods keep routing and normalization details centralized so controllers
 * can remain focused on request flow.
 */
export class ArticleViewModel {
	/**
	 * Each row carries the public article URL alongside the CMS edit and delete
	 * actions.
	 * @param input Source items used by the CMS listing screen.
	 * @returns Index rows ready for CMS table rendering.
	 */
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

	/**
	 * Builds the default state for the "new article" CMS screen, in the same
	 * shape as `edit` so one form component serves both.
	 * @param _input Placeholder input to keep a consistent API shape.
	 * @returns New-form metadata, submit target, and empty field values.
	 */
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

	/**
	 * Returns `mode: "new"` so an editor who requested a missing article can
	 * create a replacement in place.
	 * @param input Context used to describe which article was requested.
	 * @returns New-form view model with a not-found description message.
	 */
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

	/**
	 * Nullable and optional repository fields become strings so controlled form
	 * inputs always receive defined values.
	 * @param input Stored article used to prefill form fields.
	 * @returns Edit-form metadata, actions, and normalized form values.
	 */
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

	/**
	 * Slugs default to a slugified title, and publish values become ISO
	 * timestamps or `null`.
	 * @param input CMS form payload collected from the request body.
	 * @returns Persistable article metadata plus normalized publish timestamp.
	 */
	static input(input: ArticleViewModel.InputForm) {
		let { data } = input;

		return {
			published_at: this.parsePublishedAt(data.published_at),
			meta: {
				title: data.title,
				slug: data.slug || slugify(data.title),
				locale: data.locale,
				excerpt: data.excerpt,
				canonical_url: data.canonical_url,
				content: data.content,
			},
		};
	}

	/**
	 * Date-only values (`YYYY-MM-DD`) are read as UTC midnight so stored
	 * timestamps stay stable across locales; invalid input counts as unpublished.
	 * @param value Raw publish input from form data.
	 * @returns ISO timestamp when valid, otherwise `null`.
	 */
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

	/**
	 * Invalid or missing values become an empty string so the date field stays
	 * controlled and editable.
	 * @param value Stored publish timestamp.
	 * @returns `YYYY-MM-DD` for `<input type="date">`, or empty string.
	 */
	private static toDateInputValue(value: string | null): string {
		if (!value) return "";
		let parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return "";
		return parsed.toISOString().slice(0, 10);
	}
}
