/**
 * Live preview for `Banner`: an overdue card, the account state that needs resolving, so
 * the strip has no close control and carries the one action that fixes it. It sits above
 * the app frame and pushes it down rather than covering it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button } from "@sdxc/ui";
import { Banner } from "@sdxc/ui/banner";

/** The source the page shows, matching the markup below. */
const BANNER_CODE = `<Banner
	color="warning"
	label="Billing"
	action={<Button size="sm">Update Payment Method</Button>}
>
	Your card ending 4242 was declined. Update it to keep 48 monitors running.
</Banner>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: BANNER_CODE,
	render: () => (
		<Banner
			color="warning"
			label="Billing"
			action={<Button size="sm">Update Payment Method</Button>}
		>
			Your card ending 4242 was declined. Update it to keep 48 monitors running.
		</Banner>
	),
};
