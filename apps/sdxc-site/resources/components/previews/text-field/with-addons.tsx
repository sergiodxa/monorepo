/**
 * Live example for `TextField` with a prefix and a suffix. The addon joins the input as
 * one field, describes it, and focuses it when clicked, all from server markup, so the
 * example needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { TextField } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<TextField
	label="Workspace URL"
	name="slug"
	prefix="pulse.dev/"
	defaultValue="northwind"
	description="Teammates open the workspace at this address."
/>
<TextField label="Monthly budget" name="budget" type="number" prefix="$" defaultValue="250" />
<TextField label="Alert after" name="threshold" type="number" suffix="ms" defaultValue="800" />`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "With a prefix or suffix",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 4, align: "stretch" }), is("24rem")]}>
			<TextField
				label="Workspace URL"
				name="slug"
				prefix="pulse.dev/"
				defaultValue="northwind"
				description="Teammates open the workspace at this address."
			/>
			<TextField label="Monthly budget" name="budget" type="number" prefix="$" defaultValue="250" />
			<TextField
				label="Alert after"
				name="threshold"
				type="number"
				suffix="ms"
				defaultValue="800"
			/>
		</div>
	),
};
