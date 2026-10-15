/**
 * View model for the CMS screens of the short posts, notes and TILs: list rows with their
 * "Post on X" links, the create and edit form states, and submitted values normalized for the
 * models. Both kinds share one form whose content is checked against what X would receive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseDate, toDayKey } from "@sdxc/dates";
import { isFailure } from "@sdxc/result";
import { slugify } from "@sdxc/strings";

import type { PostShare } from "~/app/services/share";

import { POST_KINDS } from "~/app/models/kinds";
import { isPublishedAt, noteTitle, serializeTags } from "~/app/models/post-values";
import { shortIntent } from "~/app/services/share";
import { permalink } from "~/app/services/webmention";
import routes from "~/routes/web";

/**
 * Payload contracts at the boundary where stored posts and form values become screen data.
 */
export namespace ShortPostViewModel {
	/** The kinds these screens manage. */
	export type Kind = PostShare.ShortKind;

	/** A stored note or TIL as the screens read it; a note has no title or tags. */
	export interface Source {
		id: string;
		slug: string;
		title?: string;
		content: string;
		tags?: Array<string>;
		published_at: string | null;
	}

	/** Untrusted strings straight from the form controls. */
	export interface FormData {
		title?: string;
		slug?: string;
		tags?: string;
		content: string;
		published_at?: string;
	}

	/** One row of a list. */
	export interface Row {
		id: string;
		/** A TIL's title, or a note's content shortened. */
		label: string;
		publicHref: string;
		/** The author's "Post on X" link, prefilled with the post's share text. */
		shareHref: string;
		preview: boolean;
		tags: string;
		href: string;
		deleteAction: string;
	}

	/** The create or edit form: its heading, where it posts, and the values it shows. */
	export interface Form {
		kind: Kind;
		title: string;
		description: string;
		/** The saved post's public URL, linked after the description; absent until the post is saved. */
		publicHref?: string;
		mode: "new" | "edit";
		action: string;
		submitLabel: string;
		deleteAction?: string;
		/** The "Post on X" link of the saved post; absent until the post is saved. */
		shareHref?: string;
		/** Why the last save was refused, shown under the content. */
		contentError?: string;
		values: {
			title: string;
			slug: string;
			tags: string;
			content: string;
			published_at: string;
		};
	}

	/** Submitted values ready for a model write; a note's slug is assigned on create. */
	export interface Input {
		published_at: string | null;
		meta: { title: string; slug: string; tags: string | null; content: string };
	}
}

/**
 * Builds the note and TIL screens and normalizes their submissions, so both controllers
 * compose view state from the same rules.
 */
export class ShortPostViewModel {
	/**
	 * Rows for the list, each with its public permalink and its "Post on X" link.
	 *
	 * @param kind Which list.
	 * @param items The stored posts, previews included.
	 */
	static index(kind: ShortPostViewModel.Kind, items: Array<ShortPostViewModel.Source>) {
		let cms = this.routesOf(kind);
		return items.map((item): ShortPostViewModel.Row => ({
			id: item.id,
			label: this.label(kind, item),
			publicHref: routes.post.href({ postType: POST_KINDS[kind].topic, postSlug: item.slug }),
			shareHref: this.shareHref(kind, item),
			preview: !isPublishedAt(item.published_at),
			tags: (item.tags ?? []).join(", "),
			href: cms.edit.href({ id: item.id }),
			deleteAction: cms.destroy.href({ id: item.id }),
		}));
	}

	/**
	 * An empty form for a new post.
	 *
	 * @param kind Which kind the form creates.
	 */
	static new(kind: ShortPostViewModel.Kind): ShortPostViewModel.Form {
		let { label } = POST_KINDS[kind];
		return {
			kind,
			title: `New ${label}`,
			description:
				kind === "note"
					? "A short post, shared on X whole with its permalink."
					: "Something you learned, shared on X as TIL with its permalink.",
			mode: "new",
			action: this.routesOf(kind).index.href(),
			submitLabel: `Create ${label}`,
			values: { title: "", slug: "", tags: "", content: "", published_at: "" },
		};
	}

	/**
	 * A create form naming the id that was not found, so the screen stays actionable.
	 *
	 * @param kind Which kind was looked up.
	 * @param id The id the request named.
	 */
	static notFound(kind: ShortPostViewModel.Kind, id?: string): ShortPostViewModel.Form {
		let { label } = POST_KINDS[kind];
		return {
			...this.new(kind),
			title: `${label} Not Found`,
			description: `${label} ${id ?? ""} was not found.`,
		};
	}

	/**
	 * The edit form of a saved post, with its "Post on X" link. A post's slug is its permalink,
	 * so the form shows it without letting it change.
	 *
	 * @param kind The post's kind.
	 * @param source The stored post.
	 */
	static edit(
		kind: ShortPostViewModel.Kind,
		source: ShortPostViewModel.Source,
	): ShortPostViewModel.Form {
		let cms = this.routesOf(kind);
		let { label, topic } = POST_KINDS[kind];
		return {
			kind,
			title: `Edit ${label} ${this.label(kind, source)}`,
			description: `Editing ${label} at`,
			publicHref: routes.post.href({ postType: topic, postSlug: source.slug }),
			mode: "edit",
			action: cms.update.href({ id: source.id }),
			submitLabel: `Save ${label}`,
			deleteAction: cms.destroy.href({ id: source.id }),
			shareHref: this.shareHref(kind, source),
			values: {
				title: source.title ?? "",
				slug: source.slug,
				tags: (source.tags ?? []).join(", "),
				content: source.content,
				published_at: toDateInputValue(source.published_at),
			},
		};
	}

	/**
	 * The form as submitted with why the save was refused, so the author cuts the content
	 * without retyping anything. It edits `id` when given, else creates.
	 *
	 * @param kind The post's kind.
	 * @param input The edited post's id and slug, if any, the submission, and the reason.
	 */
	static rejected(
		kind: ShortPostViewModel.Kind,
		input: {
			id?: string;
			slug?: string;
			data: ShortPostViewModel.FormData;
			contentError: string;
		},
	): ShortPostViewModel.Form {
		let { data, id } = input;
		let cms = this.routesOf(kind);
		let { label } = POST_KINDS[kind];
		return {
			kind,
			title: id ? `Edit ${label}` : `New ${label}`,
			description: `The ${label} was not saved.`,
			mode: id ? "edit" : "new",
			action: id ? cms.update.href({ id }) : cms.index.href(),
			submitLabel: id ? `Save ${label}` : `Create ${label}`,
			deleteAction: id ? cms.destroy.href({ id }) : undefined,
			contentError: input.contentError,
			values: {
				title: data.title ?? "",
				slug: input.slug ?? data.slug ?? "",
				tags: data.tags ?? "",
				content: data.content,
				published_at: data.published_at ?? "",
			},
		};
	}

	/**
	 * Submitted values as a model writes them: a TIL's slug from its title unless typed, its
	 * tags as the stored JSON list, and a date-only publish date read as midnight UTC.
	 *
	 * @param data The validated form values.
	 */
	static input(data: ShortPostViewModel.FormData): ShortPostViewModel.Input {
		let title = data.title ?? "";
		return {
			published_at: parsePublishedAt(data.published_at),
			meta: {
				title,
				slug: data.slug || slugify(title),
				tags: serializeTags(parseTags(data.tags)),
				content: data.content,
			},
		};
	}

	/** What a row or heading calls a post: a TIL's title, a note's content shortened. */
	private static label(kind: ShortPostViewModel.Kind, source: ShortPostViewModel.Source): string {
		return kind === "til" ? (source.title ?? "") : noteTitle(source.content);
	}

	/** The author's "Post on X" link for a saved post, read at its canonical permalink. */
	private static shareHref(
		kind: ShortPostViewModel.Kind,
		source: ShortPostViewModel.Source,
	): string {
		return shortIntent({
			kind,
			content: source.content,
			permalink: permalink({ postType: POST_KINDS[kind].topic, slug: source.slug }).href,
		});
	}

	/** The CMS routes of a kind's screens. */
	private static routesOf(kind: ShortPostViewModel.Kind) {
		return routes.cms[POST_KINDS[kind].cms];
	}
}

/** A form's `YYYY-MM-DD` read as midnight UTC; blank or invalid input publishes on save. */
function parsePublishedAt(value: string | undefined): string | null {
	if (!value) return null;
	let parsed = parseDate(value);
	if (isFailure(parsed)) return null;
	return parsed.data.toISOString();
}

/** A stored date as the date input's value, empty when there is none or it does not parse. */
function toDateInputValue(value: string | null): string {
	if (!value) return "";
	let parsed = parseDate(value);
	if (isFailure(parsed)) return "";
	return toDayKey(parsed.data, "UTC");
}

/** Comma-separated tags trimmed, blanks dropped, in the order typed. */
function parseTags(value: string | undefined): Array<string> {
	if (!value) return [];
	return value
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);
}
