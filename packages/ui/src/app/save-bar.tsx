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
import { clientEntry } from "remix/component";

import { Button } from "../components/button.js";
import { Keyboard } from "../components/keyboard.js";

import { saveBarSync } from "./mixins/save-bar-sync.js";
import { saveShortcut } from "./mixins/save-shortcut.js";

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
		return () => {
			let { form, labels } = handle.props;

			return (
				<div
					data-slot="save-bar"
					hidden
					mix={[
						saveBarSync({ form, message: labels.message }),
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
					></p>
					<Button type="reset" form={form} variant="ghost" color="neutral" size="sm">
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

/**
 * Props {@link SaveShortcut} serializes into the page for hydration, which is why they are a
 * `type`: `SerializableProps` rejects an interface.
 */
export type SaveShortcutProps = {
	/** The `id` of the form ⌘S submits; omit when the island sits inside that form. */
	form?: string;
};

/**
 * Client island binding ⌘S/Ctrl+S to a form's primary save: the form holding focus submits, or
 * the only bound form when focus is in none, and a `SaveBar` on the same form steps aside so
 * one keystroke submits once. An explicit `SettingsSection` and `EditorLayout` render it.
 *
 * @example
 * <form method="post"><Input name="name" /><Button type="submit">Save</Button><SaveShortcut /></form>
 */
export const SaveShortcut: EntryComponent<SaveShortcutProps> = clientEntry(
	"@sdxc/ui/app/save-bar#SaveShortcut",
	function SaveShortcut(handle) {
		return () => (
			<span hidden data-slot="save-shortcut" mix={[saveShortcut({ form: handle.props.form })]} />
		);
	},
);
