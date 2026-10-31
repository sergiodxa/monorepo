/**
 * Live preview for `PropsTable`: the fields of an HTTP monitor, with a long union type
 * that wraps in its cell and an `assertions` object whose child fields expand in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PropsTable as PropsTableTypes } from "@sdxc/ui";

import { is } from "@sdxc/u/size";
import { PropsTable } from "@sdxc/ui";

/** Every string the table prints. */
const LABELS: PropsTableTypes.Labels = {
	name: "Name",
	type: "Type",
	default: "Default",
	required: "Required",
	description: "Description",
	yes: "Yes",
	no: "No",
	showChildren: "Show child parameters",
	hideChildren: "Hide child parameters",
};

/** An HTTP monitor's fields, the way a request-body reference lists them. */
const ROWS: PropsTableTypes.Row[] = [
	{ name: "url", type: "string", required: true, description: "The address every probe requests." },
	{
		name: "method",
		type: '"GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE"',
		default: '"GET"',
		description: "The HTTP method each probe sends.",
	},
	{
		name: "intervalSeconds",
		type: "number",
		default: "60",
		description: "How often each region probes.",
	},
	{
		name: "assertions",
		type: "object",
		description: "What a response must satisfy to count as up.",
		children: [
			{ name: "status", type: "number", default: "200", description: "The status code to expect." },
			{
				name: "maxLatencyMs",
				type: "number",
				description: "The slowest response that still passes.",
			},
			{ name: "bodyContains", type: "string", description: "Text the body must include." },
		],
	},
];

/** The source the page shows, matching the markup below. */
const CODE = `<PropsTable
	aria-label="HTTP monitor fields"
	labels={labels}
	rows={[
		{ name: "url", type: "string", required: true, description: "The address every probe requests." },
		{ name: "method", type: '"GET" | "HEAD" | "POST" | …', default: '"GET"', description: "…" },
		{ name: "assertions", type: "object", description: "…", children: [
			{ name: "status", type: "number", default: "200", description: "The status code to expect." },
		] },
	]}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<PropsTable aria-label="HTTP monitor fields" labels={LABELS} rows={ROWS} />
		</div>
	),
};
