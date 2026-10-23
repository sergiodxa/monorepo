/**
 * The combobox keyboard pattern over options a server rendered: arrows choose a row of the
 * listbox the host's `aria-controls` names while focus stays in the host, Enter follows it, and
 * a resting choice can load its destination ahead. Without JS every option is still a link a
 * reader can tab to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin, prefetch } from "remix/component";

/** How long the choice rests on an option before its destination starts loading. */
const PREFETCH_DELAY_MS = 100;

/** How long a prefetched destination counts as loaded, the span browsers keep one usable. */
const PREFETCH_FRESH_MS = 5 * 60 * 1000;

/** When each destination last started loading, keyed by strategy and address. */
const PREFETCHED = new Map<string, number>();

/** Types for {@link activeDescendantKeys}. */
export namespace ActiveDescendantKeys {
	/**
	 * How a chosen option's destination loads ahead of Enter. `"frame"` asks the
	 * `remix/component` runtime, which warms the HTTP cache a client navigation reads;
	 * `"document"` adds a `<link rel="prefetch">`, which a full document load reuses.
	 */
	export type Prefetch = "frame" | "document";

	/** Configuration for {@link activeDescendantKeys}. */
	export interface Options {
		/** Loads the destination of an option the arrows rest on, once the choice settles. */
		prefetch?: Prefetch;
	}
}

/** Every option of the listbox `combobox` controls, in document order. */
function optionsOf(combobox: HTMLElement): Array<HTMLElement> {
	let id = combobox.getAttribute("aria-controls");
	let listbox = id ? combobox.ownerDocument.getElementById(id) : null;
	return listbox ? Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]')) : [];
}

/**
 * The index of the option `combobox` has chosen, or `-1` while the combobox itself is the
 * choice. The choice lives in `aria-activedescendant`, so it reads the same to every caller.
 *
 * @param combobox The element carrying `aria-controls` and `aria-activedescendant`.
 * @returns The chosen option's index among the controlled listbox's options.
 */
export function chosenOption(combobox: HTMLElement): number {
	let active = combobox.getAttribute("aria-activedescendant");
	if (!active) return -1;
	return optionsOf(combobox).findIndex((option) => option.id === active);
}

/**
 * Chooses the option at `index`, or none for `-1`, marking it `aria-selected` and scrolling it
 * into view. Call it after replacing the options, since a new list starts with whatever
 * choice its markup carries.
 *
 * @param combobox The element carrying `aria-controls`.
 * @param index The option to choose, or `-1` to choose none.
 */
export function chooseOption(combobox: HTMLElement, index: number): void {
	let options = optionsOf(combobox);
	let chosen = options[index];
	options.forEach((option) => option.setAttribute("aria-selected", String(option === chosen)));
	if (chosen?.id) combobox.setAttribute("aria-activedescendant", chosen.id);
	else combobox.removeAttribute("aria-activedescendant");
	chosen?.scrollIntoView?.({ block: "nearest" });
}

/** The subset of the Network Information API that marks a reader's connection as constrained. */
interface Connection {
	saveData?: boolean;
	effectiveType?: string;
}

/** Whether the reader asked to save data or sits on a 2G connection, where guesses cost too much. */
function constrainedConnection(): boolean {
	let connection = (navigator as Navigator & { connection?: Connection }).connection;
	if (!connection) return false;
	return (
		connection.saveData === true ||
		connection.effectiveType === "slow-2g" ||
		connection.effectiveType === "2g"
	);
}

/** Records `key` as loading now, answering whether it had already loaded recently. */
function prefetchedRecently(key: string): boolean {
	let now = Date.now();
	let last = PREFETCHED.get(key);
	if (last !== undefined && now - last < PREFETCH_FRESH_MS) return true;
	PREFETCHED.set(key, now);
	return false;
}

/** The same-origin address `value` names without its hash, or `null` for another origin. */
function sameOriginHref(value: string, base: string): string | null {
	let url = new URL(value, base);
	if (url.origin !== new URL(base).origin) return null;
	url.hash = "";
	return url.href;
}

/**
 * Starts loading the destination of the option at `index` so following it lands sooner. Skips a
 * constrained connection, an option without a same-origin link that opens in place, the page
 * already showing, and a destination loaded in the last five minutes. Call it from an event
 * handler, such as when new results settle, since it reads the browser's document.
 *
 * @param combobox The element carrying `aria-controls`.
 * @param index The option whose link to load.
 * @param strategy How the destination loads, as {@link ActiveDescendantKeys.Prefetch} describes.
 */
export function prefetchOption(
	combobox: HTMLElement,
	index: number,
	strategy: ActiveDescendantKeys.Prefetch,
): void {
	let link = optionsOf(combobox)[index]?.querySelector<HTMLAnchorElement>("a[href]");
	if (!link || link.hasAttribute("download") || constrainedConnection()) return;
	if (link.target !== "" && link.target !== "_self") return;
	let doc = combobox.ownerDocument;
	let base = doc.baseURI;
	let href = sameOriginHref(link.getAttribute("href") ?? "", base);
	if (!href || href === sameOriginHref(doc.location.href, base)) return;
	if (prefetchedRecently(`${strategy} ${href}`)) return;

	if (strategy === "frame") {
		let target = link.getAttribute("data-rmx-target");
		let src = sameOriginHref(link.getAttribute("data-rmx-src") ?? href, base) ?? href;
		prefetch(target ? src : href, target ? { target } : undefined);
		return;
	}
	let hint = doc.createElement("link");
	hint.rel = "prefetch";
	hint.href = href;
	doc.head.appendChild(hint);
}

/** Activates an option as a click would: its link when it holds one, else the option itself. */
function follow(option: HTMLElement): void {
	(option.querySelector<HTMLElement>("a[href]") ?? option).click();
}

/**
 * Moves the choice through the controlled options: Down from the host to the first and around
 * from the last, Up back toward the host. Enter follows the chosen option, or the only option
 * when none is chosen and the listbox sits in no `aria-busy` region, so stale rows never open.
 * With `prefetch`, a choice resting 100ms loads its link as {@link prefetchOption} does.
 *
 * @example <input role="combobox" aria-controls="search-options" mix={[activeDescendantKeys()]} />
 * @example <input role="combobox" aria-controls="search-options" mix={[activeDescendantKeys({ prefetch: "frame" })]} />
 */
export const activeDescendantKeys: MixinFactory<
	HTMLElement,
	[options?: ActiveDescendantKeys.Options]
> = createMixin<HTMLElement, [options?: ActiveDescendantKeys.Options]>((handle) => {
	let options: ActiveDescendantKeys.Options = {};
	let pending: ReturnType<typeof setTimeout> | undefined;

	handle.signal.addEventListener("abort", () => clearTimeout(pending));

	/** Loads the chosen option's destination once the arrows have rested on it a moment. */
	function schedulePrefetch(host: HTMLElement): void {
		let strategy = options.prefetch;
		if (!strategy) return;
		clearTimeout(pending);
		pending = setTimeout(() => {
			let chosen = chosenOption(host);
			if (chosen >= 0) prefetchOption(host, chosen, strategy);
		}, PREFETCH_DELAY_MS);
	}

	handle.addEventListener("insert", (event) => {
		let host = event.node;
		host.addEventListener(
			"keydown",
			(keyEvent) => {
				if (keyEvent.defaultPrevented || keyEvent.isComposing) return;
				let rows = optionsOf(host);
				let chosen = chosenOption(host);

				if (keyEvent.key === "ArrowDown" && rows.length > 0) {
					keyEvent.preventDefault();
					chooseOption(host, chosen + 1 >= rows.length ? 0 : chosen + 1);
					schedulePrefetch(host);
				} else if (keyEvent.key === "ArrowUp" && chosen >= 0) {
					keyEvent.preventDefault();
					chooseOption(host, chosen - 1);
					schedulePrefetch(host);
				} else if (keyEvent.key === "Enter" && rows[chosen]) {
					keyEvent.preventDefault();
					follow(rows[chosen]);
				} else if (
					keyEvent.key === "Enter" &&
					rows.length === 1 &&
					rows[0] &&
					!rows[0].closest('[aria-busy="true"]')
				) {
					keyEvent.preventDefault();
					follow(rows[0]);
				}
			},
			{ signal: handle.signal },
		);
	});

	return (next) => {
		options = next ?? {};
	};
});
