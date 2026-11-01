/**
 * Live example for a dismissible `Banner`: news the reader can close. The close button
 * submits a form, so the server records the dismissal and stops rendering the strip.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Banner } from "@sdxc/ui/banner";

/** The source the page shows, matching the markup below. */
const CODE = `<Banner
	label="Maintenance"
	dismiss={{ label: "Dismiss", action: "/banners/dismiss", fields: { id: "maintenance-nov" } }}
>
	Checks pause for 10 minutes on Sunday at 02:00 UTC.
</Banner>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Dismissible",
	code: CODE,
	render: () => (
		<Banner
			label="Maintenance"
			dismiss={{
				label: "Dismiss",
				action: "#dismiss",
				method: "get",
				fields: { id: "maintenance-nov" },
			}}
		>
			Checks pause for 10 minutes on Sunday at 02:00 UTC.
		</Banner>
	),
};
