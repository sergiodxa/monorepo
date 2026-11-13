/**
 * A browser-test harness that runs one demo app the way a visitor's browser does, without a
 * server: the page is the app's own server render, the client runtime hydrates it, and every
 * frame request is answered from the app's `target`, `render` and `submit`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppRuntime, RemixNode } from "remix/component";

import { pageToaster } from "@sdxc/ui/app/toast";
import { Toasts } from "@sdxc/ui/app/toasts";
import { run } from "remix/component";
import { renderToStream } from "remix/component/server";

import type { DemoApp, DemoAppRequest } from "~/resources/views/demo-apps";

import { DEMO_APP_TOAST_PARAM, demoAppHref, readToastParam } from "~/resources/views/demo-apps";

/**
 * Every island module the demo apps hydrate, keyed by the id the renderer names it by:
 * `@sdxc/ui` islands by their package specifier, app islands by their path from the app root.
 * Each loads through the same specifier the app imports it by, so hydration reuses the module.
 */
const MODULES: Record<string, () => Promise<Record<string, unknown>>> = {
	"@sdxc/ui/app/app-shell-toggle": () => import("@sdxc/ui/app/app-shell-toggle"),
	"@sdxc/ui/app/auto-refresh": () => import("@sdxc/ui/app/auto-refresh"),
	"@sdxc/ui/app/board": () => import("@sdxc/ui/app/board"),
	"@sdxc/ui/app/command-palette": () => import("@sdxc/ui/app/command-palette"),
	"@sdxc/ui/app/detail-sheet": () => import("@sdxc/ui/app/detail-sheet"),
	"@sdxc/ui/app/filter-bar": () => import("@sdxc/ui/app/filter-bar"),
	"@sdxc/ui/app/gantt": () => import("@sdxc/ui/app/gantt"),
	"@sdxc/ui/app/keyboard-help": () => import("@sdxc/ui/app/keyboard-help"),
	"@sdxc/ui/app/optimistic-toggle": () => import("@sdxc/ui/app/optimistic-toggle"),
	"@sdxc/ui/app/save-bar": () => import("@sdxc/ui/app/save-bar"),
	"@sdxc/ui/app/save-status": () => import("@sdxc/ui/app/save-status"),
	"@sdxc/ui/app/selection-bar": () => import("@sdxc/ui/app/selection-bar"),
	"@sdxc/ui/app/settings-section": () => import("@sdxc/ui/app/settings-section"),
	"@sdxc/ui/app/split-view": () => import("@sdxc/ui/app/split-view"),
	"@sdxc/ui/app/status-strip": () => import("@sdxc/ui/app/status-strip"),
	"@sdxc/ui/app/table": () => import("@sdxc/ui/app/table"),
	"@sdxc/ui/app/toasts": () => import("@sdxc/ui/app/toasts"),
	"@sdxc/ui/character-count": () => import("@sdxc/ui/character-count"),
	"@sdxc/ui/chat/composer-submit": () => import("@sdxc/ui/chat/composer-submit"),
	"@sdxc/ui/confirm": () => import("@sdxc/ui/confirm"),
	"@sdxc/ui/dialog-dismiss": () => import("@sdxc/ui/dialog-dismiss"),
	"@sdxc/ui/docs/code-tabs-sync": () => import("@sdxc/ui/docs/code-tabs-sync"),
	"@sdxc/ui/docs/copy-button": () => import("@sdxc/ui/docs/copy-button"),
	"@sdxc/ui/docs/docs-nav-tools": () => import("@sdxc/ui/docs/docs-nav-tools"),
	"@sdxc/ui/docs/page-actions": () => import("@sdxc/ui/docs/page-actions"),
	"@sdxc/ui/docs/table-of-contents": () => import("@sdxc/ui/docs/table-of-contents"),
	"@sdxc/ui/relative-time": () => import("@sdxc/ui/relative-time"),
	"file:resources/views/demo-apps/main-frame-sync.tsx": () =>
		import("~/resources/views/demo-apps/main-frame-sync"),
	"file:resources/views/demo-apps/pulse/services-table.tsx": () =>
		import("~/resources/views/demo-apps/pulse/services-table"),
};

/** A running app: its runtime, and the count of whole-document loads, which stays at one. */
export interface MountedApp {
	runtime: AppRuntime;
	/** Every page request the harness answered, as `METHOD path target`, oldest first. */
	requests: string[];
	dispose: () => void;
}

/** A rendered stream as the HTML response the runtime's own fetch would hand it. */
async function asResponse(stream: ReadableStream<Uint8Array>): Promise<Response> {
	return new Response(await text(stream), { headers: { "Content-Type": "text/html" } });
}

/** Reads a rendered stream whole. */
async function text(stream: ReadableStream<Uint8Array>): Promise<string> {
	return await new Response(stream).text();
}

/**
 * Mounts a demo app at one of its screens and hydrates it, answering every frame request
 * the runtime makes from the app itself.
 *
 * @param app - The demo app.
 * @param slug - Its folder name, which its addresses start from.
 * @param page - The screen to open, with its query.
 * @returns The running app.
 */
export async function mountApp(app: DemoApp, slug: string, page: string): Promise<MountedApp> {
	let root = demoAppHref(slug)();
	let requests: string[] = [];

	/** The request a demo screen reads, built from an address under the app. */
	function requestFor(address: string): DemoAppRequest {
		let url = new URL(address, location.origin);
		let param = url.searchParams.get(DEMO_APP_TOAST_PARAM);
		if (param !== null) url.searchParams.set(DEMO_APP_TOAST_PARAM, readToastParam(param).key);
		let page = url.pathname === root ? "" : url.pathname.slice(root.length + 1);
		return { page, url, cookie: null };
	}

	/**
	 * Renders what a frame request for `address` answers: one named frame, or the whole screen,
	 * as a document when the runtime asks for the top frame.
	 */
	async function answer(
		address: string,
		target?: string,
		whole = true,
	): Promise<ReadableStream<Uint8Array>> {
		let request = requestFor(address);
		let part = request.url.pathname.split(`${root}/frames/`)[1];
		if (part !== undefined) {
			let content = await app.frame?.(part, { ...request, page: part });
			return renderToStream(content ?? null, {
				frameSrc: address,
				resolveFrame: (src, name) => answer(src, name, false),
			});
		}
		let node: RemixNode | null | undefined =
			target === undefined ? null : await app.target?.(target, request);
		if (node === null || node === undefined) {
			let screen = await app.render(request);
			let body = (
				<>
					{screen.body}
					<Toasts labels={{ region: "Notifications", dismiss: "Dismiss" }} initial={[]} />
				</>
			);
			node = !whole ? (
				body
			) : (
				<html lang="en">
					<head>
						<title>{screen.title}</title>
					</head>
					<body>{body}</body>
				</html>
			);
		}
		return renderToStream(node, {
			frameSrc: request.url.href,
			resolveFrame: (src, name) => answer(src, name, false),
		});
	}

	history.replaceState(null, "", demoAppHref(slug)(page));
	let raw = await text(await answer(location.href));
	let rendered = new DOMParser().parseFromString(raw, "text/html");
	document.body.innerHTML = rendered.body.innerHTML;
	for (let script of document.body.querySelectorAll("script")) {
		if (script.type === "application/json" || script.src !== "") continue;
		let live = document.createElement("script");
		for (let attribute of script.attributes) live.setAttribute(attribute.name, attribute.value);
		live.textContent = script.textContent;
		script.replaceWith(live);
	}

	let runtime = run({
		loadModule: async (moduleUrl, exportName) => {
			let load = MODULES[moduleUrl];
			if (load === undefined) throw new Error(`No island module ${moduleUrl}`);
			return (await load())[exportName] as never;
		},
		resolveFrame: async (src, options) => {
			let method = (options?.method ?? "GET").toUpperCase();
			let url = new URL(src, location.origin);
			requests.push(`${method} ${url.pathname}${url.search} ${options?.target ?? "top"}`);
			if (method === "GET") return asResponse(await answer(url.href, options?.target));
			let request = requestFor(url.href);
			let next = await app.submit(request.page, options?.formData ?? new FormData(), request);
			if (next === null) return new Response("", { status: 400 });
			if ("body" in next) {
				let frame = options?.target === undefined ? undefined : next.frames?.[options.target];
				return asResponse(renderToStream(frame ?? next.body));
			}
			let destination = new URL(demoAppHref(slug)(next.page), location.origin);
			if (next.toast !== undefined) {
				destination.searchParams.set(DEMO_APP_TOAST_PARAM, `${next.toast}.0000test`);
			}
			return asResponse(await answer(destination.href, options?.target));
		},
	});
	await runtime.ready();

	return {
		runtime,
		requests,
		dispose: () => {
			runtime.dispose();
			pageToaster().dispose();
			document.body?.replaceChildren();
		},
	};
}
