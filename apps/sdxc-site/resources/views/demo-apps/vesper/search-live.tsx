/**
 * The search screen's live results: as the visitor types, the results frame reloads for the
 * query and the address follows it in place, so the list answers each keystroke without a new
 * history entry per letter. Without script, the form submits on Enter and loads the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

/** How long typing must pause before the results reload, so a fast typist sends one request. */
const DEBOUNCE_MS = 180;

namespace SearchLive {
	export interface Props {
		/** The id of the search form whose `q` field is watched. */
		form: string;
		/** The name of the frame holding the results. */
		frame: string;
		/** The id of the polite status the result count is spoken through. */
		status: string;
	}
}

/**
 * Watches the search field and reloads the results frame for what it holds. A reload that a
 * newer keystroke overtakes is dropped, so the list never steps back to an older query.
 */
export const SearchLive = clientEntry(
	import.meta.url,
	function SearchLive(handle: Handle<SearchLive.Props>) {
		let timer: ReturnType<typeof setTimeout> | undefined;
		let latest = 0;

		/** Reloads the results for the field's value and settles the address on it. */
		async function refresh(form: HTMLFormElement) {
			let field = form.elements.namedItem("q");
			let query = field instanceof HTMLInputElement ? field.value : "";
			let url = new URL(form.action, location.href);
			if (query.trim() !== "") url.searchParams.set("q", query);
			let address = `${url.pathname}${url.search}`;
			let frame = handle.frames.get(handle.props.frame);
			if (frame === undefined) return;
			let ticket = ++latest;
			await frame.reload({ src: address });
			if (ticket !== latest || handle.signal.aborted) return;
			history.replaceState(history.state, "", address);
			let screen = document.querySelector<HTMLElement>("[data-main-region] [data-main-screen]");
			if (screen !== null) screen.dataset.url = address;
			let count = document.querySelector<HTMLElement>("[data-search-count]")?.dataset.searchCount;
			let status = document.getElementById(handle.props.status);
			if (status !== null) status.textContent = count ?? "";
		}

		handle.queueTask(() => {
			let form = document.getElementById(handle.props.form);
			if (!(form instanceof HTMLFormElement) || handle.signal.aborted) return;
			form.addEventListener(
				"input",
				() => {
					clearTimeout(timer);
					timer = setTimeout(() => void refresh(form), DEBOUNCE_MS);
				},
				{ signal: handle.signal },
			);
			handle.signal.addEventListener("abort", () => clearTimeout(timer));
		});

		return () => <span hidden data-search-live="" />;
	},
);
