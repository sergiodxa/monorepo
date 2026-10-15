/**
 * Live example island for a danger `Toast` carrying an action and a cancel button. The
 * cancel button sends `--ui-dismiss` to the toast's `dismiss()` mixin and the action runs
 * a click handler, so the example hydrates for both buttons to close the toast.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Button, Toast } from "@sdxc/ui";
import { dismiss } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `let open = true;

function close() {
	open = false;
	void handle.update();
}

open ? (
	<Toast
		id="upload-failed"
		color="danger"
		live="assertive"
		mix={[
			dismiss({ duration: null }),
			on<HTMLDivElement, "ui:dismiss">("ui:dismiss", close),
		]}
	>
		<Toast.Content>
			<Toast.Title>Upload of checks.yml failed</Toast.Title>
		</Toast.Content>
		<Toast.Action mix={[on<HTMLButtonElement, "click">("click", close)]}>Retry</Toast.Action>
		<Toast.Cancel commandfor="upload-failed" command="--ui-dismiss">
			Dismiss
		</Toast.Cancel>
	</Toast>
) : (
	<Button
		variant="outline"
		mix={[
			on<HTMLButtonElement, "click">("click", () => {
				open = true;
				void handle.update();
			}),
		]}
	>
		Show the failure again
	</Button>
)`;

/** A failed-upload toast whose buttons close it, hydrated so they run. */
export const ActionAndCancelToast = clientEntry(
	import.meta.url,
	function ActionAndCancelToast(handle: Handle) {
		let open = true;

		/** Takes the toast off the page, as the queue that raised it would. */
		function close() {
			open = false;
			void handle.update();
		}

		return () =>
			open ? (
				<Toast
					id="example-toast-action-and-cancel"
					color="danger"
					live="assertive"
					mix={[dismiss({ duration: null }), on<HTMLDivElement, "ui:dismiss">("ui:dismiss", close)]}
				>
					<Toast.Content>
						<Toast.Title>Upload of checks.yml failed</Toast.Title>
					</Toast.Content>
					<Toast.Action mix={[on<HTMLButtonElement, "click">("click", close)]}>Retry</Toast.Action>
					<Toast.Cancel commandfor="example-toast-action-and-cancel" command="--ui-dismiss">
						Dismiss
					</Toast.Cancel>
				</Toast>
			) : (
				<Button
					variant="outline"
					mix={[
						on<HTMLButtonElement, "click">("click", () => {
							open = true;
							void handle.update();
						}),
					]}
				>
					Show the failure again
				</Button>
			);
	},
);

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "Action and cancel",
	code: CODE,
	render: () => <ActionAndCancelToast />,
};
