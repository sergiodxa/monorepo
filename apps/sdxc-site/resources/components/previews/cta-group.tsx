/**
 * Live preview for `CtaGroup`: a hero's primary and secondary actions at the large size, the
 * primary carrying `marketingCtaChrome()` for the brand radius and lift.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ArrowRightIcon } from "@sdxc/icons";
import { Button, CtaGroup, LinkButton } from "@sdxc/ui";
import { marketingCtaChrome } from "@sdxc/ui/styles";

/** The source the page shows, matching the markup below. */
const CODE = `<CtaGroup>
	<Button size="lg" color="brand" mix={[marketingCtaChrome()]}>
		Start monitoring free
		<ArrowRightIcon />
	</Button>
	<LinkButton href="/examples/pricing" size="lg" color="neutral" variant="outline">
		Compare plans
	</LinkButton>
</CtaGroup>`;

/** What the preview registry reads: the source to show, and the actions to draw. */
export default {
	code: CODE,
	render: () => (
		<CtaGroup>
			<Button size="lg" color="brand" mix={[marketingCtaChrome()]}>
				Start monitoring free
				<ArrowRightIcon />
			</Button>
			<LinkButton href="/examples/pricing" size="lg" color="neutral" variant="outline">
				Compare plans
			</LinkButton>
		</CtaGroup>
	),
};
