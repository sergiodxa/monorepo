/**
 * `/browser-flows` — the dedicated selling page for real-browser click-through
 * monitoring. Lives outside the shared `/features/:slug` template so the hero can
 * lead with the specs themselves and price the browser meter apart from pings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	AppWindowIcon,
	ArrowRightIcon,
	GlobeIcon,
	LogInIcon,
	MousePointerClickIcon,
	ShoppingCartIcon,
} from "@sdxc/icons";
import { flexWrap, gap, inlineFlex, items } from "@sdxc/u/layout";
import { maxIs, mbs, mi } from "@sdxc/u/size";
import { tabSize, text, textAlign } from "@sdxc/u/typography";
import { Feature, LinkButton, MarketingHeader, MarketingSection, StatStrip } from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	AccentText,
	CheckList,
	CheckRow,
	CodeStage,
	FaqBand,
	FeatureBand,
	LandingHero,
	StepList,
} from "@sdxc/ui/patterns";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { getSoftwareApplicationSchema, SEO } from "~/app/initializers/seo";
import {
	DEFAULT_FLOW_INTERVAL_SECONDS,
	FLOW_INTERVALS_SECONDS,
	FREE_TRIAL_DAYS,
} from "~/config/pricing";
import AuthCta from "~/resources/components/marketing/auth-cta";
import ClosingBand from "~/resources/components/marketing/closing-band";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import ProductMockup from "~/resources/components/marketing/product-mockups";
import { BROWSER_FLOW_EXAMPLES, browserFlowsPage } from "~/resources/content/browser-flows";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** The icon each example card leads with, keyed like the examples themselves. */
const EXAMPLE_ICONS = {
	signIn: <LogInIcon size={24} strokeWidth={1.5} aria-hidden="true" />,
	checkout: <ShoppingCartIcon size={24} strokeWidth={1.5} aria-hidden="true" />,
	spa: <AppWindowIcon size={24} strokeWidth={1.5} aria-hidden="true" />,
} as const;

/** GET /browser-flows — the browser-flow product landing. */
export default createAction(routes.browserFlows, async (ctx) => {
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.intl.t);
	let t = ctx.intl.t;
	let page = browserFlowsPage;
	let tryLabel = t("landing.hero.cta.try", { days: FREE_TRIAL_DAYS });

	/** Splits the FAQ across both columns, the longer half first. */
	let faqSplitIndex = Math.ceil(page.faqs.length / 2);

	/**
	 * The schedule figures read from the same list the flow form offers, so the page can never
	 * advertise a cadence a flow cannot be saved with.
	 */
	let figures = [
		{ label: page.pricing.figureLabel, value: page.pricing.figure },
		{
			label: t("browserFlows.figures.fastest.label"),
			value: t("browserFlows.figures.fastest.value", {
				minutes: FLOW_INTERVALS_SECONDS[0] / 60,
			}),
		},
		{
			label: t("browserFlows.figures.default.label"),
			value: t("browserFlows.figures.default.value", {
				hours: DEFAULT_FLOW_INTERVAL_SECONDS / 3600,
			}),
		},
	];

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={page.metaTitle}
			locale={ctx.locale}
			seo={{
				description: page.metaDescription,
				canonical: SEO.canonical(ctx.url),
				schema: [
					getSoftwareApplicationSchema({
						name: "Browser Flow Monitoring",
						description: page.metaDescription,
						featureList: [
							"Real Browser Run sessions",
							"Accessibility role and name addressing",
							"Per-run metering separate from pings",
						],
					}),
					SEO.schema.faq([...page.faqs]),
				],
			}}
		>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<LandingHero
					tone="tinted"
					mediaPlacement="end"
					entrance
					eyebrow={t("browserFlows.eyebrow")}
					eyebrowVariant="pill"
					title={
						<>
							{page.title} <AccentText>{page.highlight}</AccentText>
						</>
					}
					description={page.description}
					actions={
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
									{tryLabel}
									<ArrowRightIcon size={20} strokeWidth={1.5} aria-hidden="true" />
								</LinkButton>
							)}
							<LinkButton href="#pricing" color="neutral" variant="outline" size="lg">
								{t("landing.hero.cta.pricing")}
							</LinkButton>
						</div>
					}
					media={<ProductMockup area="flow" t={t} />}
				/>

				<MarketingSection id="examples" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={page.examples.badge}
						description={page.examples.description}
						align="center"
					>
						{page.examples.title}
					</MarketingHeader>
					<CodeStage
						id="browser-flow-examples"
						variant="code"
						name="browser-flow-examples"
						tabs={BROWSER_FLOW_EXAMPLES.map((example) => ({
							label: example.tab,
							content: example.source,
						}))}
						parts={{ body: [tabSize()] }}
					/>
					<Feature.Grid columns={3}>
						{BROWSER_FLOW_EXAMPLES.map((example) => (
							<Feature key={example.key}>
								<Feature.Icon tone="brand">{EXAMPLE_ICONS[example.key]}</Feature.Icon>
								<Feature.Title>{example.title}</Feature.Title>
								<Feature.Description>{example.description}</Feature.Description>
							</Feature>
						))}
					</Feature.Grid>
				</MarketingSection>

				<MarketingSection tone="tinted" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={page.contrast.badge}
						description={page.contrast.description}
						align="center"
					>
						{page.contrast.title}
					</MarketingHeader>
					<Feature.Grid columns={2}>
						{[
							{ column: page.contrast.http, icon: <GlobeIcon size={24} strokeWidth={1.5} /> },
							{
								column: page.contrast.browser,
								icon: <MousePointerClickIcon size={24} strokeWidth={1.5} />,
							},
						].map(({ column, icon }) => (
							<Feature key={column.title}>
								<Feature.Icon>{icon}</Feature.Icon>
								<Feature.Title>{column.title}</Feature.Title>
								<Feature.Description>
									<CheckList>
										{column.points.map((point) => (
											<CheckRow key={point}>{point}</CheckRow>
										))}
									</CheckList>
								</Feature.Description>
							</Feature>
						))}
					</Feature.Grid>
				</MarketingSection>

				<MarketingSection id="pricing" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={page.pricing.badge}
						description={page.pricing.description}
						align="center"
					>
						{page.pricing.title}
					</MarketingHeader>
					<StatStrip size="display" variant="gap" align="center">
						{figures.map((figure) => (
							<StatStrip.Item key={figure.label} label={figure.label}>
								{figure.value}
							</StatStrip.Item>
						))}
					</StatStrip>
					<p mix={[mbs(8), mi("auto"), maxIs("60ch"), text("sm"), textAlign("center")]}>
						{page.pricing.note}
					</p>
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
					eyebrow={t("landing.faq.badge")}
					title={t("browserFlows.faq.title")}
					description={t("browserFlows.faq.description")}
					mix={[viewReveal()]}
				>
					<FaqAccordion items={page.faqs.slice(0, faqSplitIndex)} />
					<FaqAccordion items={page.faqs.slice(faqSplitIndex)} />
				</FaqBand>

				<ClosingBand
					id="start"
					isSignedIn={isSignedIn}
					title={page.finalCta.title}
					description={page.finalCta.body}
					startLabel={chrome.startLabel}
					dashboardLabel={chrome.dashboardLabel}
					secondary={
						isSignedIn ? null : (
							<LinkButton
								href={routes.trial.check.index.href()}
								color="neutral"
								variant="ghost"
								size="lg"
							>
								{tryLabel}
							</LinkButton>
						)
					}
				/>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
