/**
 * Live example for a `Link` the reader cannot follow yet. `aria-disabled="true"` mutes it
 * and the missing `href` is what stops navigation, so the link reads as unavailable and
 * stays inert with no script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Link } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<p mix={[m(0), text("sm"), fg("neutral")]}>
	<Link aria-disabled="true">Billing settings</Link> open once an owner adds a payment method.
</p>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Disabled",
	code: CODE,
	render: () => (
		<p mix={[m(0), text("sm"), fg("neutral")]}>
			<Link aria-disabled="true">Billing settings</Link> open once an owner adds a payment method.
		</p>
	),
};
