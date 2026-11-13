/**
 * Runs Tern's document under the browser runtime with its shell's sync island and follows its
 * links and forms: each reloads the main frame alone, the shell stays the same element, the
 * document never loads again, actions add no history, and Back and Forward restore the pane.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { Toasts } from "@sdxc/ui/app/toasts";
import { run } from "remix/component";
import { renderToStream } from "remix/component/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { MAIN_FRAME } from "~/resources/views/demo-apps/main-frame";
import tern from "~/resources/views/demo-apps/tern";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** Where Tern lives, the prefix every page path sits under. */
const ROOT = "/demo/apps/tern";

/** The package islands Tern's pages hydrate, by the module id their markup names. */
const MODULES: Record<string, () => Promise<object>> = {
	"@sdxc/ui/app/app-shell-toggle": () => import("@sdxc/ui/app/app-shell-toggle"),
	"@sdxc/ui/app/command-palette": () => import("@sdxc/ui/app/command-palette"),
	"@sdxc/ui/app/keyboard-help": () => import("@sdxc/ui/app/keyboard-help"),
	"@sdxc/ui/app/optimistic-toggle": () => import("@sdxc/ui/app/optimistic-toggle"),
	"@sdxc/ui/app/split-view": () => import("@sdxc/ui/app/split-view"),
	"@sdxc/ui/chat/composer-submit": () => import("@sdxc/ui/chat/composer-submit"),
	"@sdxc/ui/app/save-bar": () => import("@sdxc/ui/app/save-bar"),
	"@sdxc/ui/app/settings-section": () => import("@sdxc/ui/app/settings-section"),
	"@sdxc/ui/confirm": () => import("@sdxc/ui/confirm"),
	"@sdxc/ui/docs/copy-button": () => import("@sdxc/ui/docs/copy-button"),
	"@sdxc/ui/app/toasts": () => import("@sdxc/ui/app/toasts"),
};

/** One request the runtime sent for a frame: where to, for which frame, and how. */
interface FrameRequest {
	src: string;
	target: string | undefined;
	method: string;
}

/** The address the test page had before a navigation moved it. */
let home = `${location.pathname}${location.search}`;

/** The running app, disposed after each test so its listeners never outlive it. */
let app: ReturnType<typeof run> | undefined;

afterEach(async () => {
	app?.dispose();
	app = undefined;
	document.body.innerHTML = "";
	history.replaceState(null, "", home);
	await page.viewport(1280, 800);
});

/** The request Tern reads a page path with, as the server builds it. */
function requestFor(src: string) {
	let url = new URL(src, location.origin);
	let pagePath = url.pathname.slice(ROOT.length).replace(/^\//, "");
	return { page: pagePath, url, cookie: null };
}

/**
 * Server-renders a node to the end, resolving the frames inside it the way the page's server
 * does, as the browser receives a page or a frame's answer.
 */
async function html(node: RemixNode, frameSrc?: string): Promise<string> {
	let stream = renderToStream(node, {
		frameSrc,
		resolveFrame: (src, target) => answer(src, target),
	});
	return await new Response(stream).text();
}

/**
 * What a post answers: the named frame's content when aimed at one, the whole page otherwise,
 * or, for a post that redirects, the screen it lands on with its toast, as the browser's fetch
 * follows the `303` with the same headers.
 */
async function answerPost(
	request: ReturnType<typeof requestFor>,
	form: FormData,
	target: string | undefined,
): Promise<string> {
	let answered = tern.submit(request.page, form, request);
	if (answered === null) return "";
	if ("body" in answered) {
		return await html(target === undefined ? answered.body : answered.frames?.[target]);
	}
	let landing = new URL(answered.page === "" ? ROOT : `${ROOT}/${answered.page}`, location.origin);
	if (answered.toast !== undefined) landing.searchParams.set("toast", answered.toast);
	return await answer(`${landing.pathname}${landing.search}`, target);
}

/**
 * Answers a frame request the way Tern's routes do: a part under `frames/` answers that part, a
 * `GET` aimed at the main frame its pane, a post aimed at it the pane its answer names, and
 * anything else the whole page.
 */
async function answer(src: string, target: string | undefined, form?: FormData): Promise<string> {
	let request = requestFor(src);
	let part = request.url.pathname.split(`${ROOT}/frames/`)[1];
	if (part !== undefined) return await html(tern.frame(part));
	if (form !== undefined) return await answerPost(request, form, target);
	if (target !== undefined) return await html(tern.target(target, request));
	return await html(tern.render(request).body);
}

/**
 * Server-renders the page at `path` with its main frame filled in, puts it in the document and
 * starts the runtime, recording every frame request it sends.
 */
async function open(path: string): Promise<FrameRequest[]> {
	let src = `${ROOT}/${path}`;
	history.replaceState(null, "", src);
	let screen = tern.render(requestFor(src));
	document.body.innerHTML = await html(
		<>
			{screen.body}
			<Toasts labels={{ region: "Notifications", dismiss: "Dismiss" }} initial={[]} />
		</>,
		src,
	);

	let requests: FrameRequest[] = [];
	app = run({
		async loadModule(moduleUrl, exportName) {
			let load = moduleUrl.endsWith("/main-frame-sync.tsx")
				? () => import("~/resources/views/demo-apps/main-frame-sync")
				: MODULES[moduleUrl];
			if (load === undefined) throw new Error(`No island module for ${moduleUrl}`);
			return Reflect.get(await load(), exportName);
		},
		async resolveFrame(frameSrc, options) {
			let method = (options?.method ?? "GET").toUpperCase();
			let url = new URL(frameSrc, location.origin);
			requests.push({ src: `${url.pathname}${url.search}`, target: options?.target, method });
			let body = await answer(
				frameSrc,
				options?.target,
				method === "GET" ? undefined : options?.formData,
			);
			return new Response(body, { headers: { "Content-Type": "text/html" } });
		},
	});
	await app.ready();
	return requests;
}

/** The sidebar, which a navigation aimed at the main frame keeps as the same element. */
function sidebar(): HTMLElement {
	return document.querySelector<HTMLElement>('[data-slot="app-shell-sidebar"]')!;
}

/** The turns the chat log shows. */
function turns(): number {
	return document.querySelectorAll('[data-message-id^="turn-"]').length;
}

/** Types a message into the composer and sends it, the way Enter does. */
function send(text: string) {
	let field = document.querySelector<HTMLTextAreaElement>('[data-slot="composer-input"]')!;
	field.value = text;
	field.form!.requestSubmit();
}

/** Waits until `count` frame requests went out and the last one's content is in place. */
async function settled(requests: FrameRequest[], count: number, text: string) {
	await vi.waitFor(() => {
		expect(requests).toHaveLength(count);
		expect(document.querySelector("main")?.textContent).toContain(text);
	});
}

describe("Tern reloads only its main frame", () => {
	test("a chat in the history opens in the pane, leaving the sidebar in place", async () => {
		let requests = await open("c/lisbon-offsite");
		let before = sidebar();
		before.dataset.probe = "kept";

		document.querySelector<HTMLAnchorElement>(`a[href="${ROOT}/c/flaky-test"]`)!.click();

		await settled(requests, 1, "flaky");
		expect(requests[0]).toEqual({ src: `${ROOT}/c/flaky-test`, target: MAIN_FRAME, method: "GET" });
		expect(sidebar()).toBe(before);
		expect(sidebar().dataset.probe).toBe("kept");
		expect(location.pathname).toBe(`${ROOT}/c/flaky-test`);
		await vi.waitFor(() =>
			expect(
				document.querySelector(`a[href="${ROOT}/c/flaky-test"]`)?.getAttribute("aria-current"),
			).toBe("page"),
		);
		expect(
			document.querySelector(`a[href="${ROOT}/c/lisbon-offsite"]`)?.hasAttribute("aria-current"),
		).toBe(false);
	});

	test("sending messages posts each into the pane, carrying the chat so far", async () => {
		let requests = await open("c/lisbon-offsite");
		let before = sidebar();
		let saved = turns();

		send("What should we pack for the trip?");
		await settled(requests, 1, "What should we pack for the trip?");
		expect(requests[0]).toMatchObject({ target: MAIN_FRAME, method: "POST" });
		await vi.waitFor(() => expect(turns()).toBe(saved + 2));

		send("And what about the weather?");
		await settled(requests, 2, "And what about the weather?");
		await vi.waitFor(() => expect(turns()).toBe(saved + 4));
		expect(document.querySelector("main")?.textContent).toContain(
			"What should we pack for the trip?",
		);
		expect(requests[1]).toMatchObject({ target: MAIN_FRAME, method: "POST" });
		expect(sidebar()).toBe(before);
	});

	test("opening and closing the canvas reloads the pane", async () => {
		let requests = await open("c/debounce-search");
		let before = sidebar();

		document
			.querySelector<HTMLAnchorElement>(`main a[href="${ROOT}/c/debounce-search?canvas=open"]`)!
			.click();
		await vi.waitFor(() => expect(document.querySelector("#tern-canvas-title")).not.toBeNull());
		expect(requests[0]).toMatchObject({
			src: `${ROOT}/c/debounce-search?canvas=open`,
			target: MAIN_FRAME,
		});

		document.querySelector<HTMLAnchorElement>('a[aria-label="Close canvas"]')!.click();
		await vi.waitFor(() => expect(document.querySelector("#tern-canvas-title")).toBeNull());
		for (let request of requests) {
			expect(request.target === MAIN_FRAME || request.src.includes("/frames/"), request.src).toBe(
				true,
			);
		}
		expect(sidebar()).toBe(before);
	});

	test("a settings section and a search swap the pane", async () => {
		let requests = await open("settings/general");
		let before = sidebar();

		document.querySelector<HTMLAnchorElement>(`main a[href="${ROOT}/settings/data"]`)!.click();
		await settled(requests, 1, "Delete all chats");
		expect(requests[0]).toMatchObject({ src: `${ROOT}/settings/data`, target: MAIN_FRAME });

		document.querySelector<HTMLAnchorElement>(`a[href="${ROOT}/search"]`)!.click();
		await settled(requests, 2, "Search chats");
		let search = document.querySelector<HTMLFormElement>('main form[role="search"]')!;
		search.querySelector<HTMLInputElement>('input[name="q"]')!.value = "email";
		search.requestSubmit();
		await vi.waitFor(() => expect(requests).toHaveLength(3));
		expect(requests[2]).toMatchObject({ src: `${ROOT}/search?q=email`, target: MAIN_FRAME });
		expect(sidebar()).toBe(before);
	});

	test("the model picker switches the model in the pane", async () => {
		let requests = await open("c/lisbon-offsite");

		document
			.querySelector<HTMLAnchorElement>(`a[href="${ROOT}/c/lisbon-offsite?model=dive"]`)!
			.click();

		await vi.waitFor(() => expect(requests).toHaveLength(1));
		expect(requests[0]).toMatchObject({ target: MAIN_FRAME, method: "GET" });
		await vi.waitFor(() =>
			expect(document.querySelector('[aria-label^="Model:"]')?.getAttribute("aria-label")).toBe(
				"Model: Tern Dive",
			),
		);
	});
});

describe("Tern works like a single-page app", () => {
	/** The page loads the document had, which a swap of the main frame never adds to. */
	function documentLoads(): number {
		return performance.getEntriesByType("navigation").length;
	}

	/** The shell element a test marks, which only a whole-page render would replace. */
	function shell(): HTMLElement {
		return document.querySelector<HTMLElement>('[data-slot="app-shell"]')!;
	}

	/** The toast region's text. */
	function toasts(): string {
		return document.querySelector('[aria-label="Notifications"]')?.textContent ?? "";
	}

	test("moving between screens keeps the shell, adds one history entry each, and moves focus", async () => {
		let requests = await open("c/lisbon-offsite");
		let loads = documentLoads();
		let entries = navigation.entries().length;
		Reflect.set(shell(), "probe", "kept");

		document.querySelector<HTMLAnchorElement>(`a[href="${ROOT}/c/flaky-test"]`)!.click();
		await settled(requests, 1, "flaky");
		document.querySelector<HTMLAnchorElement>(`a[href="${ROOT}/projects/harbor-site"]`)!.click();
		await settled(requests, 2, "Harbor site relaunch");

		expect(Reflect.get(shell(), "probe")).toBe("kept");
		expect(documentLoads()).toBe(loads);
		expect(navigation.entries().length).toBe(entries + 2);
		expect(requests.every((request) => request.target === MAIN_FRAME)).toBe(true);
		await vi.waitFor(() => {
			expect(document.activeElement?.tagName).toBe("H1");
			expect(document.activeElement?.textContent).toContain("Harbor site relaunch");
			expect(document.querySelector("[data-main-announcer]")?.textContent).toContain(
				"Harbor site relaunch",
			);
		});
		expect(document.title).toContain("Harbor site relaunch");
	});

	test("Back and Forward bring each screen back in the pane, with its scroll", async () => {
		await page.viewport(1280, 480);
		let requests = await open("settings/general");
		let scroller = document.querySelector<HTMLElement>('[data-slot="app-shell-content"]')!;
		Reflect.set(shell(), "probe", "kept");

		document.querySelector<HTMLAnchorElement>(`main a[href="${ROOT}/settings/data"]`)!.click();
		await settled(requests, 1, "Delete all chats");
		scroller.scrollTop = 200;
		let kept = scroller.scrollTop;
		expect(kept).toBeGreaterThan(0);

		document
			.querySelector<HTMLAnchorElement>(`main a[href="${ROOT}/settings/personalization"]`)!
			.click();
		await settled(requests, 2, "Memory");
		await vi.waitFor(() => expect(scroller.scrollTop).toBe(0));

		navigation.back();
		await vi.waitFor(() => {
			expect(location.pathname).toBe(`${ROOT}/settings/data`);
			expect(document.querySelector("main")?.textContent).toContain("Delete all chats");
		});
		await vi.waitFor(() => expect(scroller.scrollTop).toBe(kept));

		navigation.forward();
		await vi.waitFor(() => {
			expect(location.pathname).toBe(`${ROOT}/settings/personalization`);
			expect(document.querySelector("main")?.textContent).toContain("Memory");
		});
		expect(Reflect.get(shell(), "probe")).toBe("kept");
		expect(requests.every((request) => request.target === MAIN_FRAME)).toBe(true);
	});

	test("sending adds no history entry, and the reply streams with Stop", async () => {
		let requests = await open("c/lisbon-offsite");
		let entries = navigation.entries().length;
		let field = document.querySelector<HTMLTextAreaElement>('[data-slot="composer-input"]')!;

		send("What should we pack for the trip?");

		await vi.waitFor(() =>
			expect(document.querySelector('[data-slot="composer-stop"]')).not.toBeNull(),
		);
		expect(field.isConnected ? field.value : "").toBe("");
		await vi.waitFor(
			() =>
				expect(document.querySelector("[data-stream-end]")?.getAttribute("data-stream-end")).toBe(
					"done",
				),
			{ timeout: 15000 },
		);
		expect(navigation.entries().length).toBe(entries);
		expect(requests).toHaveLength(1);
		expect(location.pathname).toBe(`${ROOT}/c/lisbon-offsite`);
	});

	test("pinning shows its toast in place, with no navigation", async () => {
		let requests = await open("c/lisbon-offsite");
		let entries = navigation.entries().length;
		Reflect.set(shell(), "probe", "kept");

		document
			.querySelector<HTMLButtonElement>(
				'#tern-chat-menu button[value="unpin"], #tern-chat-menu button[value="pin"]',
			)!
			.click();

		await vi.waitFor(() => expect(toasts()).toMatch(/Chat (un)?pinned/));
		expect(requests).toHaveLength(1);
		expect(requests[0]).toMatchObject({ method: "POST", target: MAIN_FRAME });
		expect(navigation.entries().length).toBe(entries);
		expect(Reflect.get(shell(), "probe")).toBe("kept");
	});

	test("deleting a chat lands on a new chat with Undo, which brings it back", async () => {
		let requests = await open("c/flaky-test");
		Reflect.set(shell(), "probe", "kept");

		document.querySelector<HTMLButtonElement>('#tern-chat-menu button[value="delete"]')!.click();
		await vi.waitFor(() => expect(toasts()).toContain("Chat deleted"));
		await vi.waitFor(() => expect(location.pathname).toBe(ROOT));
		expect(document.querySelector("main h1")?.textContent).toContain("Good");

		[...document.querySelectorAll<HTMLButtonElement>('[aria-label="Notifications"] button')]
			.find((button) => button.textContent?.includes("Undo"))!
			.click();
		await vi.waitFor(() => expect(toasts()).toContain("Chat restored"));
		await vi.waitFor(() => expect(location.pathname).toBe(`${ROOT}/c/flaky-test`));
		expect(Reflect.get(shell(), "probe")).toBe("kept");
		expect(requests.every((request) => request.target === MAIN_FRAME)).toBe(true);
	});

	test("sharing opens the link in a dialog, without leaving the chat", async () => {
		let requests = await open("c/lisbon-offsite");

		document.querySelector<HTMLButtonElement>('button[commandfor="tern-share"]')!.click();

		let dialog = document.querySelector<HTMLDialogElement>("#tern-share")!;
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		expect(dialog.textContent).toContain("/demo/apps/tern/share/lisbon-offsite");
		expect(requests).toHaveLength(0);
	});
});
