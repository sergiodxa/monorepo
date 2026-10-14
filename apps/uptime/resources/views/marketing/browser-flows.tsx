/**
 * Dedicated `/browser-flows` marketing view — a selling page built around a live
 * click-through spec rather than the shared feature-grid template. The hero puts the
 * brand and one example side by side; later sections contrast HTTP vs browser, list
 * more examples, state run pricing, and answer FAQ.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowRightIcon, CheckIcon } from "@sdxc/icons";
import { bg, border, fg, linearGradient, radialGradient } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { counterReset, listStyle } from "@sdxc/u/general";
import {
	absolute,
	flex,
	flexWrap,
	gap,
	grid,
	gridTemplate,
	inlineFlex,
	insBs,
	insIs,
	items,
	justify,
	relative,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { dark, media } from "@sdxc/u/responsive";
import { bs, is, m, maxIs, mi, mbs, p, pb, pi } from "@sdxc/u/size";
import { translateX, translateY } from "@sdxc/u/transform";
import {
	font,
	fontSize,
	leading,
	textAlign,
	tracking,
	weight,
	whiteSpace,
} from "@sdxc/u/typography";
import { Heading, HeadingScope, LinkButton } from "@sdxc/ui";

import AuthCta from "~/resources/components/marketing/auth-cta";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import SectionHeader from "~/resources/components/marketing/section-header";
import MarketingStep from "~/resources/components/marketing/step";
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

/** Vertical section padding shared with the homepage marketing sections. */
function sectionPadding() {
	return [pb(16), media("(min-width: 640px)", pb(24)), media("(min-width: 1024px)", pb(32))];
}

/** Centered content wrapper capped at 1152px. */
function marketingContainer() {
	return [
		maxIs("1152px"),
		mi("auto"),
		pi(4),
		media("(min-width: 640px)", pi(6)),
		media("(min-width: 1024px)", pi(8)),
	];
}

/** Soft alternate-section background. */
function tintedSection() {
	return [bg("color.neutral.100"), dark(bg("color.neutral.900"))];
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
				<section
					mix={[
						...sectionPadding(),
						relative(),
						overflow("hidden"),
						bg({
							image: linearGradient(
								"to bottom",
								"var(--ui-brand-bg-tint)",
								"var(--ui-neutral-bg-tint)",
							),
						}),
					]}
				>
					<div
						aria-hidden="true"
						mix={[
							absolute(),
							insBs(0),
							insIs("50%"),
							is("800px"),
							bs("800px"),
							translateX("-50%"),
							translateY("-50%"),
							bg({
								image: radialGradient(
									"circle closest-side",
									{ color: "var(--ui-brand-bg-tint)", position: "0%" },
									{ color: "transparent", position: "100%" },
								),
							}),
						]}
					/>

					<div mix={[...marketingContainer(), relative()]}>
						<div
							mix={[
								grid(),
								gap(10),
								items("center"),
								media("(min-width: 1024px)", [
									gridTemplate({ columns: "minmax(0, 1fr) minmax(0, 1.1fr)" }),
									gap(14),
								]),
							]}
						>
							<div
								mix={[
									vstack({ gap: 6, align: "center" }),
									textAlign("center"),
									media("(min-width: 1024px)", [items("start"), textAlign("start")]),
								]}
							>
								<p mix={[m(0), fontSize("sm"), weight(700), tracking("widest"), fg("brand")]}>
									{page.brand}
								</p>
								<span
									mix={[
										inlineFlex(),
										items("center"),
										p("2px", "10px"),
										rounded("999px"),
										fontSize("xs"),
										weight(600),
										border({ color: "brand", width: 1 }),
										bg("brand.tint"),
										fg("brand"),
									]}
								>
									{page.badge}
								</span>
								<Heading
									level={1}
									mix={[
										m(0),
										fontSize("4xl"),
										weight(700),
										leading(1.1),
										tracking("tight"),
										maxIs("640px"),
										media("(min-width: 640px)", fontSize("5xl")),
										media("(min-width: 1024px)", fontSize("6xl")),
									]}
								>
									{page.title} <span mix={[fg("brand")]}>{page.highlight}</span>
								</Heading>
								<p mix={[m(0), maxIs("540px"), fontSize("lg"), leading(1.625), fg("neutral")]}>
									{page.description}
								</p>
								<div
									mix={[
										flex(),
										flexWrap("wrap"),
										gap(3),
										justify("center"),
										media("(min-width: 1024px)", justify("start")),
									]}
								>
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
										color="neutral"
										variant="outline"
										size="lg"
									>
										{pricingLabel}
									</LinkButton>
								</div>
								<ul
									mix={[
										flex(),
										flexWrap("wrap"),
										gap(2, 5),
										m(0),
										p(0),
										listStyle("none"),
										justify("center"),
										media("(min-width: 1024px)", justify("start")),
									]}
								>
									{page.highlights.map((item) => (
										<li
											key={item}
											mix={[
												inlineFlex(),
												items("center"),
												gap(2),
												fontSize("sm"),
												weight(500),
												fg("neutral.emphasis"),
											]}
										>
											<CheckIcon size={16} strokeWidth={2} mix={[fg("brand")]} />
											{item}
										</li>
									))}
								</ul>
							</div>

							<figure mix={[m(0), vstack({ gap: 3 })]}>
								<figcaption mix={[m(0), fontSize("sm"), weight(600), fg("neutral.emphasis")]}>
									{heroExample.title}
								</figcaption>
								<pre mix={specBlockMix()}>
									<code>{heroExample.source}</code>
								</pre>
							</figure>
						</div>
					</div>
				</section>

				<section mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader
							badge={page.contrast.badge}
							title={page.contrast.title}
							description={page.contrast.description}
						/>
						<div
							mix={[
								grid(),
								gap(6),
								media("(min-width: 768px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
							]}
						>
							{[page.contrast.http, page.contrast.browser].map((column) => (
								<article
									key={column.title}
									mix={[
										vstack({ gap: 4 }),
										p(6),
										rounded("xl"),
										border({ color: "neutral", width: 1 }),
										bg("neutral.tint"),
									]}
								>
									<HeadingScope level={3}>
										<Heading mix={[m(0), fontSize("xl"), weight(600)]}>{column.title}</Heading>
									</HeadingScope>
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
								</article>
							))}
						</div>
					</div>
				</section>

				<section id="examples" mix={[...sectionPadding(), ...tintedSection()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader
							badge={page.examples.badge}
							title={page.examples.title}
							description={page.examples.description}
						/>
						<div
							mix={[
								grid(),
								gap(8),
								media("(min-width: 1024px)", gridTemplate({ columns: "repeat(3, 1fr)" })),
							]}
						>
							{BROWSER_FLOW_EXAMPLES.map((example) => (
								<article key={example.key} mix={[vstack({ gap: 4 })]}>
									<div mix={[vstack({ gap: 2 })]}>
										<HeadingScope level={3}>
											<Heading mix={[m(0), fontSize("lg"), weight(600)]}>{example.title}</Heading>
										</HeadingScope>
										<p mix={[m(0), fontSize("sm"), leading("relaxed"), fg("neutral")]}>
											{example.description}
										</p>
									</div>
									<pre mix={specBlockMix()}>
										<code>{example.source}</code>
									</pre>
								</article>
							))}
						</div>
					</div>
				</section>

				<section id="pricing" mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
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
								<SectionHeader
									badge={page.pricing.badge}
									title={page.pricing.title}
									description={page.pricing.description}
								/>
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
					</div>
				</section>

				<section mix={[...sectionPadding(), ...tintedSection()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader
							badge={page.steps.badge}
							title={page.steps.title}
							description={page.steps.description}
						/>
						<div
							mix={[
								grid(),
								gap(8),
								counterReset("marketing-step"),
								media("(min-width: 1024px)", gridTemplate({ columns: "repeat(3, 1fr)" })),
							]}
						>
							{page.steps.list.map((step) => (
								<MarketingStep key={step.title} title={step.title} description={step.description} />
							))}
						</div>
					</div>
				</section>

				<section id="faq" mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader
							badge="FAQ"
							title="Questions about browser flows"
							description="When to use a browser session, how a run is billed, and what a short spec can express."
						/>
						<div
							mix={[
								grid(),
								gap(8),
								items("start"),
								media("(min-width: 1024px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
							]}
						>
							<FaqAccordion items={firstFaqColumn} />
							<FaqAccordion items={secondFaqColumn} />
						</div>
					</div>
				</section>

				<section mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
						<div
							mix={[
								vstack({ gap: 6, align: "center" }),
								p(10),
								rounded("2xl"),
								bg("brand.solid"),
								textAlign("center"),
							]}
						>
							<Heading level={2} mix={[m(0), fontSize("3xl"), weight(700), fg("brand.onSolid")]}>
								{page.finalCta.title}
							</Heading>
							<p mix={[m(0), maxIs("540px"), fontSize("lg"), fg("brand.onSolid")]}>
								{page.finalCta.body}
							</p>
							{isSignedIn ? (
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
							)}
						</div>
					</div>
				</section>
			</>
		);
	};
}
