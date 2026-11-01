/**
 * Live preview island for `Toast`. A notification is only worth looking at when something
 * raises it, so the example is the page's queue behind the `Toasts` stack and the buttons an
 * app would raise from. Copy states the outcome ("Status page published"), six words at most.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { Button } from "@sdxc/ui";
import { pageToaster } from "@sdxc/ui/app/toast";
import { Toasts } from "@sdxc/ui/app/toasts";
import { clientEntry, on } from "remix/component";

/** The queue this preview draws, kept apart from the examples' stacks on the same page. */
const QUEUE = "toast-preview";

/** The source the page shows, matching the markup below. */
const TOAST_CODE = `<div mix={[hstack({ gap: 2, align: "center" })]}>
	<Button
		mix={[
			on("click", () =>
				pageToaster().add({ color: "success", title: "Status page published" }),
			),
		]}
	>
		Publish
	</Button>
	<Button
		color="danger"
		variant="outline"
		mix={[
			on("click", () =>
				pageToaster().add({
					color: "danger",
					title: "Couldn't upload checks.yml",
					description: "Unknown key “retires”. Fix it and try again.",
				}),
			),
		]}
	>
		Upload a bad file
	</Button>
</div>

{/* Once, in the app layout: */}
<Toasts labels={{ region: "Notifications", dismiss: "Dismiss" }} />`;

/** Buttons that raise real toasts into the page's one stack. */
export const ToastPreview = clientEntry(import.meta.url, function ToastPreview() {
	let toaster = pageToaster(QUEUE);

	return () => (
		<>
			<div mix={[hstack({ gap: 2, align: "center" })]}>
				<Button
					mix={[
						on<HTMLButtonElement, "click">(
							"click",
							() => void toaster.add({ color: "success", title: "Status page published" }),
						),
					]}
				>
					Publish
				</Button>
				<Button
					color="danger"
					variant="outline"
					mix={[
						on<HTMLButtonElement, "click">(
							"click",
							() =>
								void toaster.add({
									color: "danger",
									title: "Couldn't upload checks.yml",
									description: "Unknown key “retires”. Fix it and try again.",
								}),
						),
					]}
				>
					Upload a bad file
				</Button>
			</div>
			<Toasts labels={{ region: "Notifications", dismiss: "Dismiss" }} queue={QUEUE} />
		</>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TOAST_CODE, render: () => <ToastPreview /> };
