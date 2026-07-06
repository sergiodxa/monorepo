/**
 * View model for the CMS tutorial screens. It maps repository records into index rows,
 * edit-form state, new-form defaults, and not-found fallbacks, and normalizes submitted
 * form values into repository input, including tag CSV/array parsing and ISO publish-date
 * coercion. It exists to isolate CMS formatting rules from the tutorial controllers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parameterize } from "inflected";

import routes from "~/routes/web";

/**
 * Type contracts used by tutorial CMS view-model builders.
 *
 * Keeps controller/repository payload shapes explicit at the boundary where raw
 * storage/form values are normalized into UI-friendly data.
 */
export namespace TutorialViewModel {
	/**
	 * Raw tutorial list item used to build CMS index rows.
	 *
	 * `tags` may arrive as a CSV string or a pre-split array depending on source.
	 */
	export interface SourceIndexItem {
		id: string;
		title: string;
		slug: string;
		preview: boolean;
		tags?: string | Array<string>;
	}

	/**
	 * Raw tutorial record used to prefill the edit form.
	 *
	 * Optional text fields tolerate partial reads while `published_at` is always
	 * present as a nullable persistence value.
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
	 * Raw form payload submitted by the tutorial CMS screen.
	 *
	 * Values are untrusted strings from form controls and must be normalized
	 * before writing to repositories.
	 */
	export interface SourceFormData {
		title: string;
		slug?: string;
		excerpt: string;
		tags?: string;
		content: string;
		published_at?: string;
	}

	/**
	 * Input for building tutorial index table view data.
	 */
	export interface InputIndex {
		items: Array<SourceIndexItem>;
	}

	/**
	 * Input for building the default "new tutorial" screen state.
	 *
	 * Kept as an object contract for API symmetry with other builders.
	 */
	export interface InputNew {}

	/**
	 * Input for rendering the tutorial-not-found fallback state.
	 *
	 * `id` is optional because missing identifiers are still rendered as a valid
	 * creation screen with contextual messaging.
	 */
	export interface InputNotFound {
		id?: string;
	}

	/**
	 * Input for building an editable tutorial form state.
	 */
	export interface InputEdit {
		tutorial: SourceEditItem;
	}

	/**
	 * Input for converting submitted form values into repository payloads.
	 */
	export interface InputForm {
		data: SourceFormData;
	}
}

/**
 * Normalizes tutorial data between CMS UI screens and repository write models.
 *
 * Methods isolate formatting and coercion rules so controllers can compose
 * predictable view state without re-implementing parsing logic.
 */
export class TutorialViewModel {
	/**
	 * Builds CMS index rows from raw tutorial list items.
	 *
	 * Converts route params into stable links and flattens tags into the single
	 * comma-separated format expected by the table UI.
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
	 * Builds default state for the tutorial creation screen.
	 *
	 * Returns empty string values for every field to keep form controls fully
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
	 * Builds fallback creation state when a requested tutorial is missing.
	 *
	 * Keeps the screen actionable by switching to create mode while preserving a
	 * contextual message that includes the unresolved id when available.
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
	 * Maps a stored tutorial into editable CMS form state.
	 *
	 * Coerces nullable/optional persisted fields into strings so HTML inputs can
	 * render without null checks, including date input formatting.
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
	 * Converts raw tutorial form values into repository write payloads.
	 *
	 * Applies slug fallback generation, tag normalization, and permissive
	 * `published_at` parsing to centralize persistence-facing coercion.
	 * @param input Raw tutorial form data submitted by the CMS screen.
	 * @returns Normalized `published_at` and metadata fields for persistence.
	 */
	static input(input: TutorialViewModel.InputForm) {
		let { data } = input;

		return {
			published_at: this.parsePublishedAt(data.published_at),
			meta: {
				title: data.title,
				slug: data.slug || parameterize(data.title),
				excerpt: data.excerpt,
				tags: this.parseTags(data.tags),
				content: data.content,
			},
		};
	}

	/**
	 * Parses CMS date input into an ISO timestamp or null.
	 *
	 * Plain `YYYY-MM-DD` values are interpreted as midnight UTC to avoid
	 * environment-dependent local timezone shifts.
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
	 * Converts persisted timestamps into `<input type="date">` values.
	 *
	 * Invalid or missing timestamps return an empty string so the form stays in a
	 * valid controlled-input state.
	 */
	private static toDateInputValue(value: string | null): string {
		if (!value) return "";
		let parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return "";
		return parsed.toISOString().slice(0, 10);
	}

	/**
	 * Normalizes tags from CSV or array input into trimmed non-empty tokens.
	 *
	 * Keeps original order and intentionally avoids deduplication so callers can
	 * decide whether repeated tags are meaningful.
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
