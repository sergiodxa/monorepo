/**
 * Live preview for `CtaGroup`: a hero's brand primary and surface secondary at the group's
 * 40px default, both carrying `landingCtaChrome()`, then a compact nav row and a pair
 * that stacks full width on a phone-width container.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ArrowRightIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Button, CtaGroup, LinkButton } from "@sdxc/ui";
import { landingCtaChrome } from "@sdxc/ui/styles";

/** The source the page shows, matching the markup below. */
const CODE = `<CtaGroup>
	<Button color="brand" mix={[landingCtaChrome()]}>
		Start monitoring free
		<ArrowRightIcon />
	</Button>
	<LinkButton href="/examples/pricing" variant="surface" mix={[landingCtaChrome()]}>
		Compare plans
	</LinkButton>
</CtaGroup>

<CtaGroup size="sm">
	<LinkButton href="/examples/login" variant="ghost" color="neutral">Sign in</LinkButton>
	<LinkButton href="/examples/signup" color="brand">Start free</LinkButton>
</CtaGroup>

<CtaGroup stack="phone">
	<Button color="brand" mix={[landingCtaChrome()]}>Create a status page</Button>
	<LinkButton href="/examples/status" variant="surface" mix={[landingCtaChrome()]}>
		See an example
	</LinkButton>
</CtaGroup>`;

/** What the preview registry reads: the source to show, and the action rows to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), vstack({ gap: 8, align: "start" })]}>
			<CtaGroup>
				<Button color="brand" mix={[landingCtaChrome()]}>
					Start monitoring free
					<ArrowRightIcon />
				</Button>
				<LinkButton href="/examples/pricing" variant="surface" mix={[landingCtaChrome()]}>
					Compare plans
				</LinkButton>
			</CtaGroup>
			<CtaGroup size="sm">
				<LinkButton href="/examples/login" variant="ghost" color="neutral">
					Sign in
				</LinkButton>
				<LinkButton href="/examples/signup" color="brand">
					Start free
				</LinkButton>
			</CtaGroup>
			<CtaGroup stack="phone">
				<Button color="brand" mix={[landingCtaChrome()]}>
					Create a status page
				</Button>
				<LinkButton href="/examples/status" variant="surface" mix={[landingCtaChrome()]}>
					See an example
				</LinkButton>
			</CtaGroup>
		</div>
	),
};
