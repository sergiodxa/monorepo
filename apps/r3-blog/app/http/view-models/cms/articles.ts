import { parameterize } from "inflected";

import routes from "~/routes/web";

/**
 * Type contracts for CMS article view-model transformations.
 *
 * These interfaces define the boundary between repositories/controllers
 * and the mapper methods in this module.
 */
export namespace ArticleViewModel {
	/**
	 * Minimal article shape required by the CMS index table.
	 *
	 * `preview` is precomputed by the caller and rendered as-is.
	 */
	export interface SourceIndexItem {
		/** Stable article identifier used for CMS routes. */
		id: string;
		/** Human-readable title shown in index rows. */
		title: string;
		/** Public slug used to build the reader-facing URL. */
		slug: string;
		/** Whether the row should be labeled as preview in CMS. */
		preview: boolean;
	}

	/**
	 * Repository article shape used to prefill the CMS edit form.
	 *
	 * Optional fields are normalized to empty strings by `edit`.
	 */
	export interface SourceEditItem {
		/** Stable article identifier used by update/delete routes. */
		id: string;
		/** Current title, if present in stored metadata. */
		title?: string;
		/** Current public slug, if present in stored metadata. */
		slug?: string;
		/** Locale code used by content rendering and indexing. */
		locale?: string;
		/** Short summary shown in feeds and metadata. */
		excerpt?: string;
		/** Optional canonical URL for SEO de-duplication. */
		canonical_url?: string;
		/** Markdown body content. */
		content?: string;
		/**
		 * Publish timestamp in ISO format or `null`.
		 *
		 * In this app, `null` is treated as published (not preview).
		 */
		published_at: string | null;
	}

	/**
	 * Raw field values posted by the CMS create/edit form.
	 *
	 * Values are still user-facing and may require normalization.
	 */
	export interface SourceFormData {
		/** User-entered title; also used to derive a slug fallback. */
		title: string;
		/** Optional explicit slug override from the editor form. */
		slug?: string;
		/** Locale selected in the CMS form. */
		locale: string;
		/** Optional summary used by cards, feeds, and metadata. */
		excerpt?: string;
		/** Optional canonical URL for cross-posted content. */
		canonical_url?: string;
		/** Markdown body entered in the editor. */
		content: string;
		/**
		 * Optional publish value from date/datetime inputs.
		 *
		 * Empty/invalid values are coerced to `null` by `input`.
		 */
		published_at?: string;
	}

	/**
	 * Input payload for `index`.
	 */
	export interface InputIndex {
		/** Repository-provided rows to map into CMS table entries. */
		items: Array<SourceIndexItem>;
	}

	/**
	 * Input payload for `new`.
	 *
	 * Kept for API symmetry with other mapper methods.
	 */
	export interface InputNew {}

	/**
	 * Input payload for `notFound`.
	 */
	export interface InputNotFound {
		/** Missing article id that triggered the fallback state. */
		id?: string;
	}

	/**
	 * Input payload for `edit`.
	 */
	export interface InputEdit {
		/** Existing article record to convert into editable form values. */
		article: SourceEditItem;
	}

	/**
	 * Input payload for `input`.
	 */
	export interface InputForm {
		/** Raw form data to normalize before persistence. */
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
	 * Maps article summaries into CMS index rows.
	 *
	 * Each row includes both the public article URL and CMS actions.
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
	 * Builds the default state for the "new article" CMS screen.
	 *
	 * The returned payload mirrors the `edit` shape to simplify form reuse.
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
	 * Builds a recoverable "not found" state for the CMS form screen.
	 *
	 * It intentionally returns `mode: "new"` so editors can create a
	 * replacement article without leaving the page.
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
	 * Builds edit-form state from an existing article record.
	 *
	 * Nullable/optional repository fields are converted to string values so
	 * controlled form inputs always receive defined data.
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
	 * Normalizes posted CMS form values into repository input.
	 *
	 * Slugs default to a parameterized title and publish values are coerced
	 * into ISO timestamps (or `null` when absent/invalid).
	 * @param input CMS form payload collected from the request body.
	 * @returns Persistable article metadata plus normalized publish timestamp.
	 */
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

	/**
	 * Converts publish input from HTML form controls into ISO timestamp format.
	 *
	 * Date-only values (`YYYY-MM-DD`) are interpreted as UTC midnight to avoid
	 * locale-dependent shifts. Invalid inputs are treated as unpublished (`null`).
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
	 * Formats a stored publish timestamp for date-input controls.
	 *
	 * Invalid or missing values become an empty string so form fields remain
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
