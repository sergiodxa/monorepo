/**
 * Where each of Inkwell's forms sends the visitor. A demo keeps nothing, so every post is read
 * with `remix/data-schema` only to pick the screen and toast a real CMS would answer with; a
 * form that fails validation is answered again with everything typed and the issue on its field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import type { DemoAppRedirect, DemoAppRequest } from "~/resources/views/demo-apps";
import type { ShellScreen } from "~/resources/views/demo-apps/inkwell/shell";

import { MEDIA, POSTS } from "~/resources/views/demo-apps/inkwell/data";
import { EditorScreen } from "~/resources/views/demo-apps/inkwell/editor";
import { PostsScreen } from "~/resources/views/demo-apps/inkwell/posts";
import { postsListPage, readPostsQuery } from "~/resources/views/demo-apps/inkwell/posts-query";
import { href } from "~/resources/views/demo-apps/inkwell/shell";

/** A text field that may be absent, read as an empty string. */
const OPTIONAL_TEXT = f.field(s.defaulted(s.string(), ""));

/** The bulk form under the posts table: the action and the checked posts. */
const BULK_FORM = f.object({
	intent: f.field(s.enum_(["publish", "unpublish", "delete"])),
	post: f.fields(s.array(s.string())),
	back: OPTIONAL_TEXT,
});

/** The quick-edit sheet's form. */
const QUICK_FORM = f.object({
	title: OPTIONAL_TEXT,
	slug: OPTIONAL_TEXT,
	status: f.field(s.enum_(["draft", "published", "scheduled"])),
	author: f.field(s.string()),
	back: OPTIONAL_TEXT,
});

/**
 * The editor's form. `intent` is absent when ⌘S submits it, which saves the way the document
 * already saves: a draft stays a draft, a live post updates.
 */
const EDITOR_FORM = f.object({
	intent: f.field(s.optional(s.enum_(["publish", "update", "draft"]))),
	title: OPTIONAL_TEXT,
	excerpt: OPTIONAL_TEXT,
	body: OPTIONAL_TEXT,
	status: f.field(s.optional(s.enum_(["draft", "published", "scheduled"]))),
	author: f.field(s.optional(s.string())),
	tags: f.fields(s.array(s.string())),
});

/** The attachment sheet's form. */
const ATTACHMENT_FORM = f.object({
	alt: OPTIONAL_TEXT,
	caption: OPTIONAL_TEXT,
	back: OPTIONAL_TEXT,
});

/** The invite form under the masthead. */
const INVITE_FORM = f.object({
	email: f.field(s.string().refine((value) => /^[^\s@]+@[^\s@]+$/.test(value), "Enter an email")),
	role: f.field(s.enum_(["contributor", "editor"])),
});

/** The toast each bulk action ends with, echoing its button's verb. */
const BULK_TOAST = {
	publish: "posts-published",
	unpublish: "posts-unpublished",
	delete: "posts-deleted",
} as const;

/**
 * Answers one form post.
 *
 * @param page The page path the form posted under.
 * @param form The submitted fields.
 * @param request The post's address, which a screen answered again is built from.
 * @param now The render's reference moment.
 * @returns The screen to land on and its toast, the form answered again with its issues, or
 *   `null` for a form Inkwell has none of.
 */
export function submitInkwell(
	page: string,
	form: FormData,
	request: DemoAppRequest,
	now: Date,
): DemoAppRedirect | ShellScreen | null {
	if (page === "posts") return submitBulk(form);
	if (page === "posts/restore") return { page: "posts", toast: "posts-restored" };
	if (page === "posts/new") return submitEditor(form, null, "posts", now);
	if (page === "pages/new") return submitEditor(form, null, "pages", now);
	if (page === "media") return { page: "media", toast: "files-uploaded" };
	if (page === "settings/general" || page === "settings/publishing") {
		return { page, toast: "settings-saved" };
	}
	if (page === "settings/team") return submitInvite(form);

	let quick = /^posts\/([a-z0-9-]+)\/quick$/.exec(page);
	if (quick !== null) return submitQuick(form, quick[1]!, request, now);

	let post = /^posts\/([a-z0-9-]+)$/.exec(page);
	if (post !== null) return submitEditor(form, post[1]!, "posts", now);

	let media = /^media\/([a-z0-9-]+)$/.exec(page);
	if (media !== null) return submitAttachment(form, media[1]!);

	return null;
}

/** Publishes, unpublishes or deletes the checked posts and returns to the same filtered list. */
function submitBulk(form: FormData): DemoAppRedirect | null {
	let result = s.parseSafe(BULK_FORM, form);
	if (!result.success) return null;
	let { intent, post, back } = result.value;
	let page = postsListPage(back);
	if (post.length === 0) return { page };
	return { page, toast: BULK_TOAST[intent] };
}

/**
 * Saves a quick edit. An empty title answers with the same list and the sheet still open,
 * holding every value the visitor chose and the issue on the title.
 */
function submitQuick(
	form: FormData,
	id: string,
	request: DemoAppRequest,
	now: Date,
): DemoAppRedirect | ShellScreen | null {
	let post = POSTS.find((candidate) => candidate.id === id);
	if (post === undefined) return null;
	let result = s.parseSafe(QUICK_FORM, form);
	if (!result.success) return null;
	let { title, slug, status, author, back } = result.value;
	let list = postsListPage(back);
	if (title.trim() !== "") return { page: list, toast: "post-updated" };

	let listUrl = new URL(href(list), request.url.origin);
	return {
		title: "Posts",
		current: "posts",
		place: "Posts",
		status: 400,
		body: (
			<PostsScreen
				listUrl={listUrl}
				query={readPostsQuery(listUrl.searchParams)}
				quick={post}
				titleIssue
				edited={{ title, slug, status, authorId: author }}
				now={now}
			/>
		),
	};
}

/**
 * Saves the editor. An empty title answers with the editor again, holding the typed title,
 * excerpt, body and properties, with the issue on the title; the input is `required`, so a
 * browser only gets here with its validation switched off.
 */
function submitEditor(
	form: FormData,
	id: string | null,
	list: "posts" | "pages",
	now: Date,
): DemoAppRedirect | ShellScreen | null {
	let post = id === null ? null : POSTS.find((candidate) => candidate.id === id);
	if (post === undefined) return null;
	let result = s.parseSafe(EDITOR_FORM, form);
	if (!result.success) return null;
	let { intent: posted, title, excerpt, body, status, author, tags } = result.value;

	let here = id === null ? `${list}/new` : `posts/${id}`;
	if (title.trim() === "") {
		let kind: "post" | "page" = list === "pages" ? "page" : "post";
		let edited =
			post === null
				? null
				: { ...post, status: status ?? post.status, authorId: author ?? post.authorId, tags };
		return {
			title: post?.title ?? `New ${kind}`,
			current: list,
			place: list === "pages" ? "Pages" : "Posts",
			status: 400,
			body: (
				<EditorScreen
					post={edited}
					kind={kind}
					issue="title"
					values={{ title, excerpt, body }}
					justSaved={false}
					now={now}
				/>
			),
		};
	}

	let intent = posted ?? (post === null || post.status === "draft" ? "draft" : "update");
	if (intent === "draft") {
		let drafts = list === "posts" ? "posts?status=draft" : "pages";
		return { page: id === null ? drafts : here, toast: "draft-saved" };
	}
	if (intent === "update") return { page: here, toast: "post-updated" };
	if (status === "scheduled") return { page: here, toast: "post-scheduled" };
	if (id === null) {
		return { page: list, toast: list === "pages" ? "page-published" : "post-published" };
	}
	return { page: here, toast: "post-published" };
}

/** Saves an attachment's alt text and caption and keeps its sheet open. */
function submitAttachment(form: FormData, id: string): DemoAppRedirect | null {
	if (!MEDIA.some((item) => item.id === id)) return null;
	let result = s.parseSafe(ATTACHMENT_FORM, form);
	if (!result.success) return null;
	let view = result.value.back === "list" ? "&view=list" : "";
	return { page: `media?item=${id}${view}`, toast: "attachment-saved" };
}

/** Sends an invite; an address the schema rejects returns to the form without a toast. */
function submitInvite(form: FormData): DemoAppRedirect {
	let result = s.parseSafe(INVITE_FORM, form);
	if (!result.success) return { page: "settings/team" };
	return { page: "settings/team", toast: "invite-sent" };
}
