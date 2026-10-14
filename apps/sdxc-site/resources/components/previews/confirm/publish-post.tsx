/**
 * Live example for a `Confirm` in the brand color, for a decision that is weighty but not
 * destructive. The trigger opens it through `commandfor`/`command="show-modal"` and both
 * buttons close it the same way, so the example is plain markup that needs no island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Confirm } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<Button commandfor="publish-post" command="show-modal" color="brand">Publish</Button>

<Confirm
	id="publish-post"
	title="Publish “Shipping the Acme 2.0 editor”?"
	confirmLabel="Publish"
	cancelLabel="Keep editing"
	color="brand"
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Brand color",
	code: CODE,
	render: () => (
		<>
			<Button commandfor="example-confirm-publish-post" command="show-modal" color="brand">
				Publish
			</Button>

			<Confirm
				id="example-confirm-publish-post"
				title="Publish “Shipping the Acme 2.0 editor”?"
				confirmLabel="Publish"
				cancelLabel="Keep editing"
				color="brand"
			/>
		</>
	),
};
