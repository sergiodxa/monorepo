/**
 * Live preview for `MarketingSection`: one tinted, ruled band holding a header and its
 * actions. A band is a page-width surface, so the preview meets the frame's edges and the
 * band's own block padding is the only space around the content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	Button,
	CtaGroup,
	HeadingScope,
	LinkButton,
	MarketingHeader,
	MarketingSection,
} from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<MarketingSection tone="tinted" spacing="compact" ruled>
	<MarketingHeader
		eyebrow="Status pages"
		description="Publish incidents and scheduled maintenance from the same dashboard your team already watches."
	>
		Tell customers before they ask
	</MarketingHeader>
	<CtaGroup>
		<Button color="brand">Create a status page</Button>
		<LinkButton href="/examples/status" color="neutral" variant="outline">
			See an example
		</LinkButton>
	</CtaGroup>
</MarketingSection>`;

/** What the preview registry reads: the source to show, and the band to draw edge to edge. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<MarketingSection tone="tinted" spacing="compact" ruled>
				<MarketingHeader
					eyebrow="Status pages"
					description="Publish incidents and scheduled maintenance from the same dashboard your team already watches."
				>
					Tell customers before they ask
				</MarketingHeader>
				<CtaGroup>
					<Button color="brand">Create a status page</Button>
					<LinkButton href="/examples/status" color="neutral" variant="outline">
						See an example
					</LinkButton>
				</CtaGroup>
			</MarketingSection>
		</HeadingScope>
	),
};
