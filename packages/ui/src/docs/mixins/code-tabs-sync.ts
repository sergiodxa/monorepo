/**
 * Why JS: a reader who picks Bun in one set of code tabs expects every set sharing that
 * choice to switch, on this page and the next; radios only know their own group.
 * No-JS baseline: each set still switches on its own through its radios and CSS.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** Where a set of code tabs remembers the reader's choice between pages. */
export type CodeTabsPersistence = "cookie" | "local" | "none";

/** Attribute every set of code tabs carries, holding its sync key (empty when unsynced). */
export const CODE_TABS_ATTRIBUTE = "data-code-tabs";

/** How long a remembered choice outlives the visit it was made in, in seconds. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * The cookie and `localStorage` key a sync key's choice is stored under. A server that
 * renders the remembered choice reads the cookie by this name, or uses
 * {@link readCodeTabsCookie}.
 *
 * @param syncKey The key the tab sets share, such as `package-manager`.
 * @returns The storage key, such as `ui-code-tabs.package-manager`.
 */
export function codeTabsStorageKey(syncKey: string): string {
	return `ui-code-tabs.${syncKey}`;
}

/**
 * Reads the remembered choice for `syncKey` from a request's `Cookie` header, so the
 * server renders the reader's tab already selected and the page never flashes.
 *
 * @param cookieHeader The request's `Cookie` header, or nothing when none was sent.
 * @param syncKey The key the tab sets share.
 * @returns The chosen tab's value, or `undefined` when the reader has not chosen.
 * @example <CodeTabs syncKey="package-manager" persist="cookie" selected={readCodeTabsCookie(request.headers.get("Cookie"), "package-manager")} … />
 */
export function readCodeTabsCookie(
	cookieHeader: string | null | undefined,
	syncKey: string,
): string | undefined {
	if (!cookieHeader) return undefined;
	let name = codeTabsStorageKey(syncKey);
	for (let entry of cookieHeader.split(";")) {
		let separator = entry.indexOf("=");
		if (separator === -1 || entry.slice(0, separator).trim() !== name) continue;
		try {
			return decodeURIComponent(entry.slice(separator + 1).trim());
		} catch {
			return undefined;
		}
	}
	return undefined;
}

/**
 * Keeps every set of code tabs sharing `syncKey` on one choice. Attach it to an element
 * inside the set: on insertion it selects the remembered choice (a cached page was
 * rendered for whoever asked first), and each switch is stored and mirrored into the
 * other sets on the page. With `local` storage, other browser tabs follow too.
 *
 * @param syncKey The key the tab sets share.
 * @param persist Where the choice is remembered between pages.
 * @returns A mixin descriptor for an element inside the set's `[data-code-tabs]` root.
 * @example <span hidden mix={[codeTabsSync("package-manager", "cookie")]} />
 */
export const codeTabsSync: MixinFactory<
	HTMLElement,
	[syncKey: string, persist: CodeTabsPersistence],
	ElementProps
> = createMixin<HTMLElement, [syncKey: string, persist: CodeTabsPersistence], ElementProps>(
	(handle) => {
		let controller: AbortController | undefined;
		let syncKey = "";
		let persist: CodeTabsPersistence = "none";

		handle.addEventListener("insert", (event) => {
			controller?.abort();
			let set = event.node.closest<HTMLElement>(`[${CODE_TABS_ATTRIBUTE}]`);
			if (!set) return;
			controller = new AbortController();
			let { signal } = controller;

			let remembered = readChoice(syncKey, persist);
			if (remembered !== undefined) select(set, remembered);

			set.addEventListener(
				"change",
				(change) => {
					let input = change.target;
					if (!(input instanceof HTMLInputElement) || input.type !== "radio") return;
					writeChoice(syncKey, persist, input.value);
					for (let other of document.querySelectorAll<HTMLElement>(selectorFor(syncKey))) {
						if (other !== set) select(other, input.value);
					}
				},
				{ signal },
			);

			if (persist === "local") {
				window.addEventListener(
					"storage",
					(storage) => {
						if (storage.key !== codeTabsStorageKey(syncKey) || storage.newValue === null) return;
						select(set, storage.newValue);
					},
					{ signal },
				);
			}
		});

		handle.addEventListener("remove", () => {
			controller?.abort();
			controller = undefined;
		});

		return (key, mode) => {
			syncKey = key;
			persist = mode;
			return handle.element;
		};
	},
);

/** Selector matching every set of code tabs that shares `syncKey`. */
function selectorFor(syncKey: string): string {
	return `[${CODE_TABS_ATTRIBUTE}="${CSS.escape(syncKey)}"]`;
}

/** Checks the radio standing for `value`, leaving a set that offers no such tab alone. */
function select(set: HTMLElement, value: string): void {
	let input = set.querySelector(`input[type="radio"][value="${CSS.escape(value)}"]`);
	if (input instanceof HTMLInputElement) input.checked = true;
}

/** Reads the remembered choice; blocked storage reads as no choice. */
function readChoice(syncKey: string, persist: CodeTabsPersistence): string | undefined {
	try {
		if (persist === "local") return localStorage.getItem(codeTabsStorageKey(syncKey)) ?? undefined;
		if (persist === "cookie") return readCodeTabsCookie(document.cookie, syncKey);
	} catch {}
	return undefined;
}

/** Stores the choice for the next page; blocked storage passes silently. */
function writeChoice(syncKey: string, persist: CodeTabsPersistence, value: string): void {
	try {
		let key = codeTabsStorageKey(syncKey);
		if (persist === "local") localStorage.setItem(key, value);
		if (persist === "cookie") {
			let secure = location.protocol === "https:" ? "; secure" : "";
			document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax${secure}`;
		}
	} catch {}
}
