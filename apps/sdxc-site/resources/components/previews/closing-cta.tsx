/**
 * Live preview for `ClosingCta`: the inverse band a landing ends on, with a centered
 * title, a lead and the two actions. A band is a page-width surface, so it meets the
 * frame's edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, HeadingScope, LinkButton } from "@sdxc/ui";
import { ClosingCta } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

/** The source the page shows, matching the markup below. */
const CODE = `<ClosingCta
	title="Start watching your endpoints today"
	description="Five monitors free, forever. Upgrade when the pager needs more."
	actions={
		<>
			<Button size="lg" color="brand" mix={[marketingCtaChrome()]}>
				Create an account
			</Button>
			<LinkButton href="/examples/pricing" size="lg" color="neutral" variant="outline">
				Talk to sales
			</LinkButton>
		</>
	}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<ClosingCta
				title="Start watching your endpoints today"
				description="Five monitors free, forever. Upgrade when the pager needs more."
				actions={
					<>
						<Button size="lg" color="brand" mix={[marketingCtaChrome()]}>
							Create an account
						</Button>
						<LinkButton href="/examples/pricing" size="lg" color="neutral" variant="outline">
							Talk to sales
						</LinkButton>
					</>
				}
			/>
		</HeadingScope>
	),
};
