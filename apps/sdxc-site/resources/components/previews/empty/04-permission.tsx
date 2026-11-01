/**
 * Live example for a permission `Empty`: the reader may not see this, so it names who
 * can grant access instead of pretending the section is blank.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Empty } from "@sdxc/ui/app/empty";

/** The source the page shows, matching the markup below. */
const CODE = `<Empty kind="permission">
	<Empty.Title>Billing is for owners</Empty.Title>
	<Empty.Description>Ask Ana Ruiz, the team owner, to give you access.</Empty.Description>
</Empty>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "No permission",
	code: CODE,
	render: () => (
		<Empty kind="permission">
			<Empty.Title>Billing is for owners</Empty.Title>
			<Empty.Description>Ask Ana Ruiz, the team owner, to give you access.</Empty.Description>
		</Empty>
	),
};
