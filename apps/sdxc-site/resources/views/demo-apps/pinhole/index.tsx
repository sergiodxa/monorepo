/**
 * Pinhole, an invented social network for photographs and short videos: a home feed under a
 * story tray, stories and highlights in a full-screen viewer, a vertical reels feed, profiles,
 * Explore and a page per post. Warm darkroom paper with a safelight red; every picture is drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { generateUUID } from "@sdxc/uuid/v7";

import type { DemoApp, DemoAppRedirect, DemoAppRequest } from "~/resources/views/demo-apps";

import { DEMO_APP_TOAST_PARAM } from "~/resources/views/demo-apps";
import {
	MAIN_FRAME,
	MainScreen,
	MainFrame,
	mainSource,
} from "~/resources/views/demo-apps/main-frame";
import { MainFrameSync } from "~/resources/views/demo-apps/main-frame-sync";

import type { Destination } from "./shell";
import type { ToggleKind } from "./state";

import {
	HIGHLIGHTS,
	ME,
	PEOPLE,
	POSTS,
	REELS,
	STORIES,
	TOPICS,
	findHighlight,
	findPerson,
	findPost,
	findReel,
	href,
	storyOf,
} from "./data";
import ExplorePage from "./explore";
import Home from "./home";
import PostPage from "./post";
import ProfilePage, { SavedPage, profileTab } from "./profile";
import ReelsPage, { reelTitle } from "./reels";
import PinholeShell, { LoadingBar } from "./shell";
import {
	COMMENT_LIMIT,
	commentsCookie,
	isPersonal,
	readState,
	resetCookies,
	toggleCookie,
} from "./state";
import StoriesPage, { highlightGroups, storyGroups } from "./stories";
import { PinholeThumbnail } from "./thumbnail";

/** A safelight red at hue 30, the one colour a darkroom allows. */
const BRAND = [
	"oklch(0.97 0.018 40)",
	"oklch(0.935 0.04 38)",
	"oklch(0.88 0.085 35)",
	"oklch(0.8 0.135 33)",
	"oklch(0.71 0.18 31)",
	"oklch(0.635 0.205 30)",
	"oklch(0.565 0.2 29)",
	"oklch(0.49 0.18 28)",
	"oklch(0.41 0.15 27)",
	"oklch(0.33 0.11 26)",
	"oklch(0.24 0.075 25)",
] as const;

/** Warm photographic paper, ink-brown in its darkest steps. */
const NEUTRAL = [
	"oklch(0.985 0.006 85)",
	"oklch(0.962 0.01 82)",
	"oklch(0.915 0.014 80)",
	"oklch(0.84 0.017 78)",
	"oklch(0.71 0.018 75)",
	"oklch(0.58 0.017 72)",
	"oklch(0.47 0.015 70)",
	"oklch(0.37 0.013 68)",
	"oklch(0.27 0.011 65)",
	"oklch(0.2 0.009 62)",
	"oklch(0.14 0.007 60)",
] as const;

/** A humanist sans for the interface, an old-style serif for the name and stickers, square-ish corners. */
const TOKENS = {
	"--ui-font-sans":
		"'Gill Sans', 'Gill Sans MT', Seravek, 'Trebuchet MS', ui-sans-serif, system-ui, -apple-system, sans-serif",
	"--ui-font-mono": "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
	"--pinhole-display":
		"'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
	"--pinhole-heart": "oklch(0.6 0.23 25)",
	"--ui-story-ring":
		"conic-gradient(from 200deg, oklch(0.64 0.2 30), oklch(0.8 0.14 70), oklch(0.64 0.2 30))",
	"--ui-radius-sm": "0.25rem",
	"--ui-radius-md": "0.375rem",
	"--ui-radius-lg": "0.5rem",
} as const;

/** The pages a form may send the visitor back to: a path under the app, never an address elsewhere. */
const RETURN_PAGE = /^(?!\/)(?!.*\/\/)[\w./?=&%-]*$/;

/** Every toast a Pinhole redirect can name. */
const TOASTS: DemoApp["toasts"] = {
	reset: {
		color: "neutral",
		title: "Demo reset",
		description: "Likes, saves, follows and comments are back to how they started.",
	},
	commented: { color: "neutral", title: "Comment posted" },
	replied: { color: "neutral", title: "Reply sent" },
};

/** One Pinhole screen: its title and status, the destination it marks, and its content. */
interface PinholeScreen {
	title: string;
	status?: number;
	/** The rail destination it marks, or `null` for a screen that draws its own frame. */
	current: Destination | null;
	dark?: boolean;
	content: RemixNode;
}

/** The app's own 404, inside its frame. */
function NotFound() {
	return () => (
		<div style="padding: 4rem 1rem">
			<Empty kind="no-results">
				<Empty.Title>This page isn't on Pinhole</Empty.Title>
				<Empty.Description>
					The link may be broken, or the post may have been removed.
				</Empty.Description>
				<Empty.Action>
					<LinkButton href={href()}>Back to home</LinkButton>
				</Empty.Action>
			</Empty>
		</div>
	);
}

/** The screen a `stories/…` or `highlights/…` path names. */
function storyScreen(first: string, parts: string[]): PinholeScreen | undefined {
	if (first === "stories") {
		let [handle = "", number = "1", extra] = parts;
		let story = storyOf(handle);
		let segment = Number(number) - 1;
		if (extra !== undefined || story === undefined || !Number.isInteger(segment)) return undefined;
		if (segment < 0 || segment >= story.segments.length) return undefined;
		let person = findPerson(handle)!;
		return {
			title: `${person.name}'s story`,
			current: null,
			content: (
				<StoriesPage groups={storyGroups()} active={handle} segment={segment} closePage="" />
			),
		};
	}
	let [handle = "", id = "", number = "1", extra] = parts;
	let highlight = findHighlight(handle, id);
	let segment = Number(number) - 1;
	if (extra !== undefined || highlight === undefined || !Number.isInteger(segment))
		return undefined;
	if (segment < 0 || segment >= highlight.segments.length) return undefined;
	return {
		title: `${highlight.title} · ${findPerson(handle)!.name}`,
		current: null,
		content: (
			<StoriesPage
				groups={highlightGroups(handle)}
				active={id}
				segment={segment}
				closePage={`u/${handle}`}
				highlights
			/>
		),
	};
}

/**
 * Picks the screen a page path names; every path Pinhole lacks gets its own 404 inside the
 * frame, so a mistyped address still shows where the visitor is.
 */
function route(request: DemoAppRequest): PinholeScreen {
	let state = readState(request.cookie);
	let [first = "", ...rest] = request.page.split("/");
	let params = request.url.searchParams;
	let found: PinholeScreen | undefined;
	if (first === "" && rest.length === 0) {
		found = { title: "Home", current: "home", content: <Home state={state} /> };
	} else if (first === "explore" && rest.length === 0) {
		let query = params.get("q") ?? "";
		let topic = TOPICS.find((entry) => entry.id === params.get("topic"))?.id;
		found = {
			title: query.trim() === "" ? "Explore" : `Search: ${query.trim()}`,
			current: "explore",
			content: <ExplorePage state={state} query={query} topic={topic} />,
		};
	} else if (first === "reels" && rest.length <= 1) {
		let reel = rest.length === 0 ? REELS[0] : findReel(rest[0]!);
		found =
			reel === undefined
				? undefined
				: {
						title: rest.length === 0 ? "Reels" : reelTitle(reel),
						current: "reels",
						dark: true,
						content: <ReelsPage state={state} current={reel} />,
					};
	} else if (first === "saved" && rest.length === 0) {
		found = { title: "Saved", current: "saved", content: <SavedPage state={state} /> };
	} else if (first === "p" && rest.length === 1) {
		let post = findPost(rest[0]!);
		let author = post === undefined ? undefined : findPerson(post.author);
		found =
			post === undefined || author === undefined
				? undefined
				: {
						title: `${author.name} on Pinhole: “${post.caption.slice(0, 48)}${post.caption.length > 48 ? "…" : ""}”`,
						current: "none",
						content: <PostPage post={post} state={state} />,
					};
	} else if (first === "u" && rest.length === 1) {
		let person = findPerson(rest[0]!);
		found =
			person === undefined
				? undefined
				: {
						title: `${person.name} (@${person.handle})`,
						current: person.handle === ME.handle ? "profile" : "none",
						content: (
							<ProfilePage
								person={person}
								state={state}
								tab={profileTab(params.get("tab"), person.handle === ME.handle)}
							/>
						),
					};
	} else if (first === "stories" || first === "highlights") {
		found = storyScreen(first, rest);
	}
	return found ?? { title: "Not found", status: 404, current: "none", content: <NotFound /> };
}

/** Reads one text field of a post. */
function field(form: FormData, name: string): string {
	let value = form.get(name);
	return typeof value === "string" ? value : "";
}

/** The page a form returns to, from its `back` field, or `fallback` when it names nowhere safe. */
function backPage(form: FormData, fallback: string): string {
	if (!form.has("back")) return fallback;
	let value = field(form, "back");
	return RETURN_PAGE.test(value) ? value : fallback;
}

/** Answers a toggle post: the cookie for its new state, and back to where it was pressed. */
function toggle(
	kind: ToggleKind,
	key: string,
	form: FormData,
	fallback: string,
	hash?: string,
): DemoAppRedirect {
	let page = backPage(form, fallback);
	return {
		page,
		hash: page === "" || page.startsWith("explore") ? hash : undefined,
		cookies: [toggleCookie(kind, key, field(form, "on") === "true")],
	};
}

/** Answers a post on `p/<id>/…`: a like, a save, a comment, or a like on one of its comments. */
function submitPost(
	rest: string[],
	form: FormData,
	request: DemoAppRequest,
): DemoAppRedirect | null {
	let [id = "", action, commentId, commentAction, extra] = rest;
	let post = findPost(id);
	if (post === undefined || extra !== undefined) return null;
	if ((action === "like" || action === "save") && commentId === undefined) {
		return toggle(action, post.id, form, `p/${post.id}`, `post-${post.id}`);
	}
	if (action === "c" && commentId !== undefined && commentAction === "like") {
		return toggle("clike", commentId, form, `p/${post.id}`);
	}
	if (action !== "comment" || commentId !== undefined) return null;
	let text = field(form, "text").trim().slice(0, COMMENT_LIMIT);
	if (text === "") return { page: backPage(form, `p/${post.id}`) };
	let state = readState(request.cookie);
	let comment = { id: generateUUID(), post: post.id, text, at: Date.now() };
	return {
		page: `p/${post.id}`,
		hash: `comment-${comment.id}`,
		toast: "commented",
		cookies: [commentsCookie(state, comment)],
	};
}

/** Every screen a visitor reaches by clicking, so a test can walk them all. */
const SCREENS = [
	"",
	"explore",
	"explore?q=bread",
	"explore?q=mara",
	"explore?topic=ceramics",
	"explore?q=zzz",
	"reels",
	...REELS.map((reel) => `reels/${reel.id}`),
	"saved",
	...POSTS.map((post) => `p/${post.id}`),
	...PEOPLE.map((person) => `u/${person.handle}`),
	`u/${ME.handle}?tab=reels`,
	`u/${ME.handle}?tab=saved`,
	`u/${ME.handle}?tab=tagged`,
	"u/mara.quint?tab=reels",
	"u/mara.quint?tab=tagged",
	...STORIES.map((story) => `stories/${story.author}/1`),
	"stories/mara.quint/2",
	...HIGHLIGHTS.map((highlight) => `highlights/${highlight.author}/${highlight.id}/1`),
];

export default {
	name: "Pinhole",
	kind: "Photo and video network",
	tagline: "Pictures from close to home.",
	artDirection: "Darkroom paper, safelight red, drawn photographs.",
	description:
		"Pinhole, an invented social network for photographs and short videos: a feed under a story tray, full-screen stories, a vertical reels feed, profiles with highlights, Explore and posts with comments.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: () => <PinholeThumbnail />,
	screens: SCREENS,
	cookies: [],
	isPersonal,
	toasts: TOASTS,
	render(request) {
		let screen = route(request);
		return {
			title: screen.title,
			status: screen.status,
			body: (
				<>
					<LoadingBar />
					<MainFrame src={mainSource(request.url)} />
					<MainFrameSync root={href()} />
				</>
			),
		};
	},
	target(name, request) {
		if (name !== MAIN_FRAME) return null;
		let screen = route(request);
		let key = request.url.searchParams.get(DEMO_APP_TOAST_PARAM);
		return (
			<MainScreen
				title={screen.title}
				nav={screen.current ?? undefined}
				url={request.url}
				toast={key !== null && Object.hasOwn(TOASTS, key) ? TOASTS[key] : undefined}
			>
				{screen.current === null ? (
					screen.content
				) : (
					<PinholeShell current={screen.current} dark={screen.dark}>
						{screen.content}
					</PinholeShell>
				)}
			</MainScreen>
		);
	},
	submit(page, form, request) {
		let [first = "", ...rest] = page.split("/");
		if (first === "reset" && rest.length === 0) {
			return { page: "", toast: "reset", cookies: resetCookies(request.cookie) };
		}
		if (first === "p") return submitPost(rest, form, request);
		if (first === "reels" && rest.length === 2 && rest[1] === "like") {
			let reel = findReel(rest[0]!);
			return reel === undefined ? null : toggle("like", reel.id, form, `reels/${reel.id}`);
		}
		if (first === "u" && rest.length === 2 && rest[1] === "follow") {
			let person = findPerson(rest[0]!);
			if (person === undefined || person.handle === ME.handle) return null;
			return toggle("follow", person.handle, form, `u/${person.handle}`);
		}
		if (first === "stories" && rest.length === 2 && rest[1] === "reply") {
			if (storyOf(rest[0]!) === undefined) return null;
			let back = backPage(form, `stories/${rest[0]}/1`);
			if (field(form, "text").trim() === "") return { page: back };
			return { page: back, toast: "replied" };
		}
		return null;
	},
} satisfies DemoApp;
