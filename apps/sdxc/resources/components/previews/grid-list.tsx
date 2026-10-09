/**
 * Live preview island for `GridList`. Each row already carries the key a behavior
 * correlates it by, and the list renders and reads fine with no script; the roving focus,
 * the multi-row selection and the bulk actions that follow from it are the consumer's, so
 * the preview carries the wiring an inbox would write — `gridListKeys(model)` for the ARIA
 * grid pattern by key and by pointer, and a toolbar reading its counts straight off the
 * `SelectionModel`.
 *
 * A row is a flex line, so what the cells measure is the consumer's too: the sender takes a
 * fixed column and the subject and preview split what is left evenly, since cells left to
 * size themselves start at a different place on every row and the list stops reading as a
 * table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArchiveIcon, MailIcon, Trash2Icon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { basis, grow, hstack, shrink, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text, truncate, weight } from "@sdxc/u/typography";
import { Badge, Button, GridList } from "@sdxc/ui";
import { SelectionModel } from "@sdxc/ui/behaviors";
import { gridListKeys } from "@sdxc/ui/mixins";
import { clientEntry, ref } from "remix/component";

/** The thread rows the list holds, grouped the way an inbox groups by arrival. */
const THREADS = [
	{
		id: "thread-1",
		section: "Today",
		from: "Marta Ruiz",
		subject: "Q3 invoice is ready",
		preview: "Attached, due the 30th.",
	},
	{
		id: "thread-2",
		section: "Today",
		from: "Deploy bot",
		subject: "api-gateway deployed to production",
		preview: "12 commits, 4 minutes.",
	},
	{
		id: "thread-3",
		section: "Earlier this week",
		from: "Tomás Oliveira",
		subject: "Re: onboarding copy",
		preview: "Two notes on the second screen.",
	},
	{
		id: "thread-4",
		section: "Earlier this week",
		from: "Security",
		subject: "New sign-in from Lisbon",
		preview: "Chrome on macOS, 14:02.",
	},
];

/** The section headings, in the order the list shows them. */
const SECTIONS = ["Today", "Earlier this week"];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const GRID_LIST_CODE = `let model = new SelectionModel({ keys: THREADS.map((thread) => thread.id) });

// ref() fires on insert, so the subscription is set up in the browser and torn
// down with the node — the server renders the list without one.
let followSelection = ref((_node, signal) => {
	model.addEventListener("change", () => void handle.update(), { signal });
});

<div mix={[followSelection]}>
	<div mix={[hstack({ gap: 2, align: "center" })]}>
		<Button variant="outline" color="neutral" size="sm" disabled={model.isEmpty}>
			<ArchiveIcon />
			Archive
		</Button>
		<Button variant="outline" color="danger" size="sm" disabled={model.isEmpty}>
			<Trash2Icon />
			Delete
		</Button>
		<Badge color="neutral">{model.size} selected</Badge>
	</div>

	<GridList aria-label="Inbox" mix={[gridListKeys(model)]}>
		{SECTIONS.map((section) => (
			<GridList.Section key={section} aria-labelledby={\`inbox-\${section}\`}>
				<GridList.Header id={\`inbox-\${section}\`}>{section}</GridList.Header>
				{THREADS.filter((thread) => thread.section === section).map((thread) => (
					<GridList.Item key={thread.id} id={thread.id}>
						<MailIcon aria-hidden="true" />
						<span mix={[is("7rem"), shrink(), truncate()]}>{thread.from}</span>
						<span mix={[basis(0), grow(), truncate()]}>{thread.subject}</span>
						<span mix={[basis(0), grow(), truncate()]}>{thread.preview}</span>
					</GridList.Item>
				))}
			</GridList.Section>
		))}
	</GridList>
</div>`;

/** An inbox list, hydrated so arrows, Space, Shift-arrow and clicks all reach the model. */
export const GridListPreview = clientEntry(
	import.meta.url,
	function GridListPreview(handle: Handle) {
		let model = new SelectionModel({ keys: THREADS.map((thread) => thread.id) });

		// ref() fires on insert, so the subscription is set up in the browser and torn
		// down with the node — the server renders the list without one.
		let followSelection = ref((_node, signal) => {
			model.addEventListener("change", () => void handle.update(), { signal });
		});

		return () => (
			<div mix={[vstack({ gap: 3, align: "stretch" }), is("28rem"), followSelection]}>
				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<Button variant="outline" color="neutral" size="sm" disabled={model.isEmpty}>
						<ArchiveIcon />
						Archive
					</Button>
					<Button variant="outline" color="danger" size="sm" disabled={model.isEmpty}>
						<Trash2Icon />
						Delete
					</Button>
					<Badge color="neutral">{String(model.size)} selected</Badge>
				</div>

				<GridList aria-label="Inbox" mix={[gridListKeys(model)]}>
					{SECTIONS.map((section) => (
						<GridList.Section key={section} aria-labelledby={`preview-inbox-${section}`}>
							<GridList.Header id={`preview-inbox-${section}`}>{section}</GridList.Header>
							{THREADS.filter((thread) => thread.section === section).map((thread) => (
								<GridList.Item key={thread.id} id={thread.id}>
									<MailIcon aria-hidden="true" />
									<span mix={[text("sm"), weight("medium"), is("7rem"), shrink(), truncate()]}>
										{thread.from}
									</span>
									<span mix={[text("sm"), weight("medium"), basis(0), grow(), truncate()]}>
										{thread.subject}
									</span>
									<span mix={[text("sm"), fg("neutral"), basis(0), grow(), truncate()]}>
										{thread.preview}
									</span>
								</GridList.Item>
							))}
						</GridList.Section>
					))}
				</GridList>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: GRID_LIST_CODE, render: () => <GridListPreview /> };
