/**
 * Live example island for the toast stack. Five toasts arrive at once; three show, the
 * older two fold behind the newest at 0.95 and 0.9, and hovering or focusing the stack
 * fans it out and holds every timer until you leave.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button } from "@sdxc/ui";
import { pageToaster } from "@sdxc/ui/app/toast";
import { Toasts } from "@sdxc/ui/app/toasts";
import { clientEntry, on } from "remix/component";

/** The queue this example draws, kept apart from the other stacks on the page. */
const QUEUE = "toast-stack";

/** Monitors a bulk action pauses, one toast each, so the stack has something to fold. */
const MONITORS = ["Checkout API", "Search", "Webhooks", "Status page", "Billing"];

/** The source the page shows, matching the markup below. */
const CODE = `<Button
	mix={[
		on("click", () => {
			for (let name of monitors) pageToaster().add({ title: \`\${name} paused\` });
		}),
	]}
>
	Pause five monitors
</Button>

<Toasts labels={{ region: "Notifications", dismiss: "Dismiss" }} max={3} />`;

/** A bulk action that raises five toasts at once into a capped stack. */
export const StackedToasts = clientEntry(import.meta.url, function StackedToasts() {
	let toaster = pageToaster(QUEUE);

	return () => (
		<>
			<Button
				mix={[
					on<HTMLButtonElement, "click">("click", () => {
						for (let name of MONITORS) toaster.add({ title: `${name} paused` }, { duration: 8000 });
					}),
				]}
			>
				Pause five monitors
			</Button>
			<Toasts labels={{ region: "Notifications", dismiss: "Dismiss" }} max={3} queue={QUEUE} />
		</>
	);
});

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default { title: "Stack", code: CODE, render: () => <StackedToasts /> };
