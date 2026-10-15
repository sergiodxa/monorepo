/**
 * View model for the CMS tutorial screens. It maps repository records into index rows,
 * edit-form state, new-form defaults, and not-found fallbacks, and normalizes submitted
 * form values into repository input, including tag CSV/array parsing and ISO publish-date
 * coercion. It exists to isolate CMS formatting rules from the tutorial controllers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseDate, toDayKey } from "@sdxc/dates";
import { isFailure } from "@sdxc/result";
import { slugify } from "@sdxc/strings";

import { serializeTags } from "~/app/models/post-values";
import { postIntent } from "~/app/services/share";
import { permalink } from "~/app/services/webmention";
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
		teaser?: string;
		excerpt?: string;
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
		teaser?: string;
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
		teaser?: string;
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

	/** Input payload for `rejected`: the submission, and the tutorial it edits, if any. */
	export interface InputRejected {
		id?: string;
		data: SourceFormData;
		/** Why the save was refused, shown under the teaser. */
		teaserError: string;
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
	 * Rows carry stable links, the "Post on X" link, and tags flattened into the
	 * comma-separated string the table UI expects.
	 * @param input Tutorials to display in the index view.
	 * @returns UI-ready rows with links and normalized tags.
	 */
	static index(input: TutorialViewModel.InputIndex) {
		return input.items.map((tutorial) => ({
			id: tutorial.id,
			title: tutorial.title,
			publicHref: routes.post.href({ postType: "tutorials", postSlug: tutorial.slug }),
			shareHref: this.shareHref(tutorial),
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
				teaser: "",
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
				teaser: "",
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
			description: "Editing tutorial at",
			publicHref: routes.post.href({ postType: "tutorials", postSlug: tutorial.slug ?? "" }),
			mode: "edit" as const,
			action: routes.cms.tutorials.update.href({ id: tutorial.id }),
			submitLabel: "Save Tutorial",
			deleteAction: routes.cms.tutorials.destroy.href({ id: tutorial.id }),
			shareHref: this.shareHref({
				title: tutorial.title ?? "",
				slug: tutorial.slug ?? "",
				teaser: tutorial.teaser,
				excerpt: tutorial.excerpt,
			}),
			values: {
				title: tutorial.title ?? "",
				slug: tutorial.slug ?? "",
				excerpt: tutorial.excerpt ?? "",
				teaser: tutorial.teaser ?? "",
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
				teaser: data.teaser,
				tags: serializeTags(this.parseTags(data.tags)),
				content: data.content,
			},
		};
	}

	/**
	 * The form as submitted, with the reason the save was refused, so the editor fixes the
	 * teaser without retyping anything. It edits `id` when given, else creates.
	 * @param input The submitted values, the edited tutorial's id, and the error.
	 * @returns Form state matching `edit` or `new`, without a "Post on X" link until a save.
	 */
	static rejected(input: TutorialViewModel.InputRejected) {
		let { data, id } = input;
		let action = id ? routes.cms.tutorials.update.href({ id }) : routes.cms.tutorials.index.href();

		return {
			title: id ? `Edit Tutorial ${data.title}` : "New Tutorial",
			description: "The tutorial was not saved.",
			mode: id ? ("edit" as const) : ("new" as const),
			action,
			submitLabel: id ? "Save Tutorial" : "Create Tutorial",
			deleteAction: id ? routes.cms.tutorials.destroy.href({ id }) : undefined,
			teaserError: input.teaserError,
			values: {
				title: data.title,
				slug: data.slug ?? "",
				excerpt: data.excerpt,
				teaser: data.teaser ?? "",
				tags: data.tags ?? "",
				content: data.content,
				published_at: data.published_at ?? "",
			},
		};
	}

	/**
	 * The author's "Post on X" link for a saved tutorial, read at its canonical permalink.
	 * @param tutorial The stored title, slug, teaser and excerpt.
	 */
	private static shareHref(tutorial: {
		title: string;
		slug: string;
		teaser?: string;
		excerpt?: string;
	}): string {
		return postIntent({
			kind: "tutorial",
			title: tutorial.title,
			teaser: tutorial.teaser,
			excerpt: tutorial.excerpt,
			permalink: permalink({ postType: "tutorials", slug: tutorial.slug }).href,
		});
	}

	/**
	 * Plain `YYYY-MM-DD` values are read as midnight UTC so stored timestamps
	 * stay stable across environments; invalid input counts as unpublished.
	 */
	private static parsePublishedAt(value: string | undefined): string | null {
		if (!value) return null;
		let parsed = parseDate(value);
		if (isFailure(parsed)) return null;
		return parsed.data.toISOString();
	}

	/**
	 * Invalid or missing timestamps yield an empty string so the date field
	 * stays in a valid controlled-input state.
	 */
	private static toDateInputValue(value: string | null): string {
		if (!value) return "";
		let parsed = parseDate(value);
		if (isFailure(parsed)) return "";
		return toDayKey(parsed.data, "UTC");
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
