/**
 * Live example for `DropIndicator` laid over a row's top edge. Each bar is positioned
 * absolutely inside its row, so it takes no space of its own and the list keeps its rest
 * spacing; the markup is the frame a drag paints while a task is held over "Ship 2.0".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { absolute, insBs, insIs, relative, vstack } from "@sdxc/u/layout";
import { is, pb, pi } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { DropIndicator } from "@sdxc/ui";

/** The tasks in the list, in their current order. */
const TASKS = [
	{ id: "notes", label: "Write release notes" },
	{ id: "ship", label: "Ship 2.0" },
	{ id: "announce", label: "Announce on the blog" },
];

/** The row whose top edge the held task would land on. */
const DROP_TARGET_KEY = "ship";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `let tasks = [
	{ id: "notes", label: "Write release notes" },
	{ id: "ship", label: "Ship 2.0" },
	{ id: "announce", label: "Announce on the blog" },
];
let dropTargetKey = "ship";

<div role="list" aria-label="Launch tasks" mix={[vstack({ gap: 2, align: "stretch" })]}>
	{tasks.map((task) => (
		<div
			key={task.id}
			role="listitem"
			mix={[relative(), pi(3), pb(2), rounded("md"), border({ color: "neutral.border", width: 1 }), text("sm")]}
		>
			<DropIndicator
				isDropTarget={task.id === dropTargetKey}
				mix={[absolute(), insIs(0), insBs("-0.0625rem")]}
			/>
			{task.label}
		</div>
	))}
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Overlaid on a row edge",
	code: CODE,
	render: () => (
		<div
			role="list"
			aria-label="Launch tasks"
			mix={[vstack({ gap: 2, align: "stretch" }), is("18rem")]}
		>
			{TASKS.map((task) => (
				<div
					key={task.id}
					role="listitem"
					mix={[
						relative(),
						pi(3),
						pb(2),
						rounded("md"),
						border({ color: "neutral.border", width: 1 }),
						text("sm"),
					]}
				>
					<DropIndicator
						isDropTarget={task.id === DROP_TARGET_KEY}
						mix={[absolute(), insIs(0), insBs("-0.0625rem")]}
					/>
					{task.label}
				</div>
			))}
		</div>
	),
};
