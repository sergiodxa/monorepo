/**
 * View model for the CMS tutorial screens. It maps repository records into index rows,
 * edit-form state, new-form defaults, and not-found fallbacks, and normalizes submitted
 * form values into repository input, including tag CSV/array parsing and ISO publish-date
 * coercion. It exists to isolate CMS formatting rules from the tutorial controllers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { slugify } from "@sdxc/strings";

import routes from "~/routes/web";

/**
 * Payload contracts at the boundary where raw storage and form values become
 * UI-ready data.
 */
export namespace TutorialViewModel {
	/**
	 * Raw tutorial list item; `tags` may arrive as a CSV string or as a pre-split
	 * array depending on the source.
	 */
	export interface SourceIndexItem {
		id: string;
		title: string;
		slug: string;
		preview: boolean;
		tags?: string | Array<string>;
	}

	/**
	 * Raw tutorial record used to prefill the edit form; text fields tolerate
	 * partial reads, while `published_at` is always present and nullable.
	 */
	export interface SourceEditItem {
		id: string;
		title?: string;
		slug?: string;
		excerpt?: string;
		tags?: string | Array<string>;
		content?: string;
		published_at: string | null;
	}

	/**
	 * Untrusted strings straight from the tutorial CMS form controls; normalize
	 * them before writing to repositories.
	 */
	export interface SourceFormData {
		title: string;
		slug?: string;
		excerpt: string;
		tags?: string;
		content: string;
		published_at?: string;
	}

	/** Input for building tutorial index table view data. */
	export interface InputIndex {
		items: Array<SourceIndexItem>;
	}

	/** Empty payload for `new`, kept for symmetry with the other builders. */
	export interface InputNew {}

	/**
	 * `id` is optional because a missing identifier still renders as a creation
	 * screen with contextual messaging.
	 */
	export interface InputNotFound {
		id?: string;
	}

	/** Input for building an editable tutorial form state. */
	export interface InputEdit {
		tutorial: SourceEditItem;
	}

	/** Input for converting submitted form values into repository payloads. */
	export interface InputForm {
		data: SourceFormData;
	}
}

/**
 * Normalizes tutorial data between CMS screens and repository write models.
 *
 * Formatting and coercion rules live here so every controller composes view
 * state from the same parsing.
 */
export class TutorialViewModel {
	/**
	 * Rows carry stable links plus tags flattened into the comma-separated
	 * string the table UI expects.
	 * @param input Tutorials to display in the index view.
	 * @returns UI-ready rows with links and normalized tags.
	 */
	static index(input: TutorialViewModel.InputIndex) {
		return input.items.map((tutorial) => ({
			id: tutorial.id,
			title: tutorial.title,
			publicHref: routes.post.href({ postType: "tutorials", postSlug: tutorial.slug }),
			preview: tutorial.preview,
			tags: this.parseTags(tutorial.tags).join(", "),
			href: routes.cms.tutorials.edit.href({ id: tutorial.id }),
			deleteAction: routes.cms.tutorials.destroy.href({ id: tutorial.id }),
		}));
	}

	/**
	 * Every field defaults to an empty string so the form controls are fully
	 * controlled from first render.
	 * @param _input Placeholder input for a consistent builder API.
	 * @returns View data for an empty tutorial form.
	 */
	static new(_input: TutorialViewModel.InputNew) {
		return {
			title: "New Tutorial",
			description: "Write a new tutorial to share your knowledge with the world.",
			mode: "new" as const,
			action: routes.cms.tutorials.index.href(),
			submitLabel: "Create Tutorial",
			values: {
				title: "",
				slug: "",
				excerpt: "",
				tags: "",
				content: "",
				published_at: "",
			},
		};
	}

	/**
	 * Switches the screen to create mode so it stays actionable, keeping a
	 * message that names the unresolved id when one is available.
	 * @param input Context for the missing tutorial.
	 * @returns View data with a not-found title/description and empty values.
	 */
	static notFound(input: TutorialViewModel.InputNotFound) {
		return {
			title: "Tutorial Not Found",
			description: `Tutorial ${input.id} was not found.`,
			mode: "new" as const,
			action: routes.cms.tutorials.index.href(),
			submitLabel: "Create Tutorial",
			values: {
				title: "",
				slug: "",
				excerpt: "",
				tags: "",
				content: "",
				published_at: "",
			},
		};
	}

	/**
	 * Nullable and optional persisted fields become strings, dates included, so
	 * every HTML input receives a defined value.
	 * @param input Tutorial data to prefill the edit screen.
	 * @returns View data for tutorial editing and deletion actions.
	 */
	static edit(input: TutorialViewModel.InputEdit) {
		let { tutorial } = input;

		return {
			title: `Edit Tutorial ${tutorial.title ?? ""}`,
			description: `Editing tutorial at ${routes.post.href({ postType: "tutorials", postSlug: tutorial.slug ?? "" })}.`,
			mode: "edit" as const,
			action: routes.cms.tutorials.update.href({ id: tutorial.id }),
			submitLabel: "Save Tutorial",
			deleteAction: routes.cms.tutorials.destroy.href({ id: tutorial.id }),
			values: {
				title: tutorial.title ?? "",
				slug: tutorial.slug ?? "",
				excerpt: tutorial.excerpt ?? "",
				tags: this.parseTags(tutorial.tags).join(", "),
				content: tutorial.content ?? "",
				published_at: this.toDateInputValue(tutorial.published_at),
			},
		};
	}

	/**
	 * Applies the slug fallback, tag normalization, and permissive
	 * `published_at` parsing that persistence expects.
	 * @param input Raw tutorial form data submitted by the CMS screen.
	 * @returns Normalized `published_at` and metadata fields for persistence.
	 */
	static input(input: TutorialViewModel.InputForm) {
		let { data } = input;

		return {
			published_at: this.parsePublishedAt(data.published_at),
			meta: {
				title: data.title,
				slug: data.slug || slugify(data.title),
				excerpt: data.excerpt,
				tags: this.parseTags(data.tags),
				content: data.content,
			},
		};
	}

	/**
	 * Plain `YYYY-MM-DD` values are read as midnight UTC so stored timestamps
	 * stay stable across environments; invalid input counts as unpublished.
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
	 * Invalid or missing timestamps yield an empty string so the date field
	 * stays in a valid controlled-input state.
	 */
	private static toDateInputValue(value: string | null): string {
		if (!value) return "";
		let parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return "";
		return parsed.toISOString().slice(0, 10);
	}

	/**
	 * Accepts CSV or array input and yields trimmed, non-empty tokens in their
	 * original order, repeats included, so callers decide what duplicates mean.
	 */
	private static parseTags(value: string | string[] | undefined) {
		if (!value) return [];
		if (Array.isArray(value)) {
			return value.map((tag) => tag.trim()).filter(Boolean);
		}
		return value
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean);
	}
}
