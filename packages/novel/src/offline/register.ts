/**
 * The page side of offline play: `offlineAssets()` lists every file a novel declares, and
 * `registerOffline()` registers the app's worker and tells it that list, since a worker cannot
 * import the novel. Registration is opt-in; a page that never calls it caches nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Novel } from "../novel.js";

import { urlsOf } from "../links.js";
import { INTERNALS } from "../novel.js";

import { ASSETS_MESSAGE } from "./policy.js";

/** How the page registers the worker. */
export interface RegisterOptions {
	/** The worker script's URL, served from a path whose scope covers the game's page. */
	url: string | URL;
	/** The worker's scope. */
	scope?: string;
	/**
	 * `module` for a worker built as an ES module.
	 *
	 * @default "classic"
	 */
	type?: "classic" | "module";
	/**
	 * More files to cache, such as the voice files a `voice` option finds, which no declaration
	 * lists.
	 */
	extra?: Iterable<string>;
}

/**
 * Every file the novel declares: each asset in every locale and every character sprite and
 * layer, leaving out `data:` and `blob:` URLs.
 *
 * @param novel - The novel.
 * @param extra - More URLs to add, such as voice files.
 * @returns The URLs, each once, in declaration order.
 * @example offlineAssets(novel, Object.values(VOICES));
 */
export function offlineAssets(novel: Novel, extra: Iterable<string> = []): string[] {
	let internals = novel[INTERNALS]();
	let urls: string[] = [];
	for (let asset of internals.assets.values()) urls.push(...urlsOf(asset.src));
	for (let character of internals.characters.values()) {
		let image = character.image;
		if (image.kind === "sprites") {
			for (let source of Object.values(image.sprites)) urls.push(...urlsOf(source));
		} else if (image.kind === "layers") {
			for (let variants of Object.values(image.layers)) {
				for (let source of Object.values(variants)) urls.push(...urlsOf(source));
			}
		}
	}
	urls.push(...extra);
	return [
		...new Set(
			urls.filter((url) => url !== "" && !url.startsWith("data:") && !url.startsWith("blob:")),
		),
	];
}

/**
 * Registers the app's offline worker and sends it the novel's files, again whenever a new
 * worker takes control of the page.
 *
 * @param novel - The novel whose files the worker may cache.
 * @param options - The worker's URL and scope, and any extra files.
 * @returns The registration, or an error when the browser has no service workers or refuses
 * the script.
 * @example await registerOffline(novel, { url: "/sw.js", type: "module", extra: Object.values(VOICES) });
 */
export async function registerOffline(
	novel: Novel,
	options: RegisterOptions,
): Promise<Result<ServiceWorkerRegistration, Error>> {
	if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
		return failure(new Error("This browser has no service workers."));
	}
	let message = { type: ASSETS_MESSAGE, urls: offlineAssets(novel, options.extra) };
	let container = navigator.serviceWorker;
	let registration: ServiceWorkerRegistration;
	try {
		registration = await container.register(options.url, {
			type: options.type ?? "classic",
			...(options.scope === undefined ? {} : { scope: options.scope }),
		});
	} catch (error) {
		return failure(error instanceof Error ? error : new Error(String(error)));
	}
	container.addEventListener("controllerchange", () => container.controller?.postMessage(message));
	let ready = await container.ready;
	ready.active?.postMessage(message);
	return success(registration);
}
