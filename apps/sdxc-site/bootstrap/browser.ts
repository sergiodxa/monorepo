/**
 * Client runtime entry point. Pages are server-rendered HTML and the runtime hydrates their
 * islands, each loaded from the chunk the renderer named for its `clientEntry(import.meta.url)`
 * identity, so adding an island is only a matter of writing it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RunInit } from "remix/component";

import { run } from "remix/component";

/**
 * Keeps a reader on the page when they press a link or submit a form inside a live example:
 * those name `/examples/` addresses, and the navigation is cancelled before the runtime
 * reloads the page from one. Registered ahead of `run()`, so it sees each navigation first.
 */
function stayOnExampleNavigation(event: NavigateEvent) {
	if (!event.cancelable) return;
	if (!new URL(event.destination.url).pathname.startsWith("/examples/")) return;
	event.preventDefault();
	event.stopImmediatePropagation();
}

globalThis.navigation?.addEventListener("navigate", stayOnExampleNavigation);

/**
 * Islands shipped by packages, keyed by the bare specifier their client entry names. The
 * renderer writes that specifier as it is, and the browser resolves only URLs, so each one is
 * imported here where the bundler can resolve it.
 */
const PACKAGE_MODULES: Record<string, () => Promise<unknown>> = {
	"@sdxc/ui/app/app-shell-toggle": () => import("@sdxc/ui/app/app-shell-toggle"),
	"@sdxc/ui/app/auto-refresh": () => import("@sdxc/ui/app/auto-refresh"),
	"@sdxc/ui/app/board": () => import("@sdxc/ui/app/board"),
	"@sdxc/ui/app/code-view": () => import("@sdxc/ui/app/code-view"),
	"@sdxc/ui/app/command-palette": () => import("@sdxc/ui/app/command-palette"),
	"@sdxc/ui/app/contribution-graph": () => import("@sdxc/ui/app/contribution-graph"),
	"@sdxc/ui/app/detail-sheet": () => import("@sdxc/ui/app/detail-sheet"),
	"@sdxc/ui/app/diff": () => import("@sdxc/ui/app/diff"),
	"@sdxc/ui/app/filter-bar": () => import("@sdxc/ui/app/filter-bar"),
	"@sdxc/ui/app/filter-menu": () => import("@sdxc/ui/app/filter-menu"),
	"@sdxc/ui/app/keyboard-help": () => import("@sdxc/ui/app/keyboard-help"),
	"@sdxc/ui/app/log-viewer": () => import("@sdxc/ui/app/log-viewer"),
	"@sdxc/ui/app/optimistic-toggle": () => import("@sdxc/ui/app/optimistic-toggle"),
	"@sdxc/ui/app/gantt": () => import("@sdxc/ui/app/gantt"),
	"@sdxc/ui/app/save-bar": () => import("@sdxc/ui/app/save-bar"),
	"@sdxc/ui/app/save-status": () => import("@sdxc/ui/app/save-status"),
	"@sdxc/ui/app/selection-bar": () => import("@sdxc/ui/app/selection-bar"),
	"@sdxc/ui/app/settings-section": () => import("@sdxc/ui/app/settings-section"),
	"@sdxc/ui/app/split-view": () => import("@sdxc/ui/app/split-view"),
	"@sdxc/ui/app/status-strip": () => import("@sdxc/ui/app/status-strip"),
	"@sdxc/ui/app/table": () => import("@sdxc/ui/app/table"),
	"@sdxc/ui/app/toasts": () => import("@sdxc/ui/app/toasts"),
	"@sdxc/ui/app/tree": () => import("@sdxc/ui/app/tree"),
	"@sdxc/ui/character-count": () => import("@sdxc/ui/character-count"),
	"@sdxc/ui/chat/composer-submit": () => import("@sdxc/ui/chat/composer-submit"),
	"@sdxc/ui/confirm": () => import("@sdxc/ui/confirm"),
	"@sdxc/ui/dialog-dismiss": () => import("@sdxc/ui/dialog-dismiss"),
	"@sdxc/ui/docs/code-tabs-sync": () => import("@sdxc/ui/docs/code-tabs-sync"),
	"@sdxc/ui/docs/copy-button": () => import("@sdxc/ui/docs/copy-button"),
	"@sdxc/ui/docs/docs-nav-tools": () => import("@sdxc/ui/docs/docs-nav-tools"),
	"@sdxc/ui/docs/page-actions": () => import("@sdxc/ui/docs/page-actions"),
	"@sdxc/ui/docs/table-of-contents": () => import("@sdxc/ui/docs/table-of-contents"),
	"@sdxc/ui/landing/episode-player": () => import("@sdxc/ui/landing/episode-player"),
	"@sdxc/ui/landing/countdown": () => import("@sdxc/ui/landing/countdown"),
	"@sdxc/ui/relative-time": () => import("@sdxc/ui/relative-time"),
	"@sdxc/ui/video/video-player": () => import("@sdxc/ui/video/video-player"),
};

/**
 * How long a page fetched ahead of a click stays usable. Navigations otherwise revalidate
 * every page, so a short window keeps a prefetched copy from outliving the content it shows.
 */
const PREFETCH_LIFETIME_MS = 30_000;

/** Pages fetched ahead of a navigation, keyed by address and frame target, each used once. */
const PREFETCHED = new Map<string, { response: Promise<Response>; at: number }>();

/** The key a prefetched page is stored under: its address without the fragment, and its target. */
function prefetchKey(src: string, target?: string): string {
	let url = new URL(src, globalThis.document?.baseURI);
	url.hash = "";
	return JSON.stringify([url.href, target ?? null]);
}

/**
 * Takes the page fetched ahead for a `GET` navigation, if one is still fresh. Any submission
 * empties the store, since it may change what every stored page shows.
 */
function takePrefetched(src: string, options?: FrameOptions): Promise<Response> | undefined {
	if ((options?.method ?? "GET").toUpperCase() !== "GET") {
		PREFETCHED.clear();
		return undefined;
	}
	let key = prefetchKey(src, options?.target);
	let entry = PREFETCHED.get(key);
	PREFETCHED.delete(key);
	if (entry === undefined || Date.now() - entry.at > PREFETCH_LIFETIME_MS) return undefined;
	return entry.response;
}

/** The options the runtime passes when it resolves a frame. */
type FrameOptions = Parameters<NonNullable<RunInit["resolveFrame"]>>[1];

/**
 * Sends a submission under the form's declared encoding, coercing a file entry to its
 * filename for a urlencoded body, and returns the response as-is so the frame can
 * read its redirect target.
 */
async function fetchFrame(
	src: string,
	options: FrameOptions,
	priority: RequestPriority = "auto",
): Promise<Response> {
	let { target, signal, method, formData, encType } = options ?? {};

	let headers = new Headers({ accept: "text/html", "x-remix-frame": "true" });
	if (target) headers.set("x-remix-target", target);

	let body =
		formData && encType === "application/x-www-form-urlencoded"
			? new URLSearchParams(
					Array.from(formData, ([key, value]) => [key, value instanceof File ? value.name : value]),
				)
			: formData;

	return await fetch(src, {
		credentials: "same-origin",
		cache: "no-cache",
		headers,
		signal,
		method,
		body,
		priority,
	});
}

/**
 * Boots the client runtime and resolves lazily loaded UI modules.
 */
run({
	async loadModule(moduleUrl, exportName) {
		let load = PACKAGE_MODULES[moduleUrl];
		let mod: unknown = load ? await load() : await import(moduleUrl);

		if (!mod || typeof mod !== "object") {
			throw new Error(`Invalid client entry module: ${moduleUrl}`);
		}

		let entry = Reflect.get(mod, exportName);

		if (typeof entry !== "function") {
			throw new Error(`Missing client entry export ${exportName} in ${moduleUrl}`);
		}

		return entry;
	},

	/**
	 * Fetches a page a link marked `data-rmx-prefetch` is likely to open and keeps it briefly,
	 * so the navigation that follows renders without waiting on the network.
	 */
	prefetch(src, options) {
		let response = fetchFrame(src, { target: options?.target }, "low");
		response.catch(() => PREFETCHED.delete(prefetchKey(src, options?.target)));
		PREFETCHED.set(prefetchKey(src, options?.target), { response, at: Date.now() });
	},

	/** Resolves a frame from a fresh prefetched page when there is one, and fetches it otherwise. */
	async resolveFrame(src, options) {
		let prefetched = takePrefetched(src, options);
		if (prefetched !== undefined) {
			try {
				return await prefetched;
			} catch {
				return await fetchFrame(src, options);
			}
		}
		return await fetchFrame(src, options);
	},
});
