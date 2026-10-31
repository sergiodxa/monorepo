/**
 * The page `/for/:slug` and `/use-cases/:slug` share: the hero over a product mockup, the
 * page's product figures, linked capability cards, an optional spotlight with a product
 * scene, the steps to start, the FAQ and the closing band, all driven by a content record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import { ArrowRightIcon, Icon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { flexWrap, gap, inlineFlex, items, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Feature, LinkButton, MarketingHeader, MarketingSection, StatStrip } from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	AccentText,
	CheckList,
	CheckRow,
	FaqBand,
	FeatureBand,
	LandingHero,
	StepList,
} from "@sdxc/ui/patterns";

import type { MarketingContent } from "~/resources/content/marketing";

import { FLOW_INTERVALS_SECONDS, FREE_TRIAL_DAYS } from "~/config/pricing";
import AuthCta from "~/resources/components/marketing/auth-cta";
import ClosingBand from "~/resources/components/marketing/closing-band";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import FlowDiagram from "~/resources/components/marketing/flow-diagram";
import {
	AlertsScene,
	MonitorsScene,
	StatusPageScene,
} from "~/resources/components/marketing/product-scenes";
import routes from "~/routes/web";

namespace SolutionPageView {
	export interface Props {
		content: MarketingContent.Page;
		/** Swaps the hero's free-trial link for the signed-in dashboard link. */
		isSignedIn: boolean;
		chrome: Chrome;
		/** The product mockup the hero shows: the area this audience or use case leans on. */
		media: RemixNode;
	}

	/** The translated strings and scenes every solution page renders around its content. */
	export interface Chrome {
		startLabel: string;
		dashboardLabel: string;
		pricingLabel: string;
		/** The free-trial label, with the trial length read from the pricing module. */
		tryLabel: string;
		learnMoreLabel: string;
		everythingBadge: string;
		everythingTitle: string;
		everythingDescription: string;
		howItWorksBadge: string;
		howItWorksTitle: string;
		howItWorksDescription: string;
		faqBadge: string;
		faqTitle: string;
		faqDescription: string;
		finalCtaTitle: string;
		finalCtaBody: string;
		/** Each spotlight scene, already labelled in the request's language. */
		scenes: Record<MarketingContent.SpotlightScene, RemixNode>;
	}
}

/**
 * Resolves every string and scene {@link SolutionPageView} needs, so both controllers share
 * one set of `t()` calls. Scene copy reuses the status page and alert email keys, so a
 * scene reads exactly as the product UI it depicts.
 */
export function buildSolutionPageChrome(t: Translate): SolutionPageView.Chrome {
	let upLabel = t("statusPage.status.operational");

	return {
		startLabel: t("landing.hero.cta.out"),
		dashboardLabel: t("landing.hero.cta.in"),
		pricingLabel: t("landing.hero.cta.pricing"),
		tryLabel: t("landing.hero.cta.try", { days: FREE_TRIAL_DAYS }),
		learnMoreLabel: t("landing.features.learnMore"),
		everythingBadge: t("landing.marketingPage.everythingBadge"),
		everythingTitle: t("landing.marketingPage.everythingTitle"),
		everythingDescription: t("landing.marketingPage.everythingDescription"),
		howItWorksBadge: t("landing.marketingPage.howItWorksBadge"),
		howItWorksTitle: t("landing.marketingPage.howItWorksTitle"),
		howItWorksDescription: t("landing.marketingPage.howItWorksDescription"),
		faqBadge: t("landing.marketingPage.faqBadge"),
		faqTitle: t("landing.marketingPage.faqTitle"),
		faqDescription: t("landing.marketingPage.faqDescription"),
		finalCtaTitle: t("landing.marketingPage.finalCtaTitle"),
		finalCtaBody: t("landing.finalCta.body"),
		scenes: {
			monitors: <MonitorsScene upLabel={upLabel} />,
			alerts: (
				<AlertsScene
					down={t("emails.alert.heading", {
						monitor: "api.example.com",
						status: t("emails.alert.status.down"),
					})}
					recovered={t("emails.alert.heading", {
						monitor: "api.example.com",
						status: t("emails.alert.status.up"),
					})}
					downLabel={t("statusPage.status.down")}
					upLabel={upLabel}
				/>
			),
			"status-page": <StatusPageScene banner={t("statusPage.banner.operational")} />,
			flow: (
				<FlowDiagram
					labels={{
						name: t("landing.flows.diagram.name"),
						pause: t("landing.flows.diagram.pause"),
						schedule: t("landing.flows.diagram.schedule"),
						scheduleDetail: t("landing.flows.diagram.scheduleDetail", {
							minutes: FLOW_INTERVALS_SECONDS[0] / 60,
						}),
						steps: [
							t("landing.flows.diagram.signIn"),
							t("landing.flows.diagram.token"),
							t("landing.flows.diagram.call"),
							t("landing.flows.diagram.check"),
						],
						passed: t("landing.flows.diagram.passed"),
						alert: t("landing.flows.diagram.alert"),
					}}
				/>
			),
		},
	};
}

/**
 * Renders a solution page. Bands alternate plain and tinted from the hero down, whether or
 * not the page has a spotlight; a capability grid of six runs three across and any other
 * count two across, so no card sits alone on the last row.
 */
export default function SolutionPageView(handle: Handle<SolutionPageView.Props>) {
	return () => {
		let { chrome, content, isSignedIn, media } = handle.props;
		let { spotlight } = content;

		let faqSplitIndex = Math.ceil(content.faqs.length / 2);
		let firstFaqColumn = content.faqs.slice(0, faqSplitIndex);
		let secondFaqColumn = content.faqs.slice(faqSplitIndex);
		let featureColumns: 2 | 3 = content.features.length % 3 === 0 ? 3 : 2;
		let stepsTone: "plain" | "tinted" = spotlight ? "tinted" : "plain";
		let faqTone: "plain" | "tinted" = spotlight ? "plain" : "tinted";

		return (
			<>
				<LandingHero
					tone="tinted"
					mediaPlacement="end"
					entrance
					eyebrow={content.badge}
					eyebrowVariant="pill"
					title={
						<>
							{content.title} <AccentText>{content.highlight}</AccentText>
						</>
					}
					description={content.description}
					actions={
						<div mix={[vstack({ gap: 4, align: "start" }), is("full")]}>
							<div mix={[inlineFlex(), flexWrap(), items("center"), gap(3)]}>
								{isSignedIn ? (
									<AuthCta
										isSignedIn
										startLabel={chrome.startLabel}
										dashboardLabel={chrome.dashboardLabel}
										icon={<ArrowRightIcon size={20} strokeWidth={1.5} aria-hidden="true" />}
									/>
								) : (
									<LinkButton href={routes.trial.check.index.href()} color="brand" size="lg">
										{chrome.tryLabel}
										<ArrowRightIcon size={20} strokeWidth={1.5} aria-hidden="true" />
									</LinkButton>
								)}
								<LinkButton
									href={`${routes.home.href()}#pricing`}
									prefetch="intent"
									color="neutral"
									variant="outline"
									size="lg"
								>
									{chrome.pricingLabel}
								</LinkButton>
							</div>
							<CheckList orientation="horizontal">
								{content.highlights.map((highlight) => (
									<CheckRow key={highlight}>{highlight}</CheckRow>
								))}
							</CheckList>
						</div>
					}
					media={media}
				/>

				{content.trustIndicators ? (
					<MarketingSection spacing="compact" mix={[viewReveal()]}>
						<StatStrip variant="gap" align="center">
							{content.trustIndicators.map((indicator) => (
								<StatStrip.Item key={indicator.label} label={indicator.label}>
									{indicator.valueLabel ? (
										<>
											<span aria-hidden="true">{indicator.value}</span>
											<span mix={[visuallyHidden()]}>{indicator.valueLabel}</span>
										</>
									) : (
										indicator.value
									)}
								</StatStrip.Item>
							))}
						</StatStrip>
					</MarketingSection>
				) : null}

				<MarketingSection id="capabilities" tone="tinted" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={chrome.everythingBadge}
						description={chrome.everythingDescription}
						align="center"
					>
						{chrome.everythingTitle}
					</MarketingHeader>
					<Feature.Grid columns={featureColumns}>
						{content.features.map((feature) => (
							<Feature key={feature.title} href={feature.href}>
								{feature.icon ? (
									<Feature.Icon>
										<Icon name={feature.icon} size={20} strokeWidth={1.5} aria-hidden="true" />
									</Feature.Icon>
								) : null}
								<Feature.Title>{feature.title}</Feature.Title>
								<Feature.Description>{feature.description}</Feature.Description>
								{feature.href ? (
									<Feature.Action>
										<Feature.Link href={feature.href} data-rmx-prefetch="intent">
											{chrome.learnMoreLabel}
										</Feature.Link>
									</Feature.Action>
								) : null}
							</Feature>
						))}
					</Feature.Grid>
				</MarketingSection>

				{spotlight ? (
					<FeatureBand
						id="spotlight"
						layout="split"
						lean="media"
						eyebrow={spotlight.eyebrow}
						title={spotlight.title}
						description={spotlight.description}
						media={chrome.scenes[spotlight.scene]}
						mix={[viewReveal()]}
					>
						<div mix={[vstack({ gap: 6, align: "start" })]}>
							<CheckList>
								{spotlight.points.map((point) => (
									<CheckRow key={point}>{point}</CheckRow>
								))}
							</CheckList>
							<LinkButton href={spotlight.href} prefetch="intent" color="neutral" variant="outline">
								{spotlight.linkLabel}
								<ArrowRightIcon size={16} strokeWidth={1.5} aria-hidden="true" />
							</LinkButton>
						</div>
					</FeatureBand>
				) : null}

				<FeatureBand
					id="how-it-works"
					layout="steps"
					tone={stepsTone}
					eyebrow={chrome.howItWorksBadge}
					title={chrome.howItWorksTitle}
					description={chrome.howItWorksDescription}
					mix={[viewReveal()]}
				>
					{content.steps.map((step) => (
						<StepList.Item key={step.title} title={step.title}>
							{step.description}
						</StepList.Item>
					))}
				</FeatureBand>

				<FaqBand
					id="faq"
					columns={2}
					tone={faqTone}
					eyebrow={chrome.faqBadge}
					title={chrome.faqTitle}
					description={chrome.faqDescription}
					mix={[viewReveal()]}
				>
					<FaqAccordion items={firstFaqColumn} />
					{secondFaqColumn.length > 0 ? <FaqAccordion items={secondFaqColumn} /> : null}
				</FaqBand>

				<ClosingBand
					id="start"
					isSignedIn={isSignedIn}
					title={chrome.finalCtaTitle}
					description={chrome.finalCtaBody}
					startLabel={chrome.startLabel}
					dashboardLabel={chrome.dashboardLabel}
				/>
			</>
		);
	};
}
