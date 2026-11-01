/**
 * Live example for `Group.Text`: a static addon composed onto an `Input` by hand. The
 * addon is a `<label>` pointing at the input, so a click on it focuses the field, and its
 * id joins the input's `aria-describedby`; the markup needs no island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Group, Input, Label } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<Label id="slug-label" htmlFor="slug">Workspace URL</Label>
<Group>
	<Group.Text id="slug-prefix" htmlFor="slug">pulse.dev/</Group.Text>
	<Input id="slug" name="slug" defaultValue="northwind" aria-labelledby="slug-label" aria-describedby="slug-prefix" />
</Group>

<Label id="latency-label" htmlFor="latency">Latency budget</Label>
<Group>
	<Input id="latency" name="latency" type="number" defaultValue="250" aria-labelledby="latency-label" aria-describedby="latency-unit" />
	<Group.Text id="latency-unit" htmlFor="latency">ms</Group.Text>
</Group>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "With an addon",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 2, align: "stretch" }), is("24rem")]}>
			<Label id="preview-slug-label" htmlFor="preview-slug">
				Workspace URL
			</Label>
			<Group>
				<Group.Text id="preview-slug-prefix" htmlFor="preview-slug">
					pulse.dev/
				</Group.Text>
				<Input
					id="preview-slug"
					name="slug"
					defaultValue="northwind"
					aria-labelledby="preview-slug-label"
					aria-describedby="preview-slug-prefix"
				/>
			</Group>
			<Label id="preview-latency-label" htmlFor="preview-latency">
				Latency budget
			</Label>
			<Group>
				<Input
					id="preview-latency"
					name="latency"
					type="number"
					defaultValue="250"
					aria-labelledby="preview-latency-label"
					aria-describedby="preview-latency-unit"
				/>
				<Group.Text id="preview-latency-unit" htmlFor="preview-latency">
					ms
				</Group.Text>
			</Group>
		</div>
	),
};
