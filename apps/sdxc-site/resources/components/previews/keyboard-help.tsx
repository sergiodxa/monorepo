/**
 * Live preview for `KeyboardHelp`: an ops dashboard's cheat sheet, opened by `?` or the
 * button beside it, listing its navigation, list and general keys in two columns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { KeyboardIcon } from "@sdxc/icons";
import { m } from "@sdxc/u/size";
import { Button, Keyboard } from "@sdxc/ui";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";

/** The source the page shows, matching the markup below. */
const CODE = `<Button commandfor="ops-keys" command="show-modal" variant="outline" color="neutral" size="sm">
	<KeyboardIcon size={16} />
	Keyboard shortcuts
	<Keyboard>?</Keyboard>
</Button>

<KeyboardHelp
	id="ops-keys"
	labels={{
		title: "Keyboard shortcuts",
		close: "Close",
		or: "or",
		open: "Show keyboard shortcuts",
		general: "General",
		other: "More",
	}}
	groups={[
		{
			title: "Navigation",
			shortcuts: [
				{ keys: "g m", label: "Go to Monitors" },
				{ keys: "g i", label: "Go to Incidents" },
				{ keys: "g s", label: "Go to Status Pages" },
			],
		},
		{
			title: "Monitors",
			shortcuts: [
				{ keys: ["j", "arrowdown"], label: "Next monitor" },
				{ keys: ["k", "arrowup"], label: "Previous monitor" },
				{ keys: ["o", "enter"], label: "Open monitor" },
				{ keys: "x", label: "Select monitor" },
				{ keys: "c", label: "Create monitor" },
			],
		},
		{
			title: "General",
			shortcuts: [
				{ keys: "mod+k", label: "Open command menu" },
				{ keys: "/", label: "Search monitors" },
			],
		},
	]}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div>
			<Button
				commandfor="ops-keys"
				command="show-modal"
				variant="outline"
				color="neutral"
				size="sm"
			>
				<KeyboardIcon size={16} aria-hidden="true" />
				Keyboard shortcuts
				<Keyboard mix={[m(0)]}>?</Keyboard>
			</Button>

			<KeyboardHelp
				id="ops-keys"
				labels={{
					title: "Keyboard shortcuts",
					close: "Close",
					or: "or",
					open: "Show keyboard shortcuts",
					general: "General",
					other: "More",
				}}
				groups={[
					{
						title: "Navigation",
						shortcuts: [
							{ keys: "g m", label: "Go to Monitors" },
							{ keys: "g i", label: "Go to Incidents" },
							{ keys: "g s", label: "Go to Status Pages" },
						],
					},
					{
						title: "Monitors",
						shortcuts: [
							{ keys: ["j", "arrowdown"], label: "Next monitor" },
							{ keys: ["k", "arrowup"], label: "Previous monitor" },
							{ keys: ["o", "enter"], label: "Open monitor" },
							{ keys: "x", label: "Select monitor" },
							{ keys: "c", label: "Create monitor" },
						],
					},
					{
						title: "General",
						shortcuts: [
							{ keys: "mod+k", label: "Open command menu" },
							{ keys: "/", label: "Search monitors" },
						],
					},
				]}
			/>
		</div>
	),
};
