/**
 * Live example for a flash toast: the server read a session flash and rendered it into the
 * same `Toasts` stack client toasts use. It shows and closes without JavaScript; once the
 * island hydrates it adopts the element and starts the timer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Toasts } from "@sdxc/ui/app/toasts";

/** The source the page shows, matching the markup below. */
const CODE = `// In the layout's controller:
let flash = session.get("toast"); // set by the redirecting action
// { id: "6f1c…", color: "success", title: "Monitor deleted",
//   action: { label: "Undo", form: { action: "/monitors/restore", fields: { id } } } }

<Toasts
	labels={{ region: "Notifications", dismiss: "Dismiss" }}
	initial={flash ? [flash] : []}
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Flash from the server",
	code: CODE,
	render: () => (
		<Toasts
			labels={{ region: "Flash notifications", dismiss: "Dismiss" }}
			queue="toast-flash"
			placement="bottom-start"
			initial={[
				{
					id: "flash-monitor-deleted",
					color: "success",
					title: "Monitor deleted",
					description: "Checkout API",
					duration: 8000,
					action: {
						label: "Undo",
						form: { action: "#restore", method: "get", fields: { monitor: "checkout-api" } },
					},
				},
			]}
		/>
	),
};
