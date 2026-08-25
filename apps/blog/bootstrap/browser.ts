/**
 * Client-side entrypoint for the blog browser bundle. Boots the Remix UI
 * runtime, lazily resolving client modules from resources and routes via a glob
 * map, and fetches SSR frames over the network for progressive hydration. It
 * also flags pending navigations for the document's progress indicator, since
 * intercepting navigations costs us the browser's own loading feedback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/ui";

/**
 * Set on `<html>` while a client-side navigation is in flight, read by
 * `NavigationIndicator`'s styling.
 */
const NAVIGATING_ATTRIBUTE = "data-navigating";

/**
 * How long a navigation must stay pending before the indicator appears. Most
 * navigations resolve well inside this window, and a bar that flashes for 40ms
 * reads as a glitch, so the indicator is reserved for the slow ones.
 */
const INDICATOR_DELAY_MS = 150;

/**
 * Mirrors pending-navigation state onto `<html>` so the server-rendered
 * indicator covers navigations the runtime intercepts. Registered before
 * `run()`, whose setup throws on browsers lacking the Navigation API.
 */
function trackPendingNavigations() {
	if (!("navigation" in window)) return;

	let root = document.documentElement;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function clear() {
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
		root.removeAttribute(NAVIGATING_ATTRIBUTE);
	}

	window.navigation.addEventListener("navigate", (event) => {
		if (!event.canIntercept || event.hashChange) return;
		if (timer !== undefined) clearTimeout(timer);
		timer = setTimeout(() => root.setAttribute(NAVIGATING_ATTRIBUTE, ""), INDICATOR_DELAY_MS);
	});

	window.navigation.addEventListener("navigatesuccess", clear);
	window.navigation.addEventListener("navigateerror", clear);
}

trackPendingNavigations();

const clientModules = import.meta.glob([
	"!../**/*.server.*",
	"../resources/**/*.{ts,tsx}",
	"../routes/**/*.{ts,tsx}",
]);

run({
	async loadModule(moduleUrl, exportName) {
		let pathname = new URL(moduleUrl, location.origin).pathname;

		let load = clientModules[`..${pathname}`];
		if (!load) throw new Error(`Unknown client entry module: ${moduleUrl}`);

		let mod = await load();

		if (!mod || typeof mod !== "object") {
			throw new Error(`Invalid client entry module: ${moduleUrl}`);
		}

		let entry = Reflect.get(mod, exportName);

		if (typeof entry !== "function") {
			throw new Error(`Missing client entry export ${exportName} in ${moduleUrl}`);
		}

		return entry;
	},
	async resolveFrame(src, options) {
		let { target, signal, method, formData, encType } = options ?? {};

		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		let body =
			formData && encType === "application/x-www-form-urlencoded"
				? new URLSearchParams(
						Array.from(formData, ([key, value]) => [
							key,
							value instanceof File ? value.name : value,
						]),
					)
				: formData;

		return await fetch(src, { credentials: "same-origin", headers, signal, method, body });
	},
});
