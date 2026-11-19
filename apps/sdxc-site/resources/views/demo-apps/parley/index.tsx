/**
 * Parley, the team chat demo: Fernhill's channels and direct messages with threads, reactions,
 * edits, pins, search, a quick switcher and teammates who type and post live. What the visitor
 * sends and changes lives in their own cookies. Raspberry on oat, rounded-square faces.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Toast } from "@sdxc/ui/app";
import type { RemixNode } from "remix/component";

import { CompassIcon } from "@sdxc/icons";
import { LinkButton } from "@sdxc/ui";
import { readAppShellCookie } from "@sdxc/ui/app/app-shell";
import { Empty } from "@sdxc/ui/app/empty";
import { readSplitViewLayout } from "@sdxc/ui/app/split-view";
import { TOAST_UNDO_DURATION } from "@sdxc/ui/app/toast";
import { generateUUID } from "@sdxc/uuid/v4";

import type {
	DemoApp,
	DemoAppRedirect,
	DemoAppRequest,
	DemoAppScreen,
} from "~/resources/views/demo-apps";
import type { Panel } from "~/resources/views/demo-apps/parley/conversation";
import type { Conversation } from "~/resources/views/demo-apps/parley/data";
import type { Section } from "~/resources/views/demo-apps/parley/shell";
import type { SentFile, VisitorState } from "~/resources/views/demo-apps/parley/state";

import {
	DEMO_APP_ANCHOR_PARAM,
	DEMO_APP_TOAST_PARAM,
	readToastParam,
} from "~/resources/views/demo-apps";
import { MAIN_FRAME, MainScreen, mainSource } from "~/resources/views/demo-apps/main-frame";
import { ConversationScreen, SPLIT_COOKIE } from "~/resources/views/demo-apps/parley/conversation";
import {
	CONVERSATIONS,
	LIVE,
	actionHref,
	conversationPage,
	conversationTitle,
	findConversation,
	href,
} from "~/resources/views/demo-apps/parley/data";
import { isReactionKey } from "~/resources/views/demo-apps/parley/emoji";
import { HomeScreen, SearchScreen } from "~/resources/views/demo-apps/parley/home";
import { liveStream } from "~/resources/views/demo-apps/parley/live-stream";
import { messageAnchor, withoutParam } from "~/resources/views/demo-apps/parley/messages";
import { findEntry, search, unreadByKey } from "~/resources/views/demo-apps/parley/model";
import {
	DetailsPanel,
	ReactPanel,
	ThreadPanel,
	detailsTab,
} from "~/resources/views/demo-apps/parley/panel";
import { ParleyApp, ParleyPane, SHELL_COOKIE } from "~/resources/views/demo-apps/parley/shell";
import {
	MESSAGE_LIMIT,
	clearCookies,
	deletedCookie,
	editsCookie,
	isPersonal,
	liveCookie,
	pinsCookie,
	reactionsCookie,
	readCookie,
	readState,
	sentCookie,
} from "~/resources/views/demo-apps/parley/state";
import { ParleyThumbnail } from "~/resources/views/demo-apps/parley/thumbnail";

/** Raspberry at hue 355: warm and clear on oat, its 600 step dark enough for white text. */
const BRAND = [
	"oklch(0.972 0.014 355)",
	"oklch(0.94 0.034 356)",
	"oklch(0.885 0.068 357)",
	"oklch(0.81 0.112 358)",
	"oklch(0.72 0.16 359)",
	"oklch(0.64 0.19 0)",
	"oklch(0.555 0.19 1)",
	"oklch(0.48 0.168 2)",
	"oklch(0.405 0.138 3)",
	"oklch(0.33 0.105 4)",
	"oklch(0.24 0.072 4)",
] as const;

/** Oat: neutrals with a trace of warm grain, so the raspberry is the one colour that speaks. */
const NEUTRAL = [
	"oklch(0.982 0.005 80)",
	"oklch(0.958 0.007 80)",
	"oklch(0.914 0.009 78)",
	"oklch(0.858 0.011 76)",
	"oklch(0.72 0.013 74)",
	"oklch(0.6 0.013 72)",
	"oklch(0.5 0.012 70)",
	"oklch(0.41 0.011 68)",
	"oklch(0.31 0.009 66)",
	"oklch(0.22 0.007 64)",
	"oklch(0.16 0.005 62)",
] as const;

/** A neo-grotesque face, compact rows and modest radii. */
const TOKENS = {
	"--ui-font-sans":
		'"Inter Tight", "Helvetica Neue", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif',
	"--ui-font-mono": '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace',
	"--ui-radius-md": "0.5rem",
	"--ui-radius-lg": "0.75rem",
	"--ui-app-sidebar-width": "16.5rem",
} as const;

/** Every toast a redirect can name; deleting offers Undo. */
const TOASTS: Record<string, Omit<Toast.Flash, "id">> = {
	deleted: {
		title: "Message deleted",
		duration: TOAST_UNDO_DURATION,
		action: { label: "Undo", form: { action: actionHref("undo"), fields: { intent: "undo" } } },
	},
	restored: { title: "Message restored" },
	pinned: { title: "Message pinned" },
	unpinned: { title: "Message unpinned" },
	edited: { title: "Message updated" },
	"read-all": { title: "Everything marked as read" },
	reset: { title: "Demo reset", description: "Your messages, reactions and reads are cleared." },
};

/** The screens a visitor reaches by clicking, Home first. */
const SCREENS = [
	"",
	"search",
	"search?q=launch",
	"search?q=forecast&in=c%3Aengineering",
	"search?q=zebra",
	...CONVERSATIONS.map((conversation) => conversationPage(conversation.key)),
	"c/launch-v3?thread=l3",
	"c/general?thread=g4",
	"c/launch-v3?details=about",
	"c/launch-v3?details=members",
	"c/launch-v3?details=pins",
	"d/mira?details=about",
	"c/engineering?edit=e2",
	"c/launch-v3?react=l7",
];

/** The sidebar row a page marks as the one shown. */
function sectionOf(page: string): Section {
	let [first = "", second] = page.split("/");
	if (first === "") return "home";
	if (first === "search") return "search";
	if ((first === "c" || first === "d") && second !== undefined) return `${first}:${second}`;
	return "none";
}

/** The page path a request is on, with its query and without its one-time toast and anchor. */
function pageOf(request: DemoAppRequest): string {
	let query = new URLSearchParams(request.url.search);
	query.delete(DEMO_APP_TOAST_PARAM);
	query.delete(DEMO_APP_ANCHOR_PARAM);
	let rest = query.toString();
	return rest === "" ? request.page : `${request.page}?${rest}`;
}

/** The app's own 404, inside the shell so the sidebar still leads somewhere. */
function notFound(collapsed: boolean): DemoAppScreen {
	return {
		title: "Page not found",
		status: 404,
		body: (
			<ParleyPane collapsed={collapsed} title="Not found" back={href()}>
				<Empty icon={<CompassIcon />}>
					<Empty.Title>Nothing lives at this address</Empty.Title>
					<Empty.Description>
						The channel may have been archived, or the link is mistyped. Home has everything new.
					</Empty.Description>
					<Empty.Action>
						<LinkButton href={href()}>Go home</LinkButton>
					</Empty.Action>
				</Empty>
			</ParleyPane>
		),
	};
}

/** The conversation a page path names, `c/<name>` or `d/<handle>`. */
function conversationOf(page: string): Conversation | undefined {
	let [first = "", second, ...rest] = page.split("/");
	if ((first !== "c" && first !== "d") || second === undefined || rest.length > 0) return undefined;
	return findConversation(`${first}:${second}`);
}

/**
 * Answers a page path with its screen, whose body is the pane the main frame holds, or the
 * app's 404 screen.
 *
 * @param request The page, its address and cookie.
 * @param draft A refused send's text, put back in the composer.
 */
function route(request: DemoAppRequest, draft?: string): DemoAppScreen {
	let { page, url, cookie } = request;
	let collapsed = readAppShellCookie(cookie, SHELL_COOKIE);
	let state = readState(cookie);
	let now = Date.now();
	let params = url.searchParams;

	if (page === "") {
		return {
			title: "Home",
			body: (
				<HomeScreen
					state={state}
					unread={unreadByKey(state, now)}
					now={now}
					collapsed={collapsed}
				/>
			),
		};
	}

	if (page === "search") {
		let query = params.get("q") ?? "";
		let within = params.get("in") ?? undefined;
		let scope = within === undefined ? undefined : findConversation(within);
		return {
			title: query === "" ? "Search" : `“${query}” — Search`,
			body: (
				<SearchScreen
					query={query}
					within={scope?.key}
					hits={search(query, scope?.key, state, now)}
					now={now}
					collapsed={collapsed}
				/>
			),
		};
	}

	let conversation = conversationOf(page);
	if (conversation === undefined) return notFound(collapsed);
	let back = pageOf(request);
	let place = { page: conversationPage(conversation.key), back };
	let editing = params.get("edit") ?? undefined;
	let threadId = params.get("thread");
	let thread = threadId === null ? undefined : findEntry(conversation, threadId, state, now);
	let reactId = params.get("react");
	let reacting = reactId === null ? undefined : findEntry(conversation, reactId, state, now);
	let tab = detailsTab(params.get("details"));
	let panel: Panel | undefined;
	let panelContent: RemixNode | undefined;
	if (thread !== undefined && thread.parent === undefined) {
		panel = { kind: "thread", entry: thread };
		panelContent = (
			<ThreadPanel
				conversation={conversation}
				entry={thread}
				place={place}
				now={now}
				editing={editing}
			/>
		);
	} else if (reacting !== undefined) {
		panel = { kind: "react", entry: reacting };
		panelContent = <ReactPanel conversation={conversation} entry={reacting} place={place} />;
	} else if (tab !== undefined) {
		panel = { kind: "details", tab };
		panelContent = (
			<DetailsPanel conversation={conversation} state={state} tab={tab} place={place} now={now} />
		);
	}
	return {
		title: conversationTitle(conversation),
		body: (
			<ConversationScreen
				conversation={conversation}
				state={state}
				now={now}
				collapsed={collapsed}
				page={back}
				panel={panel}
				panelContent={panelContent}
				editing={editing}
				draft={draft}
				layout={readSplitViewLayout(cookie, SPLIT_COOKIE)}
			/>
		),
	};
}

/**
 * A screen's pane as the main frame holds it: with the title and sidebar row the shell takes
 * on after a swap, and the toast the post that led here named.
 */
function inMain(screen: DemoAppScreen, request: DemoAppRequest): RemixNode {
	let param = request.url.searchParams.get(DEMO_APP_TOAST_PARAM);
	let key = param === null ? null : readToastParam(param).key;
	let toast = key !== null && Object.hasOwn(TOASTS, key) ? TOASTS[key] : undefined;
	return (
		<MainScreen title={screen.title} nav={sectionOf(request.page)} url={request.url} toast={toast}>
			{screen.body}
		</MainScreen>
	);
}

/** Puts a screen in Parley's document, the pane drawn in place when a post answered it. */
function inDocument(
	screen: DemoAppScreen,
	request: DemoAppRequest,
	answered: boolean,
): DemoAppScreen {
	let state = readState(request.cookie);
	let pane = answered ? inMain(screen, request) : undefined;
	let body = (
		<ParleyApp
			current={sectionOf(request.page)}
			collapsed={readAppShellCookie(request.cookie, SHELL_COOKIE)}
			unread={unreadByKey(state, Date.now())}
			src={mainSource(request.url)}
			pane={pane}
		/>
	);
	return answered ? { ...screen, body, frames: { [MAIN_FRAME]: pane } } : { ...screen, body };
}

/** The text of a form field, or `""` when it is missing or a file. */
function field(form: FormData, name: string): string {
	let value = form.get(name);
	return typeof value === "string" ? value : "";
}

/**
 * The page a form returns to, from its `return` field: a page path under the app, never an
 * address elsewhere; an unreadable one falls back to `fallback`.
 */
function returnPage(form: FormData, fallback: string): string {
	if (!form.has("return")) return fallback;
	let value = field(form, "return");
	if (value.includes("//") || value.startsWith("/") || value.includes("\\")) return fallback;
	return value;
}

/** The files a send attached, by name and size, leaving out an empty file input. */
function filesOf(form: FormData): SentFile[] {
	return form
		.getAll("files")
		.flatMap((value) =>
			typeof value !== "string" && value.name !== ""
				? [{ name: value.name, size: value.size }]
				: [],
		);
}

/**
 * Answers a form posted in a conversation: send, react, edit, delete, pin, read, and the live
 * island's report of what it showed.
 */
function submitConversation(
	conversation: Conversation,
	form: FormData,
	request: DemoAppRequest,
	state: VisitorState,
): DemoAppRedirect | DemoAppScreen | null {
	let now = Date.now();
	let page = conversationPage(conversation.key);
	let back = returnPage(form, page);
	let intent = field(form, "intent");
	let id = field(form, "id");
	let read = { ...state.read, [conversation.key]: now };

	if (intent === "send") {
		let text = field(form, "text").trim().slice(0, MESSAGE_LIMIT);
		let files = filesOf(form);
		let parentId = field(form, "parent");
		let parent = parentId === "" ? undefined : findEntry(conversation, parentId, state, now);
		if (parentId !== "" && (parent === undefined || parent.parent !== undefined)) return null;
		if (text === "" && files.length === 0) return { page: back };
		let message = {
			id: `s${generateUUID().slice(0, 8)}`,
			key: conversation.key,
			text: text === "" ? "Shared a file" : text,
			at: now,
			parent: parent?.id,
			files: files.length > 0 ? files : undefined,
		};
		return {
			page: back,
			hash: messageAnchor(message.id),
			cookies: [sentCookie([...state.sent, message]), readCookie(read)],
		};
	}

	if (intent === "read") return { page: back, cookies: [readCookie(read)] };

	if (intent === "seen") {
		let cookies = [readCookie(read)];
		let index = Number(field(form, "live"));
		let seen = state.live[conversation.key] ?? [];
		if (
			form.has("live") &&
			index === seen.length &&
			index < (LIVE[conversation.key]?.length ?? 0)
		) {
			cookies.push(liveCookie({ ...state.live, [conversation.key]: [...seen, now] }));
		}
		let answer = field(form, "answer");
		if (answer !== "") {
			cookies.push(
				sentCookie(
					state.sent.map((message) =>
						message.id === answer && message.key === conversation.key
							? { ...message, answered: true }
							: message,
					),
				),
			);
		}
		return { page, cookies };
	}

	let entry = id === "" ? undefined : findEntry(conversation, id, state, now);
	if (entry === undefined) return null;
	let hash = messageAnchor(entry.id);

	if (intent === "react") {
		let emoji = field(form, "emoji");
		if (!isReactionKey(emoji)) return null;
		let on = field(form, "on") !== "0";
		let toggles = { ...state.reactions[entry.id], [emoji]: on };
		return {
			page: withoutParam(back, "react"),
			hash,
			cookies: [reactionsCookie({ ...state.reactions, [entry.id]: toggles })],
		};
	}

	if (intent === "pin" || intent === "unpin") {
		return {
			page: back,
			hash,
			toast: `${intent}ned`,
			cookies: [pinsCookie({ ...state.pins, [entry.id]: intent === "pin" })],
		};
	}

	if (!entry.mine) return null;

	if (intent === "edit") {
		let text = field(form, "text").trim().slice(0, MESSAGE_LIMIT);
		let target = withoutParam(back, "edit");
		if (text === "" || text === entry.text) return { page: target, hash };
		return {
			page: target,
			hash,
			toast: "edited",
			cookies: [editsCookie({ ...state.edits, [entry.id]: text })],
		};
	}

	if (intent === "delete") {
		return {
			page: withoutParam(
				withoutParam(back, "edit"),
				entry.parent === undefined ? "thread" : "edit",
			),
			toast: "deleted",
			cookies: [deletedCookie([...state.deleted.filter((other) => other !== entry.id), entry.id])],
		};
	}

	return null;
}

/** Undoes the visitor's last delete, returning to the restored message. */
function undo(state: VisitorState): DemoAppRedirect | null {
	let last = state.deleted.at(-1);
	if (last === undefined) return { page: "" };
	let restored = { ...state, deleted: state.deleted.slice(0, -1) };
	let now = Date.now();
	for (let conversation of CONVERSATIONS) {
		let entry = findEntry(conversation, last, restored, now);
		if (entry === undefined) continue;
		let page = conversationPage(conversation.key);
		return {
			page: entry.parent === undefined ? page : `${page}?thread=${entry.parent}`,
			hash: messageAnchor(entry.id),
			toast: "restored",
			cookies: [deletedCookie(restored.deleted)],
		};
	}
	return { page: "", cookies: [deletedCookie(restored.deleted)] };
}

/** Answers a form posted on `page`. */
function submit(
	page: string,
	form: FormData,
	request: DemoAppRequest,
): DemoAppRedirect | DemoAppScreen | null {
	let state = readState(request.cookie);
	let intent = field(form, "intent");
	if (page === "" && intent === "read-all") {
		let now = Date.now();
		let read = Object.fromEntries(CONVERSATIONS.map((conversation) => [conversation.key, now]));
		return { page: "", toast: "read-all", cookies: [readCookie(read)] };
	}
	if (page === "undo" && intent === "undo") return undo(state);
	if (page === "reset") return { page: "", toast: "reset", cookies: clearCookies(request.cookie) };
	let conversation = conversationOf(page);
	if (conversation === undefined) return null;
	return submitConversation(conversation, form, request, state);
}

/**
 * Parley as the gallery and `/demo/apps/parley` read it: its theme, every screen, the main
 * frame, the live stream, and how each form answers.
 */
export default {
	name: "Parley",
	kind: "Team chat",
	tagline: "Channels, threads and DMs for a small studio, live as teammates type.",
	artDirection: "Raspberry on oat, a neo-grotesque face, rounded-square faces with presence dots.",
	description:
		"Parley, an invented team chat: channels and direct messages with unread and mention badges, threads, reactions, edits, pins, search, a quick switcher and teammates who type and post live.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: () => <ParleyThumbnail />,
	screens: SCREENS,
	cookies: [SHELL_COOKIE, SPLIT_COOKIE],
	isPersonal,
	toasts: TOASTS,
	stream: (part, request) => liveStream(part, request),
	render(request) {
		return inDocument(route(request), request, false);
	},
	target(name, request) {
		if (name !== MAIN_FRAME) return null;
		return inMain(route(request), request);
	},
	submit(page, form, request) {
		let answer = submit(page, form, request);
		return answer !== null && "body" in answer ? inDocument(answer, request, true) : answer;
	},
} satisfies DemoApp;
