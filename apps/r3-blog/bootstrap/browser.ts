/**
 * Client-side entrypoint for the r3-blog browser bundle. Boots the Remix UI
 * runtime, lazily resolving client modules from resources and routes via a glob
 * map, and fetches SSR frames over the network for progressive hydration. It
 * also flags pending navigations for the document's progress indicator and wraps
 * each one in a view transition, since intercepting navigations costs us both the
 * browser's own loading feedback and its atomic swap between pages.
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
 * How long a view transition may stay open before it is force-settled. The
 * browser holds a snapshot of the outgoing page for as long as the transition's
 * update callback is unresolved, so a navigation that never reports success
 * would leave the page looking frozen — strictly worse than the flash this is
 * here to prevent. This bounds that failure.
 */
const TRANSITION_TIMEOUT_MS = 3000;

/**
 * The in-flight swap's bookkeeping: whether the runtime has finished replacing
 * the document, and the resolver that lets the browser finish the transition.
 */
interface PendingSwap {
	swapped: boolean;
	resolve?: () => void;
	timer?: ReturnType<typeof setTimeout>;
}

/**
 * Mirrors pending-navigation state onto `<html>` for the progress indicator, and
 * wraps the swap in a view transition.
 *
 * The transition is what keeps a navigation from painting a half-updated page.
 * The runtime releases the outgoing page's server-rendered styles before it
 * swaps that page's markup out — `replaceServerStyles` drops the selectors the
 * incoming page doesn't use, and the body diff runs after — so leaving a page
 * whose styling nothing else shares (a post, whose article panel, badges and
 * code theme are all its own) briefly renders that markup with its styles
 * already gone. Frame content arrives as a stream rather than one synchronous
 * block, which is what lets a paint land in that window. Opening a transition in
 * the `navigate` listener snapshots the page *before* the runtime's intercept
 * handler mutates anything, so no intermediate state is ever painted; the
 * browser cross-fades from that snapshot to the finished page instead.
 *
 * `prefers-reduced-motion` is deliberately not honored here. Skipping the
 * transition would restore the defect for exactly the visitors least able to
 * tolerate a jarring repaint, and what it costs them is a root cross-fade —
 * opacity, not movement, which is the same substitution the design system's own
 * animation layer makes for reduced-motion viewers.
 *
 * Registered before `run()` so the listeners attach even if the runtime's own
 * setup throws — which it does on browsers without the Navigation API, since it
 * reads `window.navigation` unguarded. The feature check here is that guard for
 * our own listeners; on such a browser every navigation is a full page load, so
 * the browser draws its native indicator and performs its own atomic swap, and
 * there is nothing to stand in for.
 */
function trackPendingNavigations() {
	if (!("navigation" in window)) return;

	let root = document.documentElement;
	let indicatorTimer: ReturnType<typeof setTimeout> | undefined;
	let pending: PendingSwap | undefined;

	/** Lets the browser finish the current transition and drops the indicator. */
	function settle() {
		if (indicatorTimer !== undefined) clearTimeout(indicatorTimer);
		indicatorTimer = undefined;
		root.removeAttribute(NAVIGATING_ATTRIBUTE);

		let swap = pending;
		pending = undefined;
		if (!swap) return;
		if (swap.timer !== undefined) clearTimeout(swap.timer);
		swap.swapped = true;
		swap.resolve?.();
	}

	window.navigation.addEventListener("navigate", (event) => {
		// Only navigations the runtime actually intercepts lose the browser's
		// feedback and its atomic swap. A cross-document load keeps both, and a
		// fragment jump isn't a load at all.
		if (!event.canIntercept || event.hashChange) return;

		if (indicatorTimer !== undefined) clearTimeout(indicatorTimer);
		indicatorTimer = setTimeout(
			() => root.setAttribute(NAVIGATING_ATTRIBUTE, ""),
			INDICATOR_DELAY_MS,
		);

		if (typeof document.startViewTransition !== "function") return;
		// A navigation that supersedes another settles the first, so the browser is
		// never asked to hold two snapshots at once.
		settle();

		let swap: PendingSwap = { swapped: false };
		pending = swap;
		swap.timer = setTimeout(settle, TRANSITION_TIMEOUT_MS);

		document.startViewTransition(
			() =>
				new Promise<void>((resolve) => {
					// The browser may invoke this after the swap already finished, in which
					// case there is nothing left to wait for.
					if (swap.swapped) resolve();
					else swap.resolve = resolve;
				}),
		);
	});

	// `navigatesuccess` fires after the intercept handler resolves, which is the
	// moment the swapped content is in the DOM — exactly when the transition
	// should play out and the indicator should go.
	window.navigation.addEventListener("navigatesuccess", settle);
	window.navigation.addEventListener("navigateerror", settle);
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
