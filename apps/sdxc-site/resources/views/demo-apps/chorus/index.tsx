/**
 * Chorus, the social network demo: a timeline of invented people with pictures, link cards,
 * quotes, polls and threads, profiles, grouped notifications, Explore and messages. What the
 * visitor posts, likes, reposts, saves and follows lives in their own cookies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Toast } from "@sdxc/ui/app";
import type { RemixNode } from "remix/component";

import { CompassIcon } from "@sdxc/icons";
import { LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { countCharacters } from "@sdxc/ui/character-count";
import { generateUUID } from "@sdxc/uuid/v4";

import type {
	DemoApp,
	DemoAppRedirect,
	DemoAppRequest,
	DemoAppScreen,
} from "~/resources/views/demo-apps";
import type { Conversation } from "~/resources/views/demo-apps/chorus/data";
import type { FeedKind } from "~/resources/views/demo-apps/chorus/home";
import type { ProfileTab } from "~/resources/views/demo-apps/chorus/profile";
import type { ToggleKind, VisitorState } from "~/resources/views/demo-apps/chorus/state";

import {
	ARRIVALS,
	CONVERSATIONS,
	EVERYONE,
	FOR_YOU,
	ME,
	POST_LIMIT,
	findPerson,
	href,
} from "~/resources/views/demo-apps/chorus/data";
import { ExploreScreen } from "~/resources/views/demo-apps/chorus/explore";
import { TitleBar, postById } from "~/resources/views/demo-apps/chorus/feed";
import { HomeScreen } from "~/resources/views/demo-apps/chorus/home";
import { ConversationScreen, MessagesScreen } from "~/resources/views/demo-apps/chorus/messages";
import { NotificationsScreen } from "~/resources/views/demo-apps/chorus/notifications";
import { PROFILE_TABS, ProfileScreen } from "~/resources/views/demo-apps/chorus/profile";
import { FollowCard, TrendsCard } from "~/resources/views/demo-apps/chorus/rail";
import {
	BookmarksScreen,
	ComposeScreen,
	PostScreen,
} from "~/resources/views/demo-apps/chorus/screens";
import { ChorusShell } from "~/resources/views/demo-apps/chorus/shell";
import {
	clearCookies,
	isPersonal,
	lookupPost,
	messagesCookie,
	postsCookie,
	readState,
	toggleCookie,
	voteCookie,
} from "~/resources/views/demo-apps/chorus/state";
import { ChorusThumbnail } from "~/resources/views/demo-apps/chorus/thumbnail";

/** Coral at hue 32: warm and loud enough for a Post button, its 600 step dark enough for white text. */
const BRAND = [
	"oklch(0.972 0.014 40)",
	"oklch(0.942 0.034 38)",
	"oklch(0.888 0.068 36)",
	"oklch(0.815 0.11 35)",
	"oklch(0.728 0.15 34)",
	"oklch(0.655 0.178 33)",
	"oklch(0.565 0.178 32)",
	"oklch(0.49 0.158 31)",
	"oklch(0.41 0.128 30)",
	"oklch(0.33 0.098 30)",
	"oklch(0.24 0.068 30)",
] as const;

/** Warm stone: neutrals with a trace of sand, so the coral reads as the one colour. */
const NEUTRAL = [
	"oklch(0.985 0.003 75)",
	"oklch(0.962 0.005 75)",
	"oklch(0.918 0.007 70)",
	"oklch(0.86 0.009 70)",
	"oklch(0.72 0.012 65)",
	"oklch(0.6 0.013 65)",
	"oklch(0.5 0.012 60)",
	"oklch(0.41 0.011 60)",
	"oklch(0.31 0.009 60)",
	"oklch(0.215 0.007 60)",
	"oklch(0.155 0.005 60)",
] as const;

/** A humanist sans, round avatars and pill-shaped buttons. */
const TOKENS = {
	"--ui-font-sans":
		'"Avenir Next", Avenir, "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif',
	"--ui-font-mono": '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace',
	"--ui-radius-md": "0.75rem",
	"--ui-radius-lg": "1rem",
	"--ui-button-radius": "999px",
} as const;

/** Every toast a redirect can name. */
const TOASTS: Record<string, Omit<Toast.Flash, "id">> = {
	posted: { color: "success", title: "Your post is live" },
	replied: { color: "success", title: "Reply posted" },
	sent: { title: "Message sent" },
	reset: { title: "Demo reset", description: "Your posts, likes and follows are cleared." },
};

/** The screens a visitor reaches by clicking, the home timeline first. */
const SCREENS = [
	"",
	"?feed=following",
	"?arrived=1",
	"?arrived=2",
	"explore",
	"explore?tab=people",
	"explore?q=%23Leonids",
	"explore?q=train",
	"explore?q=zebra",
	"notifications",
	"notifications?tab=mentions",
	"messages",
	...CONVERSATIONS.map((conversation) => `messages/${conversation.with}`),
	"messages?share=p-leonids",
	"bookmarks",
	"compose",
	"compose?reply=p-leonids",
	"compose?quote=p-fieldsizing",
	...FOR_YOU.map((entry) => `post/${entry.post}`),
	"post/p-fieldsizing-3",
	"post/r-leonids-3",
	...EVERYONE.map((person) => `u/${person.handle}`),
	...PROFILE_TABS.filter((tab) => tab !== "posts").map((tab) => `u/${ME.handle}/${tab}`),
	"u/anasousa/likes",
	"u/meilin/media",
];

/** The app's own 404, inside the shell so the nav still leads somewhere. */
function notFound(): DemoAppScreen {
	return {
		title: "Page not found",
		status: 404,
		body: (
			<ChorusShell current="none" header={<TitleBar title="Not found" back={href()} />}>
				<Empty icon={<CompassIcon />}>
					<Empty.Title>This page doesn't exist</Empty.Title>
					<Empty.Description>
						The post may have been deleted, or the link is mistyped. Your timeline is one click
						away.
					</Empty.Description>
					<Empty.Action>
						<LinkButton href={href()}>Back to your timeline</LinkButton>
					</Empty.Action>
				</Empty>
			</ChorusShell>
		),
	};
}

/**
 * The conversation with a person: the fixture's when Noor has one, else an empty one, so
 * Message on any profile opens a box to write in.
 */
function conversationWith(handle: string): Conversation {
	return (
		CONVERSATIONS.find((candidate) => candidate.with === handle) ?? { with: handle, messages: [] }
	);
}

/** A number of revealed batches from the address, clamped to the batches that exist. */
function arrivedOf(url: URL): number {
	let value = Number(url.searchParams.get("arrived") ?? "0");
	return Number.isInteger(value) ? Math.min(Math.max(value, 0), ARRIVALS.length) : 0;
}

/** A refused post's text and why, for the screen that answers it. */
type Draft = { value: string; issue: string };

/**
 * Answers a page path with its screen, or `null` when no screen lives there.
 *
 * @param request The page and its address.
 * @param state The visitor's state.
 * @param draft A refused post to show in the screen's composer again.
 */
function route(request: DemoAppRequest, state: VisitorState, draft?: Draft): DemoAppScreen | null {
	let { page, url } = request;
	let now = Date.now();
	let [first = "", second, third, ...rest] = page.split("/");
	if (rest.length > 0) return null;
	let params = url.searchParams;

	if (first === "" && second === undefined) {
		let feed: FeedKind = params.get("feed") === "following" ? "following" : "for-you";
		return {
			title: feed === "following" ? "Following" : "Home",
			body: (
				<HomeScreen feed={feed} arrived={arrivedOf(url)} state={state} now={now} draft={draft} />
			),
		};
	}

	if (first === "post" && second !== undefined && third === undefined) {
		let post = postById(second, state);
		if (!post) return null;
		return {
			title: `${post.person.name}: “${post.text.slice(0, 60)}${post.text.length > 60 ? "…" : ""}”`,
			body: <PostScreen post={post} state={state} now={now} draft={draft} />,
		};
	}

	if (first === "u" && second !== undefined) {
		let person = findPerson(second);
		let tab = PROFILE_TABS.find((candidate) => candidate === (third ?? "posts"));
		if (!person || !tab || third === "posts") return null;
		return {
			title: `${person.name} (@${person.handle})`,
			body: <ProfileScreen person={person} tab={tab as ProfileTab} state={state} now={now} />,
		};
	}

	if (second !== undefined && first !== "messages") return null;

	if (first === "explore") {
		let query = params.get("q") ?? "";
		return {
			title: query === "" ? "Explore" : `${query} — Search`,
			body: (
				<ExploreScreen
					query={query}
					tab={params.get("tab") === "people" ? "people" : "top"}
					state={state}
					now={now}
				/>
			),
		};
	}

	if (first === "notifications") {
		return {
			title: "Notifications",
			body: (
				<NotificationsScreen
					tab={params.get("tab") === "mentions" ? "mentions" : "all"}
					state={state}
					now={now}
				/>
			),
		};
	}

	if (first === "messages") {
		let shareId = params.get("share");
		let share = shareId ? postById(shareId, state) : undefined;
		if (second === undefined) {
			return { title: "Messages", body: <MessagesScreen state={state} now={now} share={share} /> };
		}
		let person = findPerson(second);
		if (!person || person.handle === ME.handle || third !== undefined) return null;
		let conversation = conversationWith(person.handle);
		return {
			title: `Messages with ${person.name}`,
			body: (
				<ConversationScreen
					person={person}
					conversation={conversation}
					state={state}
					now={now}
					share={share}
				/>
			),
		};
	}

	if (first === "bookmarks") {
		return { title: "Saved", body: <BookmarksScreen state={state} now={now} /> };
	}

	if (first === "compose") {
		let replyId = params.get("reply");
		let quoteId = params.get("quote");
		let replyTo = replyId ? postById(replyId, state) : undefined;
		let quote = quoteId ? postById(quoteId, state) : undefined;
		if ((replyId && !replyTo) || (quoteId && !quote)) return null;
		return {
			title: replyTo ? `Reply to ${replyTo.person.name}` : "New post",
			body: <ComposeScreen state={state} now={now} replyTo={replyTo} quote={quote} draft={draft} />,
		};
	}

	return null;
}

/** Answers one of Chorus's frames: the rail's trends or its people to follow. */
function framePart(part: string, request: DemoAppRequest): RemixNode | null {
	if (part === "rail/trends") return <TrendsCard />;
	if (part === "rail/follow") return <FollowCard state={readState(request.cookie)} />;
	return null;
}

/** The text of a form field, or `""` when it is missing or a file. */
function field(form: FormData, name: string): string {
	let value = form.get(name);
	return typeof value === "string" ? value : "";
}

/**
 * The page a toggle's form returns to, from its `return` field: a page path under the app,
 * never an address elsewhere; an unreadable one falls back to `fallback`.
 */
function returnPage(form: FormData, fallback: string): string {
	let value = field(form, "return");
	if (value.includes("//") || value.startsWith("/") || value.includes("\\")) return fallback;
	return value;
}

/**
 * Why a draft cannot be posted, or `null` when it can.
 *
 * @param text The draft, trimmed.
 */
export function draftIssue(text: string): string | null {
	if (text === "") return "Write something before posting.";
	let length = countCharacters(text);
	if (length > POST_LIMIT) {
		return `Posts are limited to ${POST_LIMIT} characters. This one is ${length - POST_LIMIT} over.`;
	}
	return null;
}

/**
 * Answers the composer: a post within the limit is added to the visitor's posts and the
 * visitor lands on it, on their timeline or under the post they replied to; anything else
 * answers the page it was written on again with what was typed and why.
 */
function submitCompose(
	form: FormData,
	request: DemoAppRequest,
	state: VisitorState,
): DemoAppRedirect | DemoAppScreen | null {
	let text = field(form, "text").trim();
	let replyTo = field(form, "replyTo") || undefined;
	let quote = field(form, "quote") || undefined;
	if ((replyTo && !lookupPost(replyTo, state)) || (quote && !lookupPost(quote, state))) return null;

	let issue = draftIssue(text);
	if (issue !== null) {
		let [page = "", query = ""] = field(form, "from").split("?");
		let url = new URL(request.url);
		url.search = query;
		let screen = route({ ...request, page, url }, state, { value: field(form, "text"), issue });
		return screen ? { ...screen, status: 400 } : null;
	}

	let id = `n-${generateUUID().slice(0, 8)}`;
	let cookie = postsCookie(state, { id, text, at: Date.now(), replyTo, quote });
	return replyTo
		? { page: `post/${replyTo}`, hash: `post-${id}`, toast: "replied", cookies: [cookie] }
		: { page: "", hash: `post-${id}`, toast: "posted", cookies: [cookie] };
}

/** Answers a post's like, repost, save or vote, returning to the row it was pressed on. */
function submitPost(id: string, form: FormData, state: VisitorState): DemoAppRedirect | null {
	let post = lookupPost(id, state);
	if (!post) return null;
	let back = { page: returnPage(form, `post/${id}`), hash: `post-${id}` };
	let intent = field(form, "intent");
	if (intent === "vote") {
		let option = Number(field(form, "option"));
		if (!post.poll || !Number.isInteger(option) || option < 0 || option >= post.poll.options.length)
			return null;
		return { ...back, cookies: [voteCookie(id, option)] };
	}
	let kinds: Record<string, ToggleKind> = { like: "like", repost: "repost", save: "save" };
	let kind = kinds[intent];
	if (!kind) return null;
	return { ...back, cookies: [toggleCookie(kind, id, field(form, "on") === "true")] };
}

/**
 * Chorus as the gallery and `/demo/apps/chorus` read it: its theme, every screen, its frames,
 * and how each form answers.
 */
export default {
	name: "Chorus",
	kind: "Social network",
	tagline: "A social timeline with polls, threads, quotes and messages.",
	artDirection: "Coral on warm stone, a humanist sans, round faces and pill buttons.",
	description:
		"Chorus, an invented social network: a live timeline with pictures, link cards, polls and threads, profiles, grouped notifications, search and messages.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: () => <ChorusThumbnail />,
	screens: SCREENS,
	cookies: [],
	isPersonal,
	toasts: TOASTS,
	frame: (part, request) => framePart(part, request),
	render(request) {
		return route(request, readState(request.cookie)) ?? notFound();
	},
	submit(page, form, request) {
		let state = readState(request.cookie);
		let [first = "", second, ...rest] = page.split("/");
		if (rest.length > 0) return null;
		if (first === "compose" && second === undefined) return submitCompose(form, request, state);
		if (first === "post" && second !== undefined) return submitPost(second, form, state);
		if (first === "u" && second !== undefined && field(form, "intent") === "follow") {
			let person = findPerson(second);
			if (!person || person.handle === ME.handle) return null;
			return {
				page: returnPage(form, `u/${person.handle}`),
				cookies: [toggleCookie("follow", person.handle, field(form, "on") === "true")],
			};
		}
		if (first === "messages" && second !== undefined) {
			let person = findPerson(second);
			if (!person || person.handle === ME.handle) return null;
			let text = field(form, "text").trim();
			if (text === "") return { page: `messages/${second}` };
			let message = {
				id: `m-${generateUUID().slice(0, 8)}`,
				text: text.slice(0, 1000),
				at: Date.now(),
				to: second,
			};
			return {
				page: `messages/${second}`,
				hash: "latest",
				toast: "sent",
				cookies: [messagesCookie(state, message)],
			};
		}
		if (first === "reset" && second === undefined) {
			return { page: "", toast: "reset", cookies: clearCookies(request.cookie) };
		}
		return null;
	},
} satisfies DemoApp;
