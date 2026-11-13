/**
 * The CMS demo app: Inkwell, the editor behind Lantern Review, an invented quarterly. Posts
 * with count tabs and quick edit, the editor and its save model, media and settings, set in
 * an editorial register: warm paper, an ink-blue accent, serif titles and soft corners.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { APP_SHELL_COOKIE, readAppShellCookie } from "@sdxc/ui/app/app-shell";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import type { DemoApp, DemoAppRequest, DemoAppScreen } from "~/resources/views/demo-apps";
import type { StatusTab } from "~/resources/views/demo-apps/inkwell/posts-query";
import type { SettingsTab } from "~/resources/views/demo-apps/inkwell/settings";
import type { NavKey, ShellScreen } from "~/resources/views/demo-apps/inkwell/shell";

import { DEMO_APP_TOAST_PARAM } from "~/resources/views/demo-apps";
import { MEDIA, POSTS, PUBLICATION } from "~/resources/views/demo-apps/inkwell/data";
import { EditorScreen, PostHistory } from "~/resources/views/demo-apps/inkwell/editor";
import {
	ActivityFeed,
	DraftList,
	HomeScreen,
	HomeStats,
	ReaderComments,
	ScheduledList,
} from "~/resources/views/demo-apps/inkwell/home";
import { AttachmentDetails, MediaScreen } from "~/resources/views/demo-apps/inkwell/media";
import { NotFoundScreen, PagesScreen } from "~/resources/views/demo-apps/inkwell/pages";
import { PostsScreen, QuickEditForm } from "~/resources/views/demo-apps/inkwell/posts";
import { readPostsQuery } from "~/resources/views/demo-apps/inkwell/posts-query";
import { PreviewScreen } from "~/resources/views/demo-apps/inkwell/preview";
import { SETTINGS_TITLES, SettingsScreen } from "~/resources/views/demo-apps/inkwell/settings";
import { action, InkwellShell } from "~/resources/views/demo-apps/inkwell/shell";
import { submitInkwell } from "~/resources/views/demo-apps/inkwell/submit";
import { inkwellThumbnail } from "~/resources/views/demo-apps/inkwell/thumbnail";
import {
	MAIN_FRAME,
	MainFrame,
	mainSource,
	MainScreen,
} from "~/resources/views/demo-apps/main-frame";

/** An ink-blue ramp at hue 262, deep enough at 600 to read as fountain-pen ink on paper. */
const BRAND = [
	"oklch(0.975 0.012 262)",
	"oklch(0.944 0.027 262)",
	"oklch(0.888 0.054 262)",
	"oklch(0.8 0.088 262)",
	"oklch(0.69 0.125 262)",
	"oklch(0.575 0.145 262)",
	"oklch(0.47 0.148 262)",
	"oklch(0.4 0.13 262)",
	"oklch(0.335 0.105 262)",
	"oklch(0.275 0.08 262)",
	"oklch(0.205 0.058 262)",
] as const;

/** Warm paper neutrals leaning toward cream, so the frame reads as stock rather than grey. */
const NEUTRAL = [
	"oklch(0.984 0.008 85)",
	"oklch(0.962 0.013 83)",
	"oklch(0.918 0.017 80)",
	"oklch(0.85 0.02 78)",
	"oklch(0.73 0.021 75)",
	"oklch(0.6 0.02 72)",
	"oklch(0.5 0.018 70)",
	"oklch(0.41 0.016 68)",
	"oklch(0.31 0.013 65)",
	"oklch(0.225 0.011 62)",
	"oklch(0.165 0.009 60)",
] as const;

/** A book serif for titles and the writing column, a quiet sans for the chrome, soft corners. */
const TOKENS = {
	"--ui-font-serif":
		"'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Charter, Georgia, serif",
	"--ui-font-sans":
		"'Avenir Next', Avenir, 'Segoe UI', ui-sans-serif, system-ui, -apple-system, sans-serif",
	"--ui-radius-sm": "0.3125rem",
	"--ui-radius-md": "0.5rem",
	"--ui-radius-lg": "0.75rem",
	"--ui-radius-xl": "1rem",
	"--ui-app-inset-radius": "1rem",
	"--ui-editor-measure": "40rem",
} as const;

/** The params the media library reads from its address. */
const MEDIA_QUERY = f.object({
	view: f.field(s.defaulted(s.enum_(["grid", "list"]), "grid")),
	item: f.field(s.optional(s.string())),
});

/** The toasts a form's redirect can name, each echoing the verb on the button that caused it. */
const TOASTS: DemoApp["toasts"] = {
	"post-published": { color: "success", title: "Post published" },
	"post-updated": { color: "success", title: "Post updated" },
	"post-scheduled": { color: "brand", title: "Post scheduled" },
	"draft-saved": { title: "Draft saved" },
	"page-published": { color: "success", title: "Page published" },
	"posts-published": { color: "success", title: "Posts published" },
	"posts-unpublished": { title: "Posts unpublished" },
	"posts-deleted": {
		title: "Posts deleted",
		action: { label: "Undo", form: { action: action("posts/restore") } },
		duration: 8000,
	},
	"posts-restored": { title: "Posts restored" },
	"files-uploaded": { color: "success", title: "Files uploaded" },
	"attachment-saved": { title: "Attachment saved" },
	"settings-saved": { title: "Settings saved" },
	"invite-sent": { color: "success", title: "Invite sent" },
};

/** The toasts that mean the editor's document was just saved, so its status reads "Saved". */
const SAVE_TOASTS = new Set(["post-updated", "draft-saved", "post-published", "post-scheduled"]);

/** The saved view a status tab marks current in the nav; the other tabs mark Posts. */
const STATUS_NAV: Partial<Record<StatusTab, NavKey>> = { draft: "drafts", scheduled: "scheduled" };

/**
 * Puts a screen's main area inside Inkwell's shell as the `main` frame, with the sidebar as
 * wide as the visitor left it; the server inlines the frame, so the page reads without scripts.
 *
 * @param screen The screen and the nav row it marks current.
 * @param request The request the screen renders for.
 * @returns The whole frame, ready to render.
 */
function framed(screen: ShellScreen, request: DemoAppRequest): DemoAppScreen {
	return {
		title: screen.title,
		status: screen.status,
		body: (
			<InkwellShell
				current={screen.current}
				collapsed={readAppShellCookie(request.cookie)}
				place={screen.place}
			>
				<MainFrame src={mainSource(request.url)} />
			</InkwellShell>
		),
	};
}

/**
 * A form answered again with its issues: the whole page for a post that left the document,
 * and the `main` frame alone for one sent through it, both holding everything typed.
 *
 * @param screen The screen the form answers with.
 * @param request The post's request, whose address the screen settles on unless it names its own.
 * @returns The page, with its main area as the `main` frame's content.
 */
function answered(screen: ShellScreen, request: DemoAppRequest): DemoAppScreen {
	return {
		title: screen.title,
		status: screen.status,
		body: (
			<InkwellShell
				current={screen.current}
				collapsed={readAppShellCookie(request.cookie)}
				place={screen.place}
			>
				{screen.body}
			</InkwellShell>
		),
		frames: {
			[MAIN_FRAME]: (
				<MainScreen
					title={screen.title}
					nav={screen.current ?? undefined}
					crumb={screen.place}
					url={screen.url ?? request.url}
				>
					{screen.body}
				</MainScreen>
			),
		},
	};
}

/**
 * A copy of the address without the params that belong to one visit rather than to the view
 * (the toast, an open record), so links built from it never repeat them.
 *
 * @param url The request's address.
 * @param names The extra params to drop.
 * @returns The cleaned address.
 */
function viewUrl(url: URL, names: string[]): URL {
	let next = new URL(url);
	for (let name of [DEMO_APP_TOAST_PARAM, ...names]) next.searchParams.delete(name);
	return next;
}

/**
 * Picks the screen a page path names, or the 404 screen. The editor and its preview take a
 * post id from the path; the lists read their filters from the query.
 *
 * @param request The page, address and cookie of the request.
 * @param now The render's reference moment.
 * @returns The screen and its frame's settings, or the preview's bare page.
 */
function route(request: DemoAppRequest, now: Date): ShellScreen | DemoAppScreen {
	let { page, url } = request;
	let toast = url.searchParams.get(DEMO_APP_TOAST_PARAM);
	let parts = page.split("/").filter((part) => part !== "");
	let [section, id, rest] = parts;

	if (parts.length === 0) {
		return { title: "Home", current: "home", place: "Home", body: <HomeScreen /> };
	}

	if (section === "posts" && parts.length === 1) {
		let query = readPostsQuery(url.searchParams);
		let quickId = url.searchParams.get("quick");
		let quick = POSTS.find((post) => post.id === quickId) ?? null;
		let current = STATUS_NAV[query.status] ?? "posts";
		return {
			title: "Posts",
			current,
			place: "Posts",
			body: (
				<PostsScreen
					listUrl={viewUrl(url, ["quick"])}
					query={query}
					quick={quick}
					titleIssue={false}
					now={now}
				/>
			),
		};
	}

	if ((section === "posts" || section === "pages") && id === "new" && parts.length === 2) {
		let kind: "page" | "post" = section === "pages" ? "page" : "post";
		return {
			title: `New ${kind}`,
			current: section,
			place: section === "pages" ? "Pages / New page" : "Posts / New post",
			body: <EditorScreen post={null} kind={kind} issue={null} justSaved={false} now={now} />,
		};
	}

	let post = section === "posts" ? POSTS.find((candidate) => candidate.id === id) : undefined;
	if (post !== undefined && parts.length === 2) {
		return {
			title: post.title,
			current: "posts",
			place: "Posts",
			body: (
				<EditorScreen
					post={post}
					kind="post"
					issue={null}
					justSaved={toast !== null && SAVE_TOASTS.has(toast)}
					now={now}
				/>
			),
		};
	}
	if (post !== undefined && parts.length === 3 && rest === "preview") {
		return { title: `Preview: ${post.title}`, body: <PreviewScreen post={post} now={now} /> };
	}

	if (section === "pages" && parts.length === 1) {
		return { title: "Pages", current: "pages", place: "Pages", body: <PagesScreen /> };
	}

	if (section === "media" && parts.length === 1) {
		let result = s.parseSafe(MEDIA_QUERY, url.searchParams);
		let layout = result.success ? result.value.view : "grid";
		let itemId = result.success ? result.value.item : undefined;
		let item = MEDIA.find((entry) => entry.id === itemId) ?? null;
		return {
			title: item === null ? "Media" : `${item.name} — Media`,
			current: "media",
			place: "Media",
			body: <MediaScreen listUrl={viewUrl(url, ["item"])} layout={layout} item={item} now={now} />,
		};
	}

	if (section === "settings" && parts.length <= 2) {
		let tab = (id ?? "general") as SettingsTab;
		if (Object.hasOwn(SETTINGS_TITLES, tab)) {
			return {
				title: `${SETTINGS_TITLES[tab]} settings`,
				current: "settings",
				place: id === undefined ? "Settings" : `Settings / ${SETTINGS_TITLES[tab]}`,
				body: <SettingsScreen tab={tab} index={id === undefined} now={now} />,
			};
		}
	}

	return {
		title: "Not found",
		current: null,
		place: "Not found",
		body: <NotFoundScreen />,
		status: 404,
	};
}

/** The overview's frames, each a part with no state of its own beyond the moment it renders. */
const HOME_PARTS: Record<string, (now: Date) => RemixNode> = {
	"home/stats": (now) => <HomeStats now={now} />,
	"home/drafts": (now) => <DraftList now={now} />,
	"home/scheduled": (now) => <ScheduledList now={now} />,
	"home/activity": (now) => <ActivityFeed now={now} />,
	"home/comments": () => <ReaderComments />,
};

/**
 * Renders one of Inkwell's frames. A post's history and quick-edit form and a file's sheet
 * name their record in the path; the quick-edit form reads the list it saves back to from its
 * query, and the file's sheet the library's layout.
 *
 * @param part The frame's path under the app.
 * @param request The frame's address, carrying its query.
 * @param now The render's reference moment.
 * @returns The part, or `null` for a path or record Inkwell has none of.
 */
function frame(part: string, request: DemoAppRequest, now: Date): RemixNode | null {
	let home = HOME_PARTS[part];
	if (home !== undefined) return home(now);

	let [section, id, name, ...extra] = part.split("/");
	if (extra.length > 0) return null;
	if (section === "posts") {
		let post = POSTS.find((candidate) => candidate.id === id);
		if (post === undefined) return null;
		if (name === "history") return <PostHistory post={post} now={now} />;
		if (name === "quick") {
			return <QuickEditForm post={post} back={request.url.search} titleIssue={false} />;
		}
	}
	if (section === "media" && name === "attachment") {
		let item = MEDIA.find((entry) => entry.id === id);
		if (item === undefined) return null;
		let list = request.url.searchParams.get("view") === "list";
		return <AttachmentDetails item={item} view={list ? "list" : "grid"} now={now} />;
	}
	return null;
}

/** Inkwell, as the demo apps route registers it. */
export default {
	name: "Inkwell",
	kind: "CMS",
	tagline: `The editor behind ${PUBLICATION.name}, a quarterly on reading slowly.`,
	artDirection: "Warm paper, ink-blue and serif titles.",
	description:
		"Inkwell, a demo CMS built from @sdxc/ui/app: posts with count tabs and quick edit, an editor with a quiet save status and a loud Publish, media and settings.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: inkwellThumbnail,
	screens: [
		"",
		"posts",
		"posts?status=published",
		"posts?status=draft",
		"posts?status=scheduled",
		"posts?author=tomas",
		"posts?q=typewriter",
		"posts?quick=the-letterpress-year",
		"posts/on-slow-reading",
		"posts/the-letterpress-year",
		"posts/margins-and-marginalia",
		"posts/a-conversation-with-a-bookbinder",
		"posts/field-notes-from-the-coast",
		"posts/the-case-for-paper-notebooks",
		"posts/reading-in-translation",
		"posts/how-we-edit",
		"posts/the-commonplace-book",
		"posts/winter-reading-list",
		"posts/new",
		"posts/on-slow-reading/preview",
		"pages",
		"pages/new",
		"media",
		"media?view=list",
		"media?item=winter-train",
		"settings",
		"settings/general",
		"settings/publishing",
		"settings/team",
	],
	cookies: [APP_SHELL_COOKIE],
	toasts: TOASTS,
	frame: (part, request) => frame(part, request, new Date()),
	render(request) {
		let screen = route(request, new Date());
		return "current" in screen ? framed(screen, request) : screen;
	},
	target(name, request) {
		if (name !== MAIN_FRAME) return null;
		let screen = route(request, new Date());
		if (!("current" in screen)) return null;
		let key = request.url.searchParams.get(DEMO_APP_TOAST_PARAM);
		return (
			<MainScreen
				title={screen.title}
				nav={screen.current ?? undefined}
				crumb={screen.place}
				url={request.url}
				toast={key !== null && Object.hasOwn(TOASTS, key) ? TOASTS[key] : undefined}
			>
				{screen.body}
			</MainScreen>
		);
	},
	submit(page, form, request) {
		let next = submitInkwell(page, form, request, new Date());
		return next !== null && "current" in next ? answered(next, request) : next;
	},
} satisfies DemoApp;
