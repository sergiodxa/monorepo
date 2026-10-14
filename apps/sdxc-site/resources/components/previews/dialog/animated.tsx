/**
 * Live example for `Dialog` with an entrance animation. The `zoom()` mixin animates the
 * native `<dialog>` as the platform opens and closes it, so the example runs before any
 * script loads and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Dialog } from "@sdxc/ui";
import { durations, zoom } from "@sdxc/ui/animations";

/** The source the page shows, matching the markup below. */
const CODE = `<Button commandfor="welcome" command="show-modal">Show welcome</Button>

<Dialog id="welcome" aria-labelledby="welcome-title" mix={zoom({ duration: durations.normal })}>
	<Dialog.Header>
		<Dialog.Title id="welcome-title">Welcome to Acme</Dialog.Title>
		<Dialog.Description>Your workspace is ready. Invite your team when you are.</Dialog.Description>
	</Dialog.Header>
	<Dialog.Footer>
		<Button commandfor="welcome" command="close">Get started</Button>
	</Dialog.Footer>
</Dialog>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Animated entrance",
	code: CODE,
	render: () => (
		<>
			<Button commandfor="example-dialog-animated" command="show-modal">
				Show welcome
			</Button>

			<Dialog
				id="example-dialog-animated"
				aria-labelledby="example-dialog-animated-title"
				mix={zoom({ duration: durations.normal })}
			>
				<Dialog.Header>
					<Dialog.Title id="example-dialog-animated-title">Welcome to Acme</Dialog.Title>
					<Dialog.Description>
						Your workspace is ready. Invite your team when you are.
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Footer>
					<Button commandfor="example-dialog-animated" command="close">
						Get started
					</Button>
				</Dialog.Footer>
			</Dialog>
		</>
	),
};
