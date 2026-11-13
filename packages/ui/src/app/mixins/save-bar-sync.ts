/**
 * Why JS: a form cannot tell when its values differ from how it loaded, so script shows
 * the save bar while it does, binds ⌘S/Ctrl+S to submitting it, and guards leaving the page,
 * including a navigation the page answers in place.
 * No-JS baseline: the bar stays hidden and the form submits through its own Save button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { bindSaveShortcut } from "./save-shortcut.js";

/** Types for {@link saveBarSync}. */
export namespace SaveBarSync {
	/** Configuration for {@link saveBarSync}. */
	export interface Options {
		/** The `id` of the watched form; omit when the bar sits inside it. */
		form?: string;
		/** What the bar's live region announces once the form changes, such as "Unsaved changes". */
		message: string;
		/**
		 * The question asked before an in-page navigation leaves unsaved changes, such as
		 * "Leave without saving your changes?". @default message
		 */
		leave?: string;
	}
}

/**
 * Applied to the bar (`[data-slot="save-bar"]`): unhides it while the form's values differ
 * from their baseline, which a submission moves to the submitted values, and ⌘S saves them
 * unless the form's own primary save answers it. `[role="status"]` announces `message`.
 *
 * @example <div hidden mix={[saveBarSync({ message: "Unsaved changes" })]}>…</div>
 */
export const saveBarSync: MixinFactory<HTMLElement, [options: SaveBarSync.Options]> = createMixin<
	HTMLElement,
	[options: SaveBarSync.Options]
>((handle) => {
	let options: SaveBarSync.Options | undefined;
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		if (options) connect(event.node, options, controller.signal);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});

	return (next) => {
		options = next;
	};
});

/**
 * Reads a form's current values as one string, so two moments compare in one step. A
 * file contributes its name and size, which is what changes when another is picked.
 *
 * @param form The form to read.
 * @returns The form's entries, serialized in document order.
 */
function snapshot(form: HTMLFormElement): string {
	let entries: Array<[string, string]> = [];
	for (let [name, value] of new FormData(form)) {
		entries.push([name, typeof value === "string" ? value : `${value.name}:${value.size}`]);
	}
	return JSON.stringify(entries);
}

/**
 * Asks before the page unloads; attached only while the form has unsaved changes.
 *
 * @param event The unload the browser is about to perform.
 */
function guard(event: BeforeUnloadEvent): void {
	event.preventDefault();
}

/**
 * Connects `bar` to its form until `signal` aborts.
 *
 * @param bar The save bar.
 * @param options The form and the message to announce.
 * @param signal Ends every listener once the bar leaves the document.
 */
function connect(bar: HTMLElement, options: SaveBarSync.Options, signal: AbortSignal): void {
	let doc = bar.ownerDocument;
	let view = doc.defaultView;
	let form = options.form
		? (doc.getElementById(options.form) as HTMLFormElement | null)
		: bar.closest("form");
	if (!form) return;
	let status = bar.querySelector<HTMLElement>('[role="status"]');
	let baseline = snapshot(form);
	let dirty = false;

	/** Shows or hides the bar and the leave guard to match `next`. */
	let show = (next: boolean) => {
		if (next === dirty) return;
		dirty = next;
		bar.hidden = !next;
		if (status) status.textContent = next ? options.message : "";
		if (next) {
			view?.addEventListener("beforeunload", guard);
			view?.navigation?.addEventListener("navigate", ask);
		} else {
			view?.removeEventListener("beforeunload", guard);
			view?.navigation?.removeEventListener("navigate", ask);
		}
	};

	/**
	 * Asks before a navigation the page handles itself (a frame swap, which fires no
	 * `beforeunload`) leaves unsaved changes, and cancels it when the visitor stays; a jump
	 * to an anchor on the same page goes ahead.
	 */
	let ask = (event: NavigateEvent) => {
		if (event.hashChange || !event.cancelable || event.downloadRequest !== null) return;
		if (!view?.confirm(options.leave ?? options.message)) event.preventDefault();
	};

	/** Compares the form with its baseline. */
	let compare = () => show(snapshot(form) !== baseline);

	form.addEventListener("input", compare, { signal });
	form.addEventListener("change", compare, { signal });
	form.addEventListener("reset", () => setTimeout(compare), { signal });
	form.addEventListener(
		"submit",
		() => {
			baseline = snapshot(form);
			show(false);
		},
		{ signal },
	);
	bindSaveShortcut(
		{
			form,
			fallback: true,
			save: () => {
				if (dirty) form.requestSubmit();
			},
		},
		signal,
	);
	signal.addEventListener("abort", () => {
		view?.removeEventListener("beforeunload", guard);
		view?.navigation?.removeEventListener("navigate", ask);
	});
}
