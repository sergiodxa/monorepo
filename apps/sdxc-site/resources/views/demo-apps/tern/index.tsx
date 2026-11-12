/**
 * Tern, the chat assistant demo: an invented assistant with three models, a history grouped
 * by day, projects, a canvas beside the chat and settings. Replies are canned and picked by
 * the words a message uses. Dusk violet, lavender greys and a rounded face.
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

import type {
	DemoApp,
	DemoAppRedirect,
	DemoAppRequest,
	DemoAppScreen,
} from "~/resources/views/demo-apps";
import type { Conversation } from "~/resources/views/demo-apps/tern/data";
import type { Thread } from "~/resources/views/demo-apps/tern/thread";

import { CanvasPane } from "~/resources/views/demo-apps/tern/canvas";
import {
	CONVERSATIONS,
	MODELS,
	PROJECTS,
	actionHref,
	findConversation,
	findModel,
	findProject,
	href,
} from "~/resources/views/demo-apps/tern/data";
import { HomeScreen } from "~/resources/views/demo-apps/tern/home";
import {
	ChatScreen,
	ProjectFiles,
	ProjectScreen,
	SPLIT_COOKIE,
	SearchScreen,
	ShareScreen,
} from "~/resources/views/demo-apps/tern/screens";
import {
	SETTINGS_PAGES,
	SettingsScreen,
	UsagePanel,
} from "~/resources/views/demo-apps/tern/settings";
import { SHELL_COOKIE, TernShell } from "~/resources/views/demo-apps/tern/shell";
import {
	THREAD_FIELD,
	edit,
	isSaved,
	readThread,
	regenerate,
	savedThread,
	send,
	threadTitle,
	turnsOf,
} from "~/resources/views/demo-apps/tern/thread";
import { TernThumbnail } from "~/resources/views/demo-apps/tern/thumbnail";

/** Dusk violet at hue 300: a twilight sky over the water, its 600 step dark enough for white text. */
const BRAND = [
	"oklch(0.972 0.014 305)",
	"oklch(0.94 0.032 304)",
	"oklch(0.885 0.062 303)",
	"oklch(0.81 0.1 302)",
	"oklch(0.71 0.145 300)",
	"oklch(0.615 0.17 298)",
	"oklch(0.53 0.175 296)",
	"oklch(0.46 0.155 295)",
	"oklch(0.39 0.125 294)",
	"oklch(0.32 0.095 294)",
	"oklch(0.235 0.065 294)",
] as const;

/** Lavender grey: neutrals with a trace of the violet, so the chrome sits back from the chat. */
const NEUTRAL = [
	"oklch(0.975 0.004 300)",
	"oklch(0.952 0.006 300)",
	"oklch(0.908 0.008 300)",
	"oklch(0.852 0.01 300)",
	"oklch(0.72 0.013 300)",
	"oklch(0.6 0.014 300)",
	"oklch(0.5 0.014 300)",
	"oklch(0.42 0.013 300)",
	"oklch(0.33 0.011 300)",
	"oklch(0.24 0.009 300)",
	"oklch(0.17 0.007 300)",
] as const;

/** A rounded face, soft large radii and a pill-shaped composer. */
const TOKENS = {
	"--ui-font-sans":
		'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, -apple-system, "Segoe UI", sans-serif',
	"--ui-font-mono": '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace',
	"--ui-radius-md": "0.625rem",
	"--ui-radius-lg": "0.875rem",
	"--ui-app-inset-radius": "1rem",
	"--ui-app-sidebar-width": "16rem",
	"--ui-composer-radius": "1.5rem",
} as const;

/** Every toast a redirect can name; deleting a chat offers Undo for that chat. */
const TOASTS: Record<string, Omit<Toast.Flash, "id">> = {
	feedback: { title: "Thanks for the feedback" },
	pinned: { title: "Chat pinned" },
	unpinned: { title: "Chat unpinned" },
	restored: { title: "Chat restored" },
	"preferences-saved": { color: "success", title: "Preferences saved" },
	"about-saved": { color: "success", title: "Personalisation saved" },
	"memory-on": { title: "Memory turned on" },
	"memory-off": { title: "Memory turned off" },
	"training-on": { title: "Chats will improve Tern" },
	"training-off": { title: "Chats will not train Tern" },
	"export-started": { title: "Export started", description: "The link arrives by email." },
	"chats-deleted": { title: "All chats deleted" },
	...Object.fromEntries(
		CONVERSATIONS.map((conversation) => [
			`deleted-${conversation.id}`,
			{
				title: "Chat deleted",
				duration: TOAST_UNDO_DURATION,
				action: {
					label: "Undo",
					form: { action: actionHref(`c/${conversation.id}`), fields: { intent: "restore" } },
				},
			},
		]),
	),
};

/** The screens a visitor reaches by clicking, the new chat first. */
const SCREENS = [
	"",
	"?model=dive",
	...CONVERSATIONS.map((conversation) => `c/${conversation.id}`),
	"c/debounce-search?canvas=open",
	"c/launch-email?canvas=open",
	"c/lisbon-offsite?model=glide",
	"share/lisbon-offsite",
	"share/debounce-search",
	"search",
	"search?q=email",
	"search?q=zebra",
	...PROJECTS.map((project) => `projects/${project.slug}`),
	"settings",
	...SETTINGS_PAGES.map((page) => `settings/${page}`),
];

/** The app's own 404, inside the shell so the sidebar still leads somewhere. */
function notFound(collapsed: boolean): DemoAppScreen {
	return {
		title: "Page not found",
		status: 404,
		body: (
			<TernShell current="none" collapsed={collapsed} crumb="Not found">
				<Empty icon={<CompassIcon />}>
					<Empty.Title>Nothing lives at this address</Empty.Title>
					<Empty.Description>
						The chat may have been deleted, or the link is mistyped. A new chat is one click away.
					</Empty.Description>
					<Empty.Action>
						<LinkButton href={href()}>Start a new chat</LinkButton>
					</Empty.Action>
				</Empty>
			</TernShell>
		),
	};
}

/** Renders a conversation as a screen, replaying one reply when the page answered a send. */
function chatScreen(thread: Thread, request: DemoAppRequest, streaming?: number): DemoAppScreen {
	let collapsed = readAppShellCookie(request.cookie, SHELL_COOKIE);
	let canvas = request.url.searchParams.get("canvas") === "open";
	return {
		title: threadTitle(thread),
		status: 200,
		body: (
			<ChatScreen
				thread={thread}
				collapsed={collapsed}
				streaming={streaming}
				canvas={canvas && streaming === undefined}
				layout={readSplitViewLayout(request.cookie, SPLIT_COOKIE)}
			/>
		),
	};
}

/** Answers a page path with its screen, or `null` when no screen lives there. */
function route(request: DemoAppRequest): DemoAppScreen | null {
	let { page, url, cookie } = request;
	let collapsed = readAppShellCookie(cookie, SHELL_COOKIE);
	let [first = "", second, ...rest] = page.split("/");
	if (rest.length > 0) return null;
	let model = url.searchParams.get("model");

	if (first === "" && second === undefined) {
		return {
			title: "New chat",
			body: <HomeScreen thread={savedThread(null, model)} collapsed={collapsed} />,
		};
	}

	if ((first === "c" || first === "share") && second !== undefined) {
		let conversation = findConversation(second);
		if (conversation === undefined) return null;
		let thread = savedThread(conversation, model);
		if (first === "share") {
			return { title: `${conversation.title} (shared)`, body: <ShareScreen thread={thread} /> };
		}
		return chatScreen(thread, request);
	}

	if (first === "search" && second === undefined) {
		return {
			title: "Search chats",
			body: <SearchScreen query={url.searchParams.get("q") ?? ""} collapsed={collapsed} />,
		};
	}

	if (first === "projects" && second !== undefined) {
		let project = findProject(second);
		return project
			? { title: project.name, body: <ProjectScreen project={project} collapsed={collapsed} /> }
			: null;
	}

	if (first === "settings") {
		let settingsPage = SETTINGS_PAGES.find((candidate) => candidate === second);
		if (second !== undefined && settingsPage === undefined) return null;
		return {
			title: "Settings",
			body: <SettingsScreen collapsed={collapsed} page={settingsPage ?? null} />,
		};
	}

	return null;
}

/** Answers one of Tern's frames: the canvas, a project's files, or this month's usage. */
function framePart(part: string): RemixNode | null {
	let [first = "", second, third, ...rest] = part.split("/");
	if (rest.length > 0) return null;
	if (first === "canvas" && second !== undefined && third === undefined) {
		let conversation = findConversation(second);
		return conversation?.canvas ? <CanvasPane conversation={conversation} /> : null;
	}
	if (first === "projects" && second !== undefined && third === "files") {
		let project = findProject(second);
		return project ? <ProjectFiles project={project} /> : null;
	}
	if (first === "settings" && second === "usage" && third === undefined) return <UsagePanel />;
	return null;
}

/** The text of a form field, or `""` when it is missing or a file. */
function field(form: FormData, name: string): string {
	let value = form.get(name);
	return typeof value === "string" ? value : "";
}

/** The names of the files a send attached, leaving out an empty file input. */
function fileNames(form: FormData): string[] {
	return form
		.getAll("files")
		.flatMap((value) => (typeof value !== "string" && value.name !== "" ? [value.name] : []));
}

/** Reads the turn index an intent such as `regenerate-3` names. */
function turnIndex(intent: string, prefix: string): number | null {
	if (!intent.startsWith(prefix)) return null;
	let index = Number(intent.slice(prefix.length));
	return Number.isInteger(index) && index >= 0 ? index : null;
}

/**
 * Answers a form posted on a conversation. A send, a regenerate or an edit answers with the
 * page and its reply to replay; on a saved chat with no sends, feedback and the model picker
 * redirect to an address that caches, and on any other they answer with the page again.
 */
function submitChat(
	base: Conversation | null,
	form: FormData,
	request: DemoAppRequest,
): DemoAppRedirect | DemoAppScreen | null {
	let thread = readThread(base, form.get(THREAD_FIELD), form.get("model"));
	let intent = field(form, "intent");
	let page = base === null ? "" : `c/${base.id}`;
	let last = (next: Thread) => turnsOf(next).length - 1;

	if (intent === "send") {
		let prompt = field(form, "prompt").trim();
		if (prompt === "")
			return isSaved(thread) || base === null ? { page } : chatScreen(thread, request);
		let next = send(thread, prompt, fileNames(form));
		return chatScreen(next, request, last(next));
	}

	let regenerated = turnIndex(intent, "regenerate-");
	if (regenerated !== null) {
		let next = regenerate(thread, regenerated);
		return next === null ? null : chatScreen(next, request, last(next));
	}

	let edited = turnIndex(intent, "edit-");
	if (edited !== null) {
		let next = edit(thread, edited, field(form, "prompt"));
		return next === null ? null : chatScreen(next, request, last(next));
	}

	if (turnIndex(intent, "rate-") !== null) {
		return isSaved(thread) ? { page, toast: "feedback" } : chatScreen(thread, request);
	}

	if (intent.startsWith("model-")) {
		let model = MODELS.find((candidate) => `model-${candidate.id}` === intent);
		if (model === undefined) return null;
		let next = { ...thread, model: findModel(model.id).id };
		return isSaved(thread) ? { page: `${page}?model=${model.id}` } : chatScreen(next, request);
	}

	if (base === null) return null;
	if (intent === "pin" || intent === "unpin") return { page, toast: `${intent}ned` };
	if (intent === "delete") return { page: "", toast: `deleted-${base.id}` };
	if (intent === "restore") return { page, toast: "restored" };
	return null;
}

/** Answers a settings form; a switch names its new state in the toast. */
function submitSettings(settingsPage: string, form: FormData): DemoAppRedirect | null {
	let section = field(form, "section");
	let page = `settings/${settingsPage}`;
	if (settingsPage === "general" && section === "general")
		return { page, toast: "preferences-saved" };
	if (settingsPage === "personalization" && section === "about")
		return { page, toast: "about-saved" };
	if (settingsPage === "personalization" && section === "memory") {
		return { page, toast: field(form, "memory") === "" ? "memory-off" : "memory-on" };
	}
	if (settingsPage === "data" && section === "training") {
		return { page, toast: field(form, "training") === "" ? "training-off" : "training-on" };
	}
	if (settingsPage === "data" && section === "export") return { page, toast: "export-started" };
	if (settingsPage === "data" && section === "delete-all") {
		return field(form, "confirmation") === "delete my chats"
			? { page: "", toast: "chats-deleted" }
			: { page };
	}
	return null;
}

/**
 * Tern as the gallery and `/demo/apps/tern` read it: its theme, every screen, its frames,
 * and how each form answers.
 */
export default {
	name: "Tern",
	kind: "Chat assistant",
	tagline: "An AI assistant with projects, a canvas and three models.",
	artDirection: "Dusk violet on lavender grey, a rounded face, a pill composer.",
	description:
		"Tern, an invented chat assistant: conversations with streamed replies, code and tables, projects, a canvas, sharing and settings.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: () => <TernThumbnail />,
	screens: SCREENS,
	cookies: [SHELL_COOKIE, SPLIT_COOKIE],
	toasts: TOASTS,
	frame: (part) => framePart(part),
	render(request) {
		return route(request) ?? notFound(readAppShellCookie(request.cookie, SHELL_COOKIE));
	},
	submit(page, form, request) {
		let [first = "", second, ...rest] = page.split("/");
		if (rest.length > 0) return null;
		if (first === "chat" && second === undefined) return submitChat(null, form, request);
		if (first === "c" && second !== undefined) {
			let conversation = findConversation(second);
			return conversation ? submitChat(conversation, form, request) : null;
		}
		if (first === "settings" && second !== undefined) return submitSettings(second, form);
		return null;
	},
} satisfies DemoApp;
