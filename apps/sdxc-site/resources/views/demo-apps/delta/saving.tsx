/**
 * Client island: says "Saving…" the moment a side panel's picker posts, so the save status
 * answers while the request is in the air, and the server's "Saved" follows with the page the
 * post redraws. Without script the page reloads with "Saved" already drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { setSaveStatus } from "@sdxc/ui/app";
import { clientEntry, createMixin } from "remix/component";

/** The attribute naming the save status a picker's posts report to. */
export const SAVES_ATTRIBUTE = "data-delta-saves";

/** Sets the named status to saving whenever a form inside a marked picker submits. */
const savingSignal = createMixin<HTMLElement, []>((handle) => {
	let controller: AbortController | undefined;
	handle.addEventListener("insert", () => {
		controller?.abort();
		controller = new AbortController();
		document.addEventListener(
			"submit",
			(event) => {
				let host =
					event.target instanceof Element ? event.target.closest(`[${SAVES_ATTRIBUTE}]`) : null;
				let status = host?.getAttribute(SAVES_ATTRIBUTE);
				if (status) setSaveStatus(status, "saving");
			},
			{ signal: controller.signal },
		);
	});
	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});

/** Renders the hidden marker carrying the listener. */
export const SavingSignal: EntryComponent<Record<never, never>> = clientEntry(
	import.meta.url,
	function SavingSignal() {
		return () => <span mix={[hidden(), savingSignal()]} />;
	},
);
