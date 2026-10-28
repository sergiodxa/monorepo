/**
 * Dedicated `/browser-flows` marketing view — a selling page built around a live
 * click-through spec rather than the shared feature-grid template. Assembled from
 * `@sdxc/ui` marketing primitives so section rhythm matches the rest of the kit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowRightIcon, CheckIcon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { gap, grid, gridTemplate, inlineFlex, items, shrink, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { dark, media } from "@sdxc/u/responsive";
import { bs, is, m, maxIs, mbs, minIs, p } from "@sdxc/u/size";
import { font, fontSize, leading, textAlign, weight, whiteSpace } from "@sdxc/u/typography";
import { HeadingScope, LinkButton, MarketingHeader, MarketingSection } from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	AccentText,
	Bento,
	ClosingCta,
	FaqBand,
	FeatureBand,
	LandingHero,
	StepList,
} from "@sdxc/ui/patterns";

import AuthCta from "~/resources/components/marketing/auth-cta";
import BrowserFlowExamplesCarousel from "~/resources/components/marketing/browser-flow-examples-carousel";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import { BROWSER_FLOW_EXAMPLES, browserFlowsPage } from "~/resources/content/browser-flows";
import routes from "~/routes/web";

namespace BrowserFlowsView {
	export interface Props {
		isSignedIn: boolean;
		startLabel: string;
		dashboardLabel: string;
		pricingLabel: string;
		tryLabel: string;
	}
}

/** Mixins shared by every monospace flow-spec `<pre>` on this page. */
function specBlockMix() {
	return [
		m(0),
		p(5),
		rounded("xl"),
		bg("color.neutral.900"),
		dark(bg("color.neutral.950")),
		fg("color.neutral.100"),
		font("mono"),
		fontSize("xs"),
		leading("relaxed"),
		whiteSpace("pre"),
		overflow("auto"),
		bs("full"),
	];
}

/**
 * Renders the dedicated browser-flows landing from {@link browserFlowsPage} plus the
 * translated CTA labels the controller already resolved for the visitor's locale.
 */
export default function BrowserFlowsView(handle: Handle<BrowserFlowsView.Props>) {
	return () => {
		let { isSignedIn, startLabel, dashboardLabel, pricingLabel, tryLabel } = handle.props;
		let page = browserFlowsPage;
		let heroExample =
			BROWSER_FLOW_EXAMPLES.find((example) => example.key === page.heroExampleKey) ??
			BROWSER_FLOW_EXAMPLES[0]!;

		let faqSplitIndex = Math.ceil(page.faqs.length / 2);
		let firstFaqColumn = page.faqs.slice(0, faqSplitIndex);
		let secondFaqColumn = page.faqs.slice(faqSplitIndex);

		return (
			<>
				<LandingHero
					tone="tinted"
					align="center"
					mediaPlacement="below"
					eyebrow={page.brand}
					eyebrowVariant="pill"
					mix={[viewReveal()]}
					title={
						<>
							{page.title} <AccentText>{page.highlight}</AccentText>
						</>
					}
					description={page.description}
					actions={
						<>
							{isSignedIn ? (
								<AuthCta
									isSignedIn
									startLabel={startLabel}
									dashboardLabel={dashboardLabel}
									icon={<ArrowRightIcon size={20} strokeWidth={1.5} />}
								/>
							) : (
								<LinkButton href={routes.trial.check.index.href()} color="brand" size="lg">
									{tryLabel}
									<ArrowRightIcon size={20} strokeWidth={1.5} />
								</LinkButton>
							)}
							<LinkButton
								href={`${routes.home.href()}#pricing`}
								prefetch="intent"
								color="neutral"
								variant="outline"
								size="lg"
							>
								{pricingLabel}
							</LinkButton>
						</>
					}
					media={
						<figure mix={[m(0), is("full"), maxIs("960px"), vstack({ gap: 3 })]}>
							<figcaption mix={[m(0), fontSize("sm"), weight(600), fg("neutral.emphasis")]}>
								{heroExample.title}
							</figcaption>
							<pre mix={specBlockMix()}>
								<code>{heroExample.source}</code>
							</pre>
						</figure>
					}
				/>

				<MarketingSection mix={[viewReveal()]}>
					<HeadingScope>
						<MarketingHeader
							eyebrow={page.contrast.badge}
							description={page.contrast.description}
							align="center"
						>
							{page.contrast.title}
						</MarketingHeader>
					</HeadingScope>
					<HeadingScope>
						<Bento columns={2}>
							{[page.contrast.http, page.contrast.browser].map((column) => (
								<Bento.Cell key={column.title}>
									<Bento.Title>{column.title}</Bento.Title>
									<ul mix={[vstack({ gap: 3 }), m(0), p(0), listStyle("none")]}>
										{column.points.map((point) => (
											<li
												key={point}
												mix={[
													inlineFlex(),
													items("start"),
													gap(2),
													fontSize("sm"),
													leading("relaxed"),
													fg("neutral"),
												]}
											>
												<CheckIcon
													size={16}
													strokeWidth={2}
													mix={[fg("brand"), mbs("2px"), shrink(0)]}
												/>
												{point}
											</li>
										))}
									</ul>
								</Bento.Cell>
							))}
						</Bento>
					</HeadingScope>
				</MarketingSection>

				<MarketingSection id="examples" tone="tinted" mix={[overflow("hidden"), viewReveal()]}>
					<HeadingScope>
						<MarketingHeader
							eyebrow={page.examples.badge}
							description={page.examples.description}
							align="center"
						>
							{page.examples.title}
						</MarketingHeader>
					</HeadingScope>
					<div mix={[minIs(0)]}>
						<BrowserFlowExamplesCarousel
							label={page.examples.title}
							previousLabel="Previous example"
							nextLabel="Next example"
							examples={[...BROWSER_FLOW_EXAMPLES]}
						/>
					</div>
				</MarketingSection>

				<MarketingSection id="pricing" mix={[viewReveal()]}>
					<div
						mix={[
							grid(),
							gap(8),
							items("center"),
							media("(min-width: 768px)", [
								gridTemplate({ columns: "minmax(0, 1.4fr) minmax(0, 1fr)" }),
							]),
						]}
					>
						<div>
							<HeadingScope>
								<MarketingHeader
									eyebrow={page.pricing.badge}
									description={page.pricing.description}
								>
									{page.pricing.title}
								</MarketingHeader>
							</HeadingScope>
							<p mix={[m(0), mbs(4), fontSize("sm"), fg("neutral")]}>{page.pricing.note}</p>
						</div>
						<aside
							mix={[
								vstack({ gap: 2, align: "center" }),
								p(8),
								rounded("xl"),
								border({ color: "brand", width: 1 }),
								bg("brand.tint"),
								textAlign("center"),
							]}
						>
							<p mix={[m(0), fontSize("4xl"), weight(700), font("mono"), fg("brand.emphasis")]}>
								{page.pricing.figure}
							</p>
							<p mix={[m(0), fontSize("sm"), weight(600), fg("neutral.emphasis")]}>
								{page.pricing.figureLabel}
							</p>
						</aside>
					</div>
				</MarketingSection>

				<FeatureBand
					layout="steps"
					tone="tinted"
					eyebrow={page.steps.badge}
					title={page.steps.title}
					description={page.steps.description}
					mix={[viewReveal()]}
				>
					{page.steps.list.map((step) => (
						<StepList.Item key={step.title} title={step.title}>
							{step.description}
						</StepList.Item>
					))}
				</FeatureBand>

				<FaqBand
					id="faq"
					columns={2}
					eyebrow="FAQ"
					title="Questions about browser flows"
					description="When to use a browser session, how a run is billed, and what a short spec can express."
					mix={[viewReveal()]}
				>
					<FaqAccordion items={firstFaqColumn} />
					<FaqAccordion items={secondFaqColumn} />
				</FaqBand>

				<ClosingCta
					tone="plain"
					title={page.finalCta.title}
					description={page.finalCta.body}
					mix={[viewReveal(), bg("brand.solid"), fg("brand.onSolid"), rounded("2xl")]}
					parts={{
						title: [fg("brand.onSolid")],
						description: [fg("brand.onSolid")],
					}}
					actions={
						isSignedIn ? (
							<AuthCta
								isSignedIn
								startLabel={startLabel}
								dashboardLabel={dashboardLabel}
								color="neutral"
								icon={<ArrowRightIcon size={20} strokeWidth={1.5} />}
							/>
						) : (
							<LinkButton href={routes.trial.check.index.href()} color="neutral" size="lg">
								{tryLabel}
								<ArrowRightIcon size={20} strokeWidth={1.5} />
							</LinkButton>
						)
					}
				/>
			</>
		);
	};
}
