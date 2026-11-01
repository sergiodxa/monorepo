/**
 * Live preview for `SelectionBar`: a short monitors list whose rows carry
 * `data-selection-item` checkboxes. The bar reads "Viewing 1–5 of 1,213" until a row is
 * checked, then turns into the count with Pause, Archive and Delete and their keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ArchiveIcon, PauseIcon, Trash2Icon } from "@sdxc/icons";
import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, gap, items, vstack } from "@sdxc/u/layout";
import { divide } from "@sdxc/u/overflow";
import { m, mis, pb, pbe, pi } from "@sdxc/u/size";
import { tabularNums, text } from "@sdxc/u/typography";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";
import { StatusDot } from "@sdxc/ui/status-dot";

/** One monitor in the list. */
interface Monitor {
	id: string;
	name: string;
	status: "success" | "warning" | "danger";
	uptime: string;
}

/** The first page of monitors. */
const MONITORS: Monitor[] = [
	{ id: "mon_api", name: "api.acme.com/health", status: "success", uptime: "99.98%" },
	{ id: "mon_checkout", name: "checkout.acme.com", status: "danger", uptime: "97.12%" },
	{ id: "mon_web", name: "www.acme.com", status: "success", uptime: "100%" },
	{ id: "mon_search", name: "search.acme.com/ready", status: "warning", uptime: "99.41%" },
	{ id: "mon_cdn", name: "cdn.acme.com/ping", status: "success", uptime: "99.99%" },
];

/** The source the page shows, matching the markup below. */
const CODE = `<form id="monitors" method="post" action="/monitors/bulk">
	{monitors.map((monitor) => (
		<label>
			<input type="checkbox" data-selection-item name="id" value={monitor.id} />
			{monitor.name}
		</label>
	))}
</form>

<SelectionBar
	target="monitors"
	pagination={{ summary: "Viewing 1–5 of 1,213", next: "?page=2" }}
	actions={[
		{ label: "Pause", key: "p", icon: <PauseIcon />, name: "intent", value: "pause" },
		{ label: "Archive", key: "a", icon: <ArchiveIcon />, name: "intent", value: "archive" },
		{ label: "Delete", key: "x", icon: <Trash2Icon />, name: "intent", value: "delete", danger: true },
	]}
	labels={{
		toolbar: "Monitors", clear: "Clear selection", selected: "{count} selected",
		cleared: "Selection cleared", previous: "Previous page", next: "Next page",
	}}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 4 }), pbe(2)]}>
			<form
				id="preview-monitors-bulk"
				method="post"
				action="/examples/monitors/bulk"
				mix={[m(0), rounded("lg"), border({ width: 1, color: "neutral.border" }), divide()]}
			>
				{MONITORS.map((monitor) => (
					<label mix={[flex(), items("center"), gap(3), pi(3), pb(2.5), text("sm")]}>
						<input
							type="checkbox"
							data-selection-item
							name="id"
							value={monitor.id}
							aria-label={`Select ${monitor.name}`}
						/>
						<StatusDot color={monitor.status} />
						<span mix={[fg("neutral.emphasis")]}>{monitor.name}</span>
						<span mix={[mis("auto"), fg("neutral.muted"), tabularNums()]}>{monitor.uptime}</span>
					</label>
				))}
			</form>
			<SelectionBar
				target="preview-monitors-bulk"
				pagination={{ summary: "Viewing 1–5 of 1,213", next: "/examples/monitors?page=2" }}
				actions={[
					{
						label: "Pause",
						key: "p",
						icon: <PauseIcon size={16} />,
						name: "intent",
						value: "pause",
					},
					{
						label: "Archive",
						key: "a",
						icon: <ArchiveIcon size={16} />,
						name: "intent",
						value: "archive",
					},
					{
						label: "Delete",
						key: "x",
						icon: <Trash2Icon size={16} />,
						name: "intent",
						value: "delete",
						danger: true,
					},
				]}
				locale="en-US"
				labels={{
					toolbar: "Monitors",
					clear: "Clear selection",
					selected: "{count} selected",
					cleared: "Selection cleared",
					previous: "Previous page",
					next: "Next page",
				}}
			/>
		</div>
	),
};
