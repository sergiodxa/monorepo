/**
 * Relay's keyboard help sheet, opened by `?` or the top bar's button. It lists the inbox's
 * keys beside the ones the page declares with `data-shortcut`, titled at `<h2>` so the
 * screen's own title stays the page's only `<h1>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";

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

/** The help sheet, server-rendered closed and opened by its island. */
export function RelayKeyboardHelp() {
	return () => <KeyboardHelp id={HELP_ID} labels={HELP_LABELS} groups={HELP_GROUPS} />;
}
