/**
 * Live preview for `ClosingCta`: the default inverse band a landing ends on, then the same
 * close as a brand panel inset from the page edges. A band is a page-width surface, so
 * both meet the frame's edges.
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
	description={
		<>
			Five monitors and a status page, <strong>free for as long as you need them</strong>.
		</>
	}
	actions={
		<>
			<Button color="brand" mix={[marketingCtaChrome()]}>Create an account</Button>
			<LinkButton href="/examples/sales" variant="surface" mix={[marketingCtaChrome()]}>
				Talk to us
			</LinkButton>
		</>
	}
/>

<ClosingCta
	tone="brand"
	inset
	eyebrow="Ready when you are"
	title="Your next outage is already scheduled"
	description="…"
	actions={…}
/>`;

/** What the preview registry reads: the source to show, and the bands to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<ClosingCta
				title="Start watching your endpoints today"
				description={
					<>
						Five monitors and a status page, <strong>free for as long as you need them</strong>.
					</>
				}
				actions={
					<>
						<Button color="brand" mix={[marketingCtaChrome()]}>
							Create an account
						</Button>
						<LinkButton href="/examples/sales" variant="surface" mix={[marketingCtaChrome()]}>
							Talk to us
						</LinkButton>
					</>
				}
			/>
			<ClosingCta
				tone="brand"
				inset
				eyebrow="Ready when you are"
				title="Your next outage is already scheduled"
				description={
					<>
						Find out from a probe, not a customer. Setup takes <strong>under five minutes</strong>.
					</>
				}
				actions={
					<>
						<Button color="neutral" mix={[marketingCtaChrome()]}>
							Start monitoring
						</Button>
						<LinkButton href="/examples/pricing" variant="surface" mix={[marketingCtaChrome()]}>
							Compare plans
						</LinkButton>
					</>
				}
			/>
		</HeadingScope>
	),
};
