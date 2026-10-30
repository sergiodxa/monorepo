/**
 * Live example for the chapter variants of `MarketingHeader`: a split header with its lead
 * beside the title, a two-tone statement with a subtitle, and a header row that ends in a
 * "See all" action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ArrowRightIcon } from "@sdxc/icons";
import { LinkButton, MarketingHeader, MarketingSection } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<MarketingHeader layout="split" eyebrow="Observability" description="…">
	Know what every function did, and why
</MarketingHeader>

<MarketingHeader tone="statement" subtitle="Every page in under a second.">
	<strong>Status pages that load first.</strong> Even when your app is down.
</MarketingHeader>

<MarketingHeader action={<LinkButton href="/courses" variant="ghost">See all</LinkButton>}>
	Flagship training
</MarketingHeader>`;

/** What the preview registry reads: the title, the source to show, and the bands to draw. */
export default {
	title: "Split, statement and header action",
	code: CODE,
	flush: true,
	viewports: true,
	render: () => (
		<>
			<MarketingSection spacing="compact">
				<MarketingHeader
					layout="split"
					eyebrow="Observability"
					description="Traces, logs and metrics for every request, grouped by the deploy that served it."
				>
					Know what every function did, and why
				</MarketingHeader>
			</MarketingSection>
			<MarketingSection spacing="compact" ruled>
				<MarketingHeader tone="statement" subtitle="Every page in under a second.">
					<strong>Status pages that load first.</strong> Even when your app is down.
				</MarketingHeader>
			</MarketingSection>
			<MarketingSection spacing="compact" ruled>
				<MarketingHeader
					action={
						<LinkButton href="#courses" variant="ghost" color="neutral">
							See all
							<ArrowRightIcon data-slot="icon" aria-hidden="true" />
						</LinkButton>
					}
				>
					Flagship training
				</MarketingHeader>
			</MarketingSection>
		</>
	),
};
