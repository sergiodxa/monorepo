/**
 * Live preview for `ViewOptions`: the Display popover of a monitors list, with layout,
 * grouping, ordering, density and visible properties written to the URL, and Set as default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LayoutGridIcon, LayoutListIcon, TableIcon } from "@sdxc/icons";
import { ViewOptions } from "@sdxc/ui/app/view-options";

/** The source the page shows, matching the markup below. */
const CODE = `<ViewOptions
	id="monitors-view"
	url={request.url}
	layout={{ defaultValue: "table", options: [
		{ value: "list", label: "List", icon: <LayoutListIcon /> },
		{ value: "table", label: "Table", icon: <TableIcon /> },
		{ value: "grid", label: "Grid", icon: <LayoutGridIcon /> },
	] }}
	grouping={{ defaultValue: "none", options: [
		{ value: "none", label: "No grouping" }, { value: "status", label: "Status" }, { value: "region", label: "Region" },
	] }}
	ordering={{ defaultValue: "name", options: [
		{ value: "name", label: "Name" }, { value: "-checked", label: "Last checked" },
	] }}
	density={{ defaultValue: "compact", options: [
		{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" },
	] }}
	properties={{ defaultValue: ["status", "uptime", "response"], options: [
		{ value: "status", label: "Status" }, { value: "uptime", label: "Uptime" },
		{ value: "response", label: "Response time" }, { value: "region", label: "Region" },
		{ value: "tags", label: "Tags" },
	] }}
	setDefault={{ action: "/settings/views/monitors" }}
	labels={{ trigger: "Display", layout: "Layout", grouping: "Grouping", ordering: "Ordering",
		density: "Density", properties: "Properties", apply: "Apply", setDefault: "Set as default" }}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<ViewOptions
			id="preview-monitors-view"
			url="/examples/monitors?status=down&group=region"
			layout={{
				defaultValue: "table",
				options: [
					{ value: "list", label: "List", icon: <LayoutListIcon size={16} /> },
					{ value: "table", label: "Table", icon: <TableIcon size={16} /> },
					{ value: "grid", label: "Grid", icon: <LayoutGridIcon size={16} /> },
				],
			}}
			grouping={{
				defaultValue: "none",
				options: [
					{ value: "none", label: "No grouping" },
					{ value: "status", label: "Status" },
					{ value: "region", label: "Region" },
				],
			}}
			ordering={{
				defaultValue: "name",
				options: [
					{ value: "name", label: "Name" },
					{ value: "-checked", label: "Last checked" },
				],
			}}
			density={{
				defaultValue: "compact",
				options: [
					{ value: "compact", label: "Compact" },
					{ value: "comfortable", label: "Comfortable" },
				],
			}}
			properties={{
				defaultValue: ["status", "uptime", "response"],
				options: [
					{ value: "status", label: "Status" },
					{ value: "uptime", label: "Uptime" },
					{ value: "response", label: "Response time" },
					{ value: "region", label: "Region" },
					{ value: "tags", label: "Tags" },
				],
			}}
			setDefault={{ action: "/examples/settings/views/monitors" }}
			labels={{
				trigger: "Display",
				layout: "Layout",
				grouping: "Grouping",
				ordering: "Ordering",
				density: "Density",
				properties: "Properties",
				apply: "Apply",
				setDefault: "Set as default",
			}}
		/>
	),
};
