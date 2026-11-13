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
		let lastUrl = "";
		let suffix = "";
		let pendingFocus: string | null = null;
		let scrolls = new Map<string, number>();
		let lastNavigation: string | null = null;

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
		 * they left that history entry on Back and Forward, and at the top for a new screen.
		 */
		function restoreScroll() {
			let type = lastNavigation;
			lastNavigation = null;
			let key = globalThis.navigation?.currentEntry?.key;
			if (type === "traverse" && key !== undefined) scroller().scrollTop = scrolls.get(key) ?? 0;
			else if (type === "push") scroller().scrollTop = 0;
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
					: element.method.toLowerCase() === "get");
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
		 * `data-rmx-target` when it is mounted, `main` otherwise. The address settles afterwards.
		 */
		function submit(event: SubmitEvent) {
			let form = event.target;
			if (!(form instanceof HTMLFormElement) || event.defaultPrevented) return;
			let submitter = event.submitter;
			let method = (submitter?.getAttribute("formmethod") ?? form.method).toLowerCase();
			let action = submitter?.getAttribute("formaction") ?? form.action;
			if (method !== "post" || !inApp(action) || shellOf(action) !== shellOf(location.href)) return;
			if (form.closest("[data-main-shell]") || form.hasAttribute("data-rmx-document")) return;
			let named =
				submitter?.getAttribute("data-rmx-target") ?? form.getAttribute("data-rmx-target");
			let frame = (named ? handle.frames.get(named) : undefined) ?? handle.frames.get(MAIN);
			if (frame === undefined) return;
			event.preventDefault();
			let body = new FormData(form, submitter instanceof HTMLElement ? submitter : null);
			void frame
				.reload({ src: action, method: "post", encType: form.enctype, body })
				.then(() => sync("action"))
				.catch(() => form.submit());
		}

		/**
		 * Brings the shell in line with the screen now in `main`: its title, the nav item it
		 * marks and the address a post's redirect landed on, every time it runs, so a runtime
		 * that restores the page's own title afterwards is corrected again. Focus and the
		 * announcement wait for the swap to settle, once per new screen; each toast shows once.
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
				history.replaceState(history.state, "", url);
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
			if (url !== lastUrl) {
				lastUrl = url;
				if (cause === "initial") return;
				pendingFocus = url;
			}
			let settling = cause === "swap" && globalThis.navigation?.transition !== null;
			if (settling || pendingFocus !== url) return;
			pendingFocus = null;
			if (cause !== "action" || !screen.contains(document.activeElement)) {
				let heading = screen.querySelector<HTMLElement>("h1");
				if (heading !== null) {
					heading.tabIndex = -1;
					heading.focus({ preventScroll: true });
				}
			}
			announce(title ?? "");
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
				});
			});
			observer.observe(region, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ["data-url"],
			});
			signal.addEventListener("abort", () => observer.disconnect());
			globalThis.navigation?.addEventListener(
				"navigate",
				(event) => {
					let key = globalThis.navigation?.currentEntry?.key;
					if (key !== undefined) scrolls.set(key, scroller().scrollTop);
					lastNavigation = event.navigationType;
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
