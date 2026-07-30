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

/** Attribute set on `<html>` while a client-side navigation is in flight, read by `NavigationIndicator`'s styling. */
const NAVIGATING_ATTRIBUTE = "data-navigating";

/**
 * How long a navigation must stay pending before the indicator appears. Most
 * navigations on this site resolve well inside this window, and a bar that
 * flashes for 40ms reads as a glitch rather than as progress — so the indicator
 * is for the slow ones, which are the only ones that need explaining.
 */
const INDICATOR_DELAY_MS = 150;

/**
 * Mirrors pending-navigation state onto `<html>` so the server-rendered
 * indicator can show itself in CSS.
 *
 * Registered before `run()` so the listener is attached even if the runtime's
 * own setup throws — which it does on browsers without the Navigation API,
 * since it reads `window.navigation` unguarded. The feature check here is that
 * guard for our own listener; on a browser lacking the API every navigation is
 * a full page load and the browser draws its native indicator anyway, so there
 * is nothing to stand in for.
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
		// Only navigations the runtime actually intercepts leave the browser without
		// its own feedback. A cross-document load still gets the native indicator,
		// and a fragment jump isn't a load at all.
		if (!event.canIntercept || event.hashChange) return;
		if (timer !== undefined) clearTimeout(timer);
		timer = setTimeout(() => root.setAttribute(NAVIGATING_ATTRIBUTE, ""), INDICATOR_DELAY_MS);
	});

	// `navigatesuccess` fires after the intercept handler resolves, which is the
	// moment the swapped content is in the DOM — exactly when the bar should go.
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
	async resolveFrame(src, signal, target) {
		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		let response = await fetch(src, { credentials: "same-origin", headers, signal });
		return response.body ?? response.text();
	},
});
