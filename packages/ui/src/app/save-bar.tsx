/**
 * Client island: the sticky "Unsaved changes · Discard · Save" bar a long form shows once
 * it differs from how it loaded. Discard resets the form, ⌘S or Ctrl+S submits it, and
 * leaving the page asks first while changes are unsaved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { opacity, rounded, shadow, transition } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hidden, hstack, sticky } from "@sdxc/u/layout";
import { motionSafe, startingStyle } from "@sdxc/u/responsive";
import { minIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { translateProperty } from "@sdxc/u/transform";
import { text, weight } from "@sdxc/u/typography";
import { clientEntry, on, ref } from "remix/component";

import { Button } from "../components/button.js";
import { Keyboard } from "../components/keyboard.js";

/**
 * Props {@link SaveBar} serializes into the page for hydration, which is why they are a
 * `type`: `SerializableProps` rejects an interface.
 */
export type SaveBarProps = {
	/** The `id` of the form the bar watches; omit when the bar sits inside that form. */
	form?: string;
	labels: {
		/** The bar's message, such as "Unsaved changes". */
		message: string;
		discard: string;
		save: string;
		/** The save shortcut as the platform writes it, such as "⌘S", shown on the Save button. */
		shortcut?: string;
	};
};

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
 * Renders the bar, hidden until the watched form changes. Place it as the form's last
 * child so it sticks to the bottom of the viewport while the form scrolls; the form keeps
 * its own Save, which is what a browser without script uses.
 *
 * @example
 * <form method="post" id="monitor-form">
 * 	…fields…
 * 	<SaveBar labels={{ message: "Unsaved changes", discard: "Discard", save: "Save", shortcut: "⌘S" }} />
 * </form>
 */
export const SaveBar: EntryComponent<SaveBarProps> = clientEntry(
	"@sdxc/ui/app/save-bar#SaveBar",
	function SaveBar(handle) {
		let isDirty = false;
		let target: HTMLFormElement | null = null;

		/** Asks before the page unloads with unsaved changes; attached only while dirty. */
		function guard(event: BeforeUnloadEvent) {
			event.preventDefault();
		}

		/** Records whether the form differs from its baseline, attaching the leave guard to match. */
		function setDirty(next: boolean) {
			if (next === isDirty) return;
			isDirty = next;
			if (next) globalThis.addEventListener("beforeunload", guard);
			else globalThis.removeEventListener("beforeunload", guard);
			void handle.update();
		}

		let watch = ref((node, signal) => {
			let id = handle.props.form;
			let form = id
				? (node.ownerDocument.getElementById(id) as HTMLFormElement | null)
				: node.closest("form");
			if (!form) return;
			target = form;
			let baseline = snapshot(form);

			/** Compares the form with how it loaded. */
			function compare() {
				if (form) setDirty(snapshot(form) !== baseline);
			}

			form.addEventListener("input", compare, { signal });
			form.addEventListener("change", compare, { signal });
			form.addEventListener("reset", () => setTimeout(compare), { signal });
			form.addEventListener(
				"submit",
				() => {
					if (form) baseline = snapshot(form);
					setDirty(false);
				},
				{ signal },
			);
			node.ownerDocument.addEventListener(
				"keydown",
				(event) => {
					if (event.key.toLowerCase() !== "s" || !(event.metaKey || event.ctrlKey)) return;
					event.preventDefault();
					if (isDirty) form?.requestSubmit();
				},
				{ signal },
			);
			signal.addEventListener("abort", () => {
				globalThis.removeEventListener("beforeunload", guard);
				target = null;
			});
		});

		return () => {
			let { form, labels } = handle.props;

			return (
				<div
					data-slot="save-bar"
					hidden={!isDirty}
					mix={[
						watch,
						sticky(),
						hstack({ gap: 3, align: "center" }),
						raw({ insetBlockEnd: "1rem", flexWrap: "wrap", zIndex: 10 }),
						p(2, 2, 2, 4),
						rounded("lg"),
						border({ color: "neutral", width: 1 }),
						bg("neutral.surface"),
						shadow("lg"),
						text("sm"),
						when("&[hidden]", hidden()),
						motionSafe([
							transition("opacity, translate"),
							startingStyle([opacity(0), translateProperty("0 0.5rem")]),
						]),
					]}
				>
					<p
						role="status"
						mix={[
							raw({ margin: 0, flex: "1 1 auto" }),
							minIs(0),
							weight("medium"),
							fg("neutral.emphasis"),
						]}
					>
						{isDirty ? labels.message : ""}
					</p>
					<Button
						type="button"
						variant="ghost"
						color="neutral"
						size="sm"
						mix={[on("click", () => target?.reset())]}
					>
						{labels.discard}
					</Button>
					<Button type="submit" form={form} size="sm">
						{labels.save}
						{labels.shortcut ? <Keyboard>{labels.shortcut}</Keyboard> : null}
					</Button>
				</div>
			);
		};
	},
);
