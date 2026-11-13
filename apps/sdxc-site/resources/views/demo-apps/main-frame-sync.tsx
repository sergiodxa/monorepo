/**
 * The browser half of a demo app's swappable main area: it points the app's own links at the
 * `main` frame, sends its posts through a frame reload that leaves history alone, and after
 * each swap brings the title, current nav item, address, focus and toasts in line with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Toast } from "@sdxc/ui/app";
import type { Handle } from "remix/component";

import { pageToaster } from "@sdxc/ui/app/toast";
import { clientEntry } from "remix/component";

/** The frame name the shell mounts the main area under. */
const MAIN = "main";

/**
 * A form's method read from its attribute, `get` when it has none. The `method` property is
 * shadowed by a control named `method` (a merge box's method radios), so it is never read.
 */
function formMethod(form: HTMLFormElement): string {
	return (form.getAttribute("method") ?? "get").toLowerCase();
}

namespace MainFrameSync {
	export interface Props {
		/** The app's root address; only links and forms under it stay inside the app's shell. */
		root: string;
		/**
		 * First path segments under `root` whose screens draw a different shell, such as a
		 * settings panel in place of the nav; a link crossing into or out of one reloads the page.
		 */
		shells?: readonly string[];
	}
}

/**
 * Keeps the shell mounted while the main area changes. Links and forms marked
 * `data-main-shell` (a screen that swaps the shell itself) and `data-rmx-document` keep the
 * runtime's own handling; everything else under `root` swaps `main` only.
 */
export const MainFrameSync = clientEntry(
	import.meta.url,
	function MainFrameSync(handle: Handle<MainFrameSync.Props>) {
		let seenToasts = new Set<string>();
		let seenAnchors = new WeakSet<Element>();
		let lastUrl = "";
		let suffix = "";
		let pendingFocus: string | null = null;
		let samePath = false;
		let scrolls = new Map<string, number>();
		let lastNavigation: string | null = null;
		let leftPath = "";
		/**
		 * The form and button of the last post, kept until the next navigation: a reload can
		 * settle before the frame swaps, so focus is restored again once the swap lands.
		 */
		let posted: { form: HTMLFormElement; submitter: HTMLElement | null } | null = null;

		/**
		 * The element the main area scrolls in: the nearest scrolling ancestor of the region,
		 * such as an app shell's content panel, or the page itself.
		 */
		function scroller(): Element {
			let element = document.querySelector("[data-main-region]")?.parentElement ?? null;
			while (element !== null) {
				if (/auto|scroll/.test(getComputedStyle(element).overflowY)) return element;
				element = element.parentElement;
			}
			return document.scrollingElement ?? document.documentElement;
		}

		/**
		 * Puts the main area's scroll where a visitor expects it once a navigation settles: where
		 * they left that history entry on Back and Forward, at the top for a new screen, and
		 * where it was for a filter, sort or sheet on the same screen.
		 */
		function restoreScroll() {
			let type = lastNavigation;
			lastNavigation = null;
			let key = globalThis.navigation?.currentEntry?.key;
			if (type === "traverse" && key !== undefined) scroller().scrollTop = scrolls.get(key) ?? 0;
			else if (type === "push" && leftPath !== location.pathname) scroller().scrollTop = 0;
		}

		/**
		 * Marks the history entry the visitor landed on as a `main` navigation, so Back to it
		 * reloads `main` like every later entry; the runtime gives a landing entry no target, and
		 * Back to it would otherwise reload the whole page.
		 */
		function markLandingEntry() {
			let entry = globalThis.navigation?.currentEntry;
			if (entry === undefined || entry === null) return;
			let state = entry.getState();
			let current = typeof state === "object" && state !== null ? state : {};
			globalThis.navigation?.updateCurrentEntry({
				state: { ...current, target: MAIN, src: location.href },
			});
		}

		/** Whether an address belongs to this app, so following it keeps the visitor in the shell. */
		function inApp(address: string): boolean {
			let url = new URL(address, location.href);
			let { root } = handle.props;
			return (
				url.origin === location.origin &&
				(url.pathname === root || url.pathname.startsWith(`${root}/`))
			);
		}

		/** The shell an in-app address draws: one of `shells`, or `""` for the app's main shell. */
		function shellOf(address: string): string {
			let { root, shells = [] } = handle.props;
			let segment = new URL(address, location.href).pathname.slice(root.length + 1).split("/")[0];
			return shells.includes(segment ?? "") ? (segment ?? "") : "";
		}

		/**
		 * Points an in-app link or GET form that stays in the current shell at `main` at the
		 * moment it is hovered, focused, pressed or submitted, so following it swaps only that
		 * frame; one that crosses shells or opts out keeps the runtime's whole-page handling.
		 * Marking at use time holds even when a component re-renders the element.
		 */
		function claim(event: Event) {
			let source = event.target instanceof Element ? event.target : null;
			let element = source?.closest<HTMLAnchorElement | HTMLFormElement>("a[href], form");
			if (element === null || element === undefined) return;
			let owned = element.hasAttribute("data-main-target");
			if (!owned && element.hasAttribute("data-rmx-target")) return;
			let address = element instanceof HTMLAnchorElement ? element.href : element.action;
			let eligible =
				inApp(address) &&
				shellOf(address) === shellOf(location.href) &&
				!element.closest("[data-main-shell]") &&
				!element.hasAttribute("data-rmx-document") &&
				(element instanceof HTMLAnchorElement
					? element.target !== "_blank" && !element.getAttribute("href")?.startsWith("#")
					: formMethod(element) === "get");
			element.toggleAttribute("data-main-target", eligible);
			if (eligible) {
				element.setAttribute("data-rmx-target", MAIN);
				element.setAttribute("data-rmx-reset-focus", "manual");
			} else {
				element.removeAttribute("data-rmx-target");
				element.removeAttribute("data-rmx-reset-focus");
			}
		}

		/**
		 * Sends an in-app post through a frame reload, which follows the redirect and renders it
		 * without adding a history entry: the frame the form or its submitter names in
		 * `data-rmx-target` when it is mounted, `main` otherwise. The address settles afterwards,
		 * and the form's fields return to what the server rendered, as a whole-page post leaves them.
		 */
		function submit(event: SubmitEvent) {
			let form = event.target;
			if (!(form instanceof HTMLFormElement) || event.defaultPrevented) return;
			let submitter = event.submitter;
			let method = (submitter?.getAttribute("formmethod") ?? formMethod(form)).toLowerCase();
			let action = submitter?.getAttribute("formaction") ?? form.action;
			if (method !== "post" || !inApp(action) || shellOf(action) !== shellOf(location.href)) return;
			if (form.closest("[data-main-shell]") || form.hasAttribute("data-rmx-document")) return;
			let named =
				submitter?.getAttribute("data-rmx-target") ?? form.getAttribute("data-rmx-target");
			let frame = (named ? handle.frames.get(named) : undefined) ?? handle.frames.get(MAIN);
			if (frame === undefined) return;
			event.preventDefault();
			let body = new FormData(form, submitter instanceof HTMLElement ? submitter : null);
			void frame.reload({ src: action, method: "post", encType: form.enctype, body }).then(
				() => {
					let used = submitter instanceof HTMLElement ? submitter : null;
					form.reset();
					sync("action");
					posted = { form, submitter: used };
					restoreFocus(form, used);
				},
				() => form.submit(),
			);
		}

		/**
		 * Puts focus back after a post redrew the control the visitor used: on the element with
		 * the submitter's id, else on the form, else on the screen's heading. A target the post
		 * left hidden, such as a selection bar that closes with its selection, is passed over.
		 */
		function restoreFocus(form: HTMLFormElement, submitter: HTMLElement | null) {
			if (document.activeElement !== document.body && document.activeElement?.isConnected) return;
			let byId = (element: Element | null) =>
				element?.id ? document.getElementById(element.id) : null;
			for (let target of [byId(submitter), form.isConnected ? form : byId(form)]) {
				if (!(target instanceof HTMLElement) || !target.checkVisibility()) continue;
				if (target === form) target.tabIndex = -1;
				target.focus({ preventScroll: true });
				if (document.activeElement === target) return;
			}
			let screen = document.querySelector<HTMLElement>("[data-main-region] [data-main-screen]");
			if (screen !== null) focusHeading(screen);
		}

		/**
		 * Brings the shell in line with the screen now in `main`: its title, the nav item it
		 * marks and the address a post's redirect landed on, every time it runs, so a runtime
		 * that restores the page's own title afterwards is corrected again. Once a swap settles,
		 * focus moves to the new heading for a new path, or when the focused control is gone, and
		 * stays put for a filter or sort on the same path; each toast shows once.
		 */
		function sync(cause: "swap" | "settled" | "action" | "initial") {
			let screen = document.querySelector<HTMLElement>("[data-main-region] [data-main-screen]");
			if (screen === null) return;
			let { crumb, nav, title, url = "" } = screen.dataset;
			if (cause === "initial") suffix = titleSuffix();
			for (let slot of document.querySelectorAll<HTMLElement>("[data-main-crumb]")) {
				if (crumb !== undefined) slot.textContent = crumb;
			}
			if (title && document.title !== `${title}${suffix}`) document.title = `${title}${suffix}`;
			for (let item of document.querySelectorAll<HTMLElement>("[data-main-nav]")) {
				let current = item.dataset.mainNav === nav;
				if (current) item.setAttribute("aria-current", "page");
				else item.removeAttribute("aria-current");
				item.toggleAttribute("data-current", current);
			}
			if (cause === "action" && url !== "" && url !== `${location.pathname}${location.search}`) {
				let anchored = screen.querySelector("template[data-main-anchor]") !== null;
				history.replaceState(history.state, "", `${url}${anchored ? location.hash : ""}`);
			}
			for (let marker of screen.querySelectorAll<HTMLTemplateElement>(
				"template[data-main-toast]",
			)) {
				let id = marker.dataset.mainToast ?? "";
				if (seenToasts.has(id)) continue;
				seenToasts.add(id);
				if (cause === "initial") continue;
				let toast = JSON.parse(marker.dataset.toast ?? "{}") as Omit<Toast.Flash, "id">;
				pageToaster().add(toast, { duration: toast.duration });
			}
			revealAnchors(cause);
			if (url !== lastUrl) {
				samePath = url.split("?")[0] === lastUrl.split("?")[0];
				lastUrl = url;
				if (cause === "initial") return;
				pendingFocus = url;
			}
			let settling = cause === "swap" && globalThis.navigation?.transition !== null;
			if (settling || pendingFocus !== url) return;
			pendingFocus = null;
			let focusKept =
				document.activeElement !== document.body && document.activeElement?.isConnected;
			let moveFocus = cause === "action" ? !screen.contains(document.activeElement) : !samePath;
			if (moveFocus || !focusKept) {
				focusHeading(screen);
			}
			announce(title ?? "");
		}

		/**
		 * Scrolls the element a post's redirect named into view, such as the message just sent,
		 * and puts its `#hash` in the address, once for each anchor marker a swap brings in.
		 */
		function revealAnchors(cause: "swap" | "settled" | "action" | "initial") {
			for (let marker of document.querySelectorAll<HTMLTemplateElement>(
				"[data-main-region] template[data-main-anchor]",
			)) {
				if (seenAnchors.has(marker)) continue;
				seenAnchors.add(marker);
				let id = marker.dataset.mainAnchor ?? "";
				let target = document.getElementById(id);
				if (cause === "initial" || target === null) continue;
				let hash = `#${encodeURIComponent(id)}`;
				if (location.hash !== hash) {
					history.replaceState(history.state, "", `${location.pathname}${location.search}${hash}`);
				}
				let still = matchMedia("(prefers-reduced-motion: reduce)").matches;
				target.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
			}
		}

		/**
		 * Moves focus to the screen's first visible heading, so a reader starts at the new content;
		 * a screen whose heading is hidden (a list pane on a phone) takes focus itself.
		 */
		function focusHeading(screen: HTMLElement) {
			let heading =
				[...screen.querySelectorAll<HTMLElement>("h1, h2")].find(
					(candidate) => candidate.getClientRects().length > 0,
				) ?? screen;
			heading.tabIndex = -1;
			heading.focus({ preventScroll: true });
		}

		/** The part of the document title after the screen's own, such as " — Pulse". */
		function titleSuffix(): string {
			let current = document.title;
			let at = current.lastIndexOf(" — ");
			return at === -1 ? "" : current.slice(at);
		}

		/**
		 * Speaks a swap's new screen through a polite live region the island adds to the page
		 * itself, so no render of the shell ever clears what it is saying.
		 */
		function announce(message: string) {
			if (message === "") return;
			let region = document.querySelector<HTMLElement>("[data-main-announcer]");
			if (region === null) {
				region = document.createElement("span");
				region.setAttribute("data-main-announcer", "");
				region.setAttribute("role", "status");
				region.setAttribute("aria-live", "polite");
				region.style.cssText =
					"position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
				document.body.appendChild(region);
			}
			region.textContent = "";
			setTimeout(() => {
				if (region !== null) region.textContent = message;
			}, 100);
		}

		handle.queueTask(() => {
			if (handle.signal.aborted) return;
			let signal = handle.signal;
			sync("initial");
			for (let type of ["pointerover", "focusin", "pointerdown", "click", "submit"]) {
				document.addEventListener(type, claim, { capture: true, signal });
			}
			document.addEventListener("submit", submit, { signal });
			markLandingEntry();
			document.documentElement.toggleAttribute("data-main-ready", true);
			let region = document.querySelector("[data-main-region]");
			if (region === null) return;
			let pending = false;
			let observer = new MutationObserver(() => {
				if (pending) return;
				pending = true;
				setTimeout(() => {
					pending = false;
					let screen = region.querySelector<HTMLElement>("[data-main-screen]");
					if (screen !== null) sync("swap");
					if (posted !== null) restoreFocus(posted.form, posted.submitter);
				});
			});
			observer.observe(region, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ["data-url"],
			});
			signal.addEventListener("abort", () => observer.disconnect());
			document.addEventListener(
				"focusout",
				(event) => {
					let left = event.target;
					if (posted === null || !(left instanceof HTMLElement)) return;
					let { form, submitter } = posted;
					setTimeout(() => {
						if (left.isConnected && left.checkVisibility()) return;
						restoreFocus(form, submitter);
					});
				},
				{ signal, capture: true },
			);
			globalThis.navigation?.addEventListener(
				"navigate",
				(event) => {
					let key = globalThis.navigation?.currentEntry?.key;
					if (key !== undefined) scrolls.set(key, scroller().scrollTop);
					leftPath = location.pathname;
					lastNavigation = event.navigationType;
					posted = null;
				},
				{ signal },
			);
			globalThis.navigation?.addEventListener(
				"navigatesuccess",
				() =>
					setTimeout(() => {
						restoreScroll();
						sync("settled");
					}, 0),
				{ signal },
			);
		});

		return () => <span hidden data-main-frame-sync="" />;
	},
);
