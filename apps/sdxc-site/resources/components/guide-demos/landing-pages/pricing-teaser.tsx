/**
 * The custom band from the landing-page guide, built from the primitives the patterns use:
 * a tinted section, a header, and a split holding checked claims beside a terminal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	CtaGroup,
	HeadingScope,
	LinkButton,
	MarketingHeader,
	MarketingSection,
	Split,
} from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import { CheckList, CheckRow, CodeStage } from "@sdxc/ui/patterns";

/** What the guide demo registry reads: the band, drawn at a page's width. */
export default {
	viewports: true,
	render: () => (
		<HeadingScope>
			<MarketingSection tone="tinted" ruled mix={[viewReveal()]}>
				<MarketingHeader eyebrow="Pricing" description="One price per monitor, billed monthly.">
					Pay for what you watch
				</MarketingHeader>
				<Split lean="copy">
					<Split.Copy>
						<CheckList>
							<CheckRow>Free for five monitors</CheckRow>
							<CheckRow>No card required</CheckRow>
						</CheckList>
						<CtaGroup>
							<LinkButton href="/examples/pricing" color="brand">
								Compare plans
							</LinkButton>
						</CtaGroup>
					</Split.Copy>
					<Split.Media>
						<CodeStage variant="terminal" title="~">
							$ beacon monitors add https://api.example.com
						</CodeStage>
					</Split.Media>
				</Split>
			</MarketingSection>
		</HeadingScope>
	),
};
