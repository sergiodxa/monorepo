/**
 * Relay's keyboard help sheet as its own island, opened by `?` or the top bar's button. The
 * sheet renders once the island runs in the browser, under a heading scope, so its title is
 * an `<h2>` and the screen's own title stays the page's only `<h1>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { HeadingScope } from "@sdxc/ui";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import { clientEntry } from "remix/component";

import { HELP_LABELS } from "~/resources/views/demo-apps/relay/labels";

/** The id of the sheet, which the top bar's button opens. */
export const HELP_ID = "relay-keys";

/** The keys the sheet lists beside the ones the page declares with `data-shortcut`. */
const HELP_GROUPS: KeyboardHelp.Group[] = [
	{
		title: "Inbox",
		shortcuts: [
			{ keys: ["j", "arrowdown"], label: "Next conversation" },
			{ keys: ["k", "arrowup"], label: "Previous conversation" },
			{ keys: "r", label: "Reply" },
			{ keys: "a", label: "Assign conversation" },
			{ keys: "s", label: "Snooze conversation" },
			{ keys: "e", label: "Archive conversation" },
		],
	},
	{
		title: "General",
		shortcuts: [
			{ keys: "mod+k", label: "Open command menu" },
			{ keys: "/", label: "Search contacts" },
			{ keys: "?", label: "Show keyboard shortcuts" },
		],
	},
];

/**
 * The help sheet, a heading level under the screen's title. The server sends an empty
 * placeholder and the browser draws the sheet after hydrating, because every key the sheet
 * lists needs the browser's script to answer anyway.
 */
export const RelayKeyboardHelp = clientEntry(
	import.meta.url,
	function RelayKeyboardHelp(handle: Handle) {
		let mounted = false;

		return () => {
			if (!mounted) {
				handle.queueTask(() => {
					if (typeof document === "undefined" || mounted) return;
					mounted = true;
					void handle.update();
				});
				return <span hidden data-slot="relay-keyboard-help" />;
			}
			return (
				<HeadingScope level={2}>
					<KeyboardHelp id={HELP_ID} labels={HELP_LABELS} groups={HELP_GROUPS} />
				</HeadingScope>
			);
		};
	},
);
