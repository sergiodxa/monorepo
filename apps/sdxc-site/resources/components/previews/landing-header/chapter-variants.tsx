/**
 * Live example for the chapter variants of `LandingHeader`: a split header with its lead
 * beside the title, a two-tone statement with a subtitle, and a header row that ends in a
 * "See all" action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ArrowRightIcon } from "@sdxc/icons";
import { LinkButton } from "@sdxc/ui";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<LandingHeader layout="split" eyebrow="Observability" description="…">
	Know what every function did, and why
</LandingHeader>

<LandingHeader tone="statement" subtitle="Every page in under a second.">
	<strong>Status pages that load first.</strong> Even when your app is down.
</LandingHeader>

<LandingHeader action={<LinkButton href="/courses" variant="ghost">See all</LinkButton>}>
	Flagship training
</LandingHeader>`;

/** What the preview registry reads: the title, the source to show, and the bands to draw. */
export default {
	title: "Split, statement and header action",
	code: CODE,
	flush: true,
	viewports: true,
	render: () => (
		<>
			<LandingSection spacing="compact">
				<LandingHeader
					layout="split"
					eyebrow="Observability"
					description="Traces, logs and metrics for every request, grouped by the deploy that served it."
				>
					Know what every function did, and why
				</LandingHeader>
			</LandingSection>
			<LandingSection spacing="compact" ruled>
				<LandingHeader tone="statement" subtitle="Every page in under a second.">
					<strong>Status pages that load first.</strong> Even when your app is down.
				</LandingHeader>
			</LandingSection>
			<LandingSection spacing="compact" ruled>
				<LandingHeader
					action={
						<LinkButton href="#courses" variant="ghost" color="neutral">
							See all
							<ArrowRightIcon data-slot="icon" aria-hidden="true" />
						</LinkButton>
					}
				>
					Flagship training
				</LandingHeader>
			</LandingSection>
		</>
	),
};
