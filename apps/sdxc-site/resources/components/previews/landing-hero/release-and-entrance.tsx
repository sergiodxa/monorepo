/**
 * Live example for a centered `LandingHero` with a release pin under its actions and the
 * load entrance turned on, the way a framework announces its latest version.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, LinkButton } from "@sdxc/ui";
import { LandingHero } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

/** The source the page shows, matching the markup below. */
const CODE = `<LandingHero
	entrance
	title="Build the whole app in one framework"
	description="Routing, data, sessions and jobs, with nothing to wire together."
	actions={
		<>
			<Button color="brand" mix={[marketingCtaChrome()]}>Get started</Button>
			<LinkButton href="/docs" variant="surface" mix={[marketingCtaChrome()]}>Read the docs</LinkButton>
		</>
	}
	release={<a href="/changelog/8-1">v8.1 — released Oct 28, 2026 →</a>}
/>`;

/** What the preview registry reads: the title, the source to show, and the hero to draw. */
export default {
	title: "With a release pin and the entrance",
	code: CODE,
	viewports: true,
	render: () => (
		<LandingHero
			entrance
			title="Build the whole app in one framework"
			description="Routing, data, sessions and jobs, with nothing to wire together."
			actions={
				<>
					<Button color="brand" mix={[marketingCtaChrome()]}>
						Get started
					</Button>
					<LinkButton href="#docs" variant="surface" mix={[marketingCtaChrome()]}>
						Read the docs
					</LinkButton>
				</>
			}
			release={<a href="#changelog">v8.1 — released Oct 28, 2026 →</a>}
		/>
	),
};
