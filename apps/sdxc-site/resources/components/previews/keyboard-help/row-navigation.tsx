/**
 * Live example island for `rowNavigation` beside a `KeyboardHelp`: a monitor list walked with
 * `j`/`k`, opened with Enter, selected with `x`, searched with `/`, whose keys the sheet lists
 * under their own group once the page has registered them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { borderEdge, fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, maxIs, p, pb, pi } from "@sdxc/u/size";
import { tabularNums, text } from "@sdxc/u/typography";
import { Button, Input } from "@sdxc/ui";
import { KeyboardHelp, rowNavigation } from "@sdxc/ui/app";
import { Announcer } from "@sdxc/ui/behaviors";
import { clientEntry } from "remix/component";

/** The monitors the list shows, as an ops dashboard lists its checks. */
const MONITORS = [
	{ id: "api", name: "api.pulse.dev", status: "Up", latency: "84 ms" },
	{ id: "status", name: "status.pulse.dev", status: "Up", latency: "112 ms" },
	{ id: "cdn", name: "cdn.pulse.dev", status: "Degraded", latency: "640 ms" },
	{ id: "webhooks", name: "hooks.pulse.dev", status: "Down", latency: "—" },
];

/** The source the page shows, matching the markup below. */
const CODE = `let announcer = new Announcer({ hold: 1200 });

<Input id="monitor-search" type="search" aria-label="Search monitors" placeholder="Search monitors" />

<ul
	mix={[
		rowNavigation({
			search: "monitor-search",
			announcer,
			labels: {
				group: "Monitors",
				next: "Next monitor",
				previous: "Previous monitor",
				open: "Open monitor",
				toggle: "Select monitor",
				search: "Search monitors",
				selected: "Selected",
				deselected: "Deselected",
			},
		}),
	]}
>
	{monitors.map((monitor) => (
		<li key={monitor.id}>
			<input type="checkbox" data-selection-item name="monitor" value={monitor.id} aria-label={\`Select \${monitor.name}\`} />
			<a href={\`/monitors/\${monitor.id}\`}>{monitor.name}</a>
			<span>{monitor.status}</span>
			<span>{monitor.latency}</span>
		</li>
	))}
</ul>

<div role="status" mix={[visuallyHidden()]}>{announcer.current?.text}</div>
<Button commandfor="list-keys" command="show-modal">Keyboard shortcuts</Button>
<KeyboardHelp id="list-keys" labels={labels} />`;

/** A monitor list driven from the keyboard, with the help sheet that lists its keys. */
export const RowNavigationExample = clientEntry(
	import.meta.url,
	function RowNavigationExample(handle: Handle) {
		let announcer = new Announcer({ hold: 1200 });
		announcer.addEventListener("change", () => void handle.update());

		return () => (
			<div mix={[vstack({ gap: 3, align: "stretch" }), is("100%"), maxIs("32rem")]}>
				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<Input
						id="monitor-search"
						type="search"
						aria-label="Search monitors"
						placeholder="Search monitors  /"
					/>
					<Button
						type="button"
						commandfor="list-keys"
						command="show-modal"
						variant="outline"
						color="neutral"
						size="sm"
					>
						Shortcuts
					</Button>
				</div>

				<ul
					aria-label="Monitors"
					mix={[
						p(0),
						rowNavigation({
							search: "monitor-search",
							announcer,
							labels: {
								group: "Monitors",
								next: "Next monitor",
								previous: "Previous monitor",
								open: "Open monitor",
								toggle: "Select monitor",
								search: "Search monitors",
								selected: "Selected",
								deselected: "Deselected",
							},
						}),
					]}
				>
					{MONITORS.map((monitor) => (
						<li
							key={monitor.id}
							mix={[
								hstack({ gap: 3, align: "center" }),
								pi(3),
								pb(2),
								text("sm"),
								borderEdge("block-end", { color: "neutral", width: 1 }),
							]}
						>
							<input
								type="checkbox"
								data-selection-item
								name="monitor"
								value={monitor.id}
								aria-label={`Select ${monitor.name}`}
							/>
							<a href={`/examples/monitors/${monitor.id}`} mix={[is("100%")]}>
								{monitor.name}
							</a>
							<span mix={[fg("neutral.muted")]}>{monitor.status}</span>
							<span mix={[tabularNums(), fg("neutral.muted")]}>{monitor.latency}</span>
						</li>
					))}
				</ul>

				<p mix={[text("sm"), fg("neutral.muted")]}>
					Press j and k to move, x to select, Enter to open, / to search, ? for every key.
				</p>

				<div role="status" mix={[visuallyHidden()]}>
					{announcer.current?.text ?? ""}
				</div>

				<KeyboardHelp
					id="list-keys"
					labels={{
						title: "Keyboard shortcuts",
						close: "Close",
						or: "or",
						open: "Show keyboard shortcuts",
						general: "General",
						other: "More",
					}}
				/>
			</div>
		);
	},
);

/** What the example registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "Row navigation in a list",
	code: CODE,
	render: () => <RowNavigationExample />,
};
