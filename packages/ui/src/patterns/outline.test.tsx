/**
 * Guards the heading outline a composed landing page produces: one `<h1>` from the hero,
 * a `<h2>` per band and a `<h3>` per card, whether a page wraps its bands in a
 * `HeadingScope` or not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Feature } from "../components/feature.js";
import { HeadingScope } from "../components/heading-scope.js";
import { MarketingHeader } from "../components/marketing-header.js";
import { MarketingSection } from "../components/marketing-section.js";

import { Bento } from "./bento.js";
import { ClosingCta } from "./closing-cta.js";
import { FaqBand } from "./faq-band.js";
import { FeatureBand } from "./feature-band.js";
import { LandingHero } from "./landing-hero.js";
import { PricingBand } from "./pricing-band.js";
import { StepList } from "./step-list.js";

/**
 * Every heading in `html`, in document order, as `"h2:Title"`, so a failure prints the
 * outline a reader would hear.
 */
async function outline(node: RemixNode) {
	let html = await renderToString(node);
	let headings = [...html.matchAll(/<h([1-6])\b[^>]*>(.*?)<\/h\1>/g)];

	return headings.map(([, level, inner]) => `h${level}:${(inner ?? "").replace(/<[^>]+>/g, "")}`);
}

/** The page every documented landing component composes into, with no scope placed by hand. */
function page() {
	return (
		<>
			<LandingHero title="Hero" />
			<FeatureBand title="Features" columns={2}>
				<Feature>
					<Feature.Title>Cell</Feature.Title>
				</Feature>
			</FeatureBand>
			<MarketingSection>
				<MarketingHeader>Platform</MarketingHeader>
				<Bento>
					<Bento.Cell>
						<Bento.Title>Bento cell</Bento.Title>
					</Bento.Cell>
				</Bento>
			</MarketingSection>
			<MarketingSection>
				<MarketingHeader>Steps</MarketingHeader>
				<StepList>
					<StepList.Item title="Step">Body</StepList.Item>
				</StepList>
			</MarketingSection>
			<FeatureBand layout="steps" title="How">
				<StepList.Item title="Band step">Body</StepList.Item>
			</FeatureBand>
			<PricingBand title="Pricing">
				<PricingBand.Plan name="Team" price="$29" action={<a href="/signup">Start</a>} />
			</PricingBand>
			<FaqBand title="FAQ">
				<div />
			</FaqBand>
			<ClosingCta title="Start" />
		</>
	);
}

/** The outline {@link page} must produce. */
const EXPECTED = [
	"h1:Hero",
	"h2:Features",
	"h3:Cell",
	"h2:Platform",
	"h3:Bento cell",
	"h2:Steps",
	"h3:Step",
	"h2:How",
	"h3:Band step",
	"h2:Pricing",
	"h3:Team",
	"h2:FAQ",
	"h2:Start",
];

describe("landing heading outline", () => {
	test("a bare page gets one h1 from the hero, h2 bands and h3 cards", async () => {
		expect(await outline(page())).toEqual(EXPECTED);
	});

	test("one page-level HeadingScope leaves the outline unchanged", async () => {
		expect(await outline(<HeadingScope>{page()}</HeadingScope>)).toEqual(EXPECTED);
	});

	test("a page nested under an ambient level shifts every heading by that level", async () => {
		let headings = await outline(
			<HeadingScope level={2}>
				<LandingHero title="Hero" />
				<MarketingSection>
					<MarketingHeader>Band</MarketingHeader>
				</MarketingSection>
			</HeadingScope>,
		);

		expect(headings).toEqual(["h2:Hero", "h3:Band"]);
	});

	test("a band nested in a band titles one level under it", async () => {
		let headings = await outline(
			<MarketingSection>
				<MarketingHeader>Outer</MarketingHeader>
				<MarketingSection>
					<MarketingHeader>Inner</MarketingHeader>
				</MarketingSection>
			</MarketingSection>,
		);

		expect(headings).toEqual(["h2:Outer", "h3:Inner"]);
	});

	test("an explicit level wins on the hero and on a band", async () => {
		let headings = await outline(
			<>
				<LandingHero level={2} title="Hero" />
				<MarketingSection level={4}>
					<MarketingHeader>Band</MarketingHeader>
				</MarketingSection>
			</>,
		);

		expect(headings).toEqual(["h2:Hero", "h4:Band"]);
	});
});
