/**
 * Live preview island for `Keyboard`. A `<kbd>` is inline text, so a row of them only
 * reads as a shortcut once the row itself lines the label up against the keys — the
 * baseline alignment and the fixed gap are the example.
 *
 * Which keyboard is in front of the reader is read from the request's own user agent, so
 * the glyphs are right in the first paint and stay right through hydration — the answer
 * travels with the island as a prop rather than waiting for script to look it up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Header, Keyboard, Separator } from "@sdxc/ui";
import { clientEntry } from "remix/ui";

import type { PreviewRequest } from "~/resources/components/ui-previews.server";

import { shortcutKeys } from "~/app/services/shortcut-keys";

/** The shortcuts the panel lists, written as abstract combos rather than glyphs. */
const SHORTCUTS = [
	{ group: "Navigation", action: "Open the command menu", combo: "mod+k" },
	{ group: "Navigation", action: "Go to the inbox", combo: "g+i" },
	{ group: "Editing", action: "Save the draft", combo: "mod+s" },
	{ group: "Editing", action: "Undo the last change", combo: "mod+shift+z" },
	{ group: "Editing", action: "Dismiss the editor", combo: "esc" },
];

/** The group headings, in the order the panel shows them. */
const GROUPS = ["Navigation", "Editing"];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const KEYBOARD_CODE = `// The request already says which keyboard is in front of the reader, so the controller
// reads it once and hands the answer to the island.
let appleKeyboard = isAppleKeyboard(parse(request.headers.get("user-agent") ?? "").os.name);

<KeyboardShortcuts appleKeyboard={appleKeyboard} />

// …and inside the island, the glyphs are chosen with no lookup of its own:
<div>
	{GROUPS.map((group, index) => (
		<section key={group}>
			{index > 0 ? <Separator /> : null}
			<Header>{group}</Header>
			{SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => (
				<div key={shortcut.combo} mix={[hstack({ gap: 4, align: "baseline", justify: "between" })]}>
					<span>{shortcut.action}</span>
					<span mix={[hstack({ gap: 1, align: "baseline" })]}>
						{shortcutKeys(shortcut.combo, appleKeyboard).map((key) => (
							<Keyboard key={key}>{key}</Keyboard>
						))}
					</span>
				</div>
			))}
		</section>
	))}
</div>`;

/** A shortcuts panel, hydrated so each hint prints the keys this machine actually has. */
export const KeyboardPreview = clientEntry(
	"/resources/components/previews/keyboard.tsx#KeyboardPreview",
	function KeyboardPreview(handle: Handle<{ appleKeyboard: boolean }>) {
		return () => (
			<div mix={[vstack({ gap: 4, align: "stretch" }), is("22rem")]}>
				{GROUPS.map((group, index) => (
					<section key={group} mix={[vstack({ gap: 2, align: "stretch" })]}>
						{index > 0 ? <Separator /> : null}
						<Header>{group}</Header>
						{SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => (
							<div
								key={shortcut.combo}
								mix={[hstack({ gap: 4, align: "baseline", justify: "between" })]}
							>
								<span mix={[text("sm"), fg("neutral.emphasis")]}>{shortcut.action}</span>
								<span mix={[hstack({ gap: 1, align: "baseline" })]}>
									{shortcutKeys(shortcut.combo, handle.props.appleKeyboard).map((key) => (
										<Keyboard key={key}>{key}</Keyboard>
									))}
								</span>
							</div>
						))}
					</section>
				))}
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default {
	code: KEYBOARD_CODE,
	render: ({ appleKeyboard }: PreviewRequest) => <KeyboardPreview appleKeyboard={appleKeyboard} />,
};
