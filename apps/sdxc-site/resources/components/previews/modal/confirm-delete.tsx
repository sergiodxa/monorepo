/**
 * Live example for `Modal` asking to confirm a destructive action. The close control,
 * the cancel button and the danger button all dismiss the native `<dialog>` through
 * Invoker Commands, so the example is plain markup with no island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Modal } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Button commandfor="confirm-delete" command="show-modal" color="danger" variant="outline">
	Delete project
</Button>

<Modal id="confirm-delete" aria-labelledby="confirm-delete-title">
	<Modal.Close commandfor="confirm-delete" aria-label="Close" />
	<Modal.Header>
		<Modal.Title id="confirm-delete-title">Delete Q3 roadmap?</Modal.Title>
		<Modal.Description>
			Its 48 issues and their comments are removed for everyone at Acme. This cannot be undone.
		</Modal.Description>
	</Modal.Header>
	<Modal.Footer>
		<Button commandfor="confirm-delete" command="close" variant="outline" color="neutral">
			Cancel
		</Button>
		<Button commandfor="confirm-delete" command="close" color="danger">
			Delete project
		</Button>
	</Modal.Footer>
</Modal>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Confirm a deletion",
	code: CODE,
	render: () => (
		<>
			<Button
				commandfor="example-modal-confirm-delete"
				command="show-modal"
				color="danger"
				variant="outline"
			>
				Delete project
			</Button>

			<Modal id="example-modal-confirm-delete" aria-labelledby="example-modal-confirm-delete-title">
				<Modal.Close commandfor="example-modal-confirm-delete" aria-label="Close" />
				<Modal.Header>
					<Modal.Title id="example-modal-confirm-delete-title">Delete Q3 roadmap?</Modal.Title>
					<Modal.Description>
						Its 48 issues and their comments are removed for everyone at Acme. This cannot be
						undone.
					</Modal.Description>
				</Modal.Header>
				<Modal.Footer>
					<Button
						commandfor="example-modal-confirm-delete"
						command="close"
						variant="outline"
						color="neutral"
					>
						Cancel
					</Button>
					<Button commandfor="example-modal-confirm-delete" command="close" color="danger">
						Delete project
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	),
};
