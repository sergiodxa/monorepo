/**
 * `GET /api/ui/landing-patterns` — every `@sdxc/ui/patterns` band assembled into one
 * believable uptime-monitoring landing, followed by the smaller craft pieces and a usage
 * snippet, so a reader judges the patterns by a finished page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellRingIcon, ChevronDownIcon, GaugeIcon, GlobeIcon } from "@sdxc/icons";
import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { container, relative, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import {
	Accordion,
	Badge,
	Button,
	Feature,
	HeadingScope,
	LinkButton,
	LogoCloud,
	MarketingHeader,
	MarketingSection,
	StatStrip,
} from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	AccentText,
	Bento,
	CheckList,
	CheckRow,
	ClosingCta,
	CodeStage,
	FaqBand,
	FeatureBand,
	InstallTabs,
	LandingHero,
	PricingBand,
	ProductFrame,
	ProofStrip,
	TabbedStage,
	TestimonialBand,
} from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import type { AppContext } from "~/app/initializers/router";
import type { Anchor } from "~/app/services/article";
import type { NavTree } from "~/app/services/navigation";

import { withBundleCache } from "~/app/http/caching";
import { adsDayTag } from "~/app/services/ads";
import {
	LANDING_PATTERNS_SUMMARY,
	LANDING_PATTERNS_TITLE,
} from "~/app/services/catalogue-markdown";
import { LANDING_PATTERNS_SLUG, CATALOGUE_SOURCE_BASE } from "~/app/services/catalogue-pages";
import { absoluteUrl } from "~/config/constants";
import DemoLandingLinks from "~/resources/components/demo-landing-links";
import { IncidentCard, StatusBoard, Wordmark, WORDMARKS } from "~/resources/components/demo-media";
import DocsAside, { hasDocsAside } from "~/resources/components/docs-aside";
import PageActions from "~/resources/components/page-actions";
import PageTitle from "~/resources/components/page-title";
import ReferenceSection from "~/resources/components/reference-section";
import Snippet from "~/resources/components/snippet";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import { listDemoLandings } from "~/resources/views/demos";
import routes from "~/routes/web";

/** The 45 days the bento's availability chart draws, oldest first. */
const AVAILABILITY_DAYS = Array.from({ length: 45 }, (_, day) => day);

/** The days the availability chart marks as an outage, drawn short and in the danger color. */
const OUTAGE_DAYS = new Set([12, 31]);

/** What the CLI step of the stage prints when a monitor is added. */
const ADD_MONITOR_OUTPUT = `$ beacon monitors add https://api.example.com/health --every 30s
✓ Monitor created: api-health
✓ Checking from 6 regions every 30 seconds
✓ First result: 200 OK in 84 ms`;

/** What the probes reported for the failing check the stage's second step confirms. */
const PROBE_OUTPUT = `checkout.example.com      status   latency
eu-west    Dublin         503      1.2 s
us-east    Virginia       503      1.4 s
us-west    Oregon         200      212 ms
ap-south   Singapore      200      388 ms

2 of 6 regions failing · incident opened`;

/** The webhook the stage's third step shows the on-call rotation receiving. */
const ALERT_PAYLOAD = `{
  "incident": 2114,
  "monitor": "checkout.example.com",
  "regions": ["eu-west", "us-east"],
  "paged": "ana@example.com",
  "escalates_in": "5m"
}`;

/** The source the usage section prints, matching the bands the assembled page draws. */
const USAGE_CODE = `import { Button, HeadingScope, LinkButton } from "@sdxc/ui";
import {
	ClosingCta,
	FaqBand,
	FeatureBand,
	LandingHero,
	ProductFrame,
	ProofStrip,
} from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

<HeadingScope>
	<LandingHero
		eyebrow={t("hero.eyebrow")}
		eyebrowHref="/changelog"
		title={t("hero.title")}
		description={t("hero.lead")}
		actions={
			<>
				<Button color="brand" mix={[marketingCtaChrome()]}>{t("hero.cta")}</Button>
				<LinkButton href="/pricing" variant="surface" mix={[marketingCtaChrome()]}>
					{t("hero.pricing")}
				</LinkButton>
			</>
		}
		note={t("hero.note")}
		media={
			<ProductFrame stage="panel" lights title="Status">
				<img src={shot} alt={t("hero.alt")} />
			</ProductFrame>
		}
	/>
	<ProofStrip>{/* LogoCloud and StatStrip */}</ProofStrip>
	<FeatureBand layout="split" title={t("f1.title")} description={t("f1.lead")} media={...}>
		{/* claim list */}
	</FeatureBand>
	<FeatureBand layout="grid" tone="brand" inset title={t("f2.title")}>
		{/* Feature cells */}
	</FeatureBand>
	<FaqBand title={t("faq.title")} columns={2}>
		<Accordion>{left}</Accordion>
		<Accordion>{right}</Accordion>
	</FaqBand>
	<ClosingCta inset title={t("close.title")} description={t("close.lead")} actions={...} />
</HeadingScope>`;

/**
 * Renders the landing patterns overview page.
 *
 * @param ctx - The request being answered.
 * @param tree - The `@sdxc/ui` tree, so the shell around the page still navigates.
 * @returns The rendered page, with the cache policy every generated page carries.
 */
export default async function landingPatternsPage(ctx: AppContext, tree: NavTree) {
	let markdownHref = routes.markdown.component.href({ component: LANDING_PATTERNS_SLUG });
	let activePath = routes.api.component.href({ component: LANDING_PATTERNS_SLUG });

	let anchors: Anchor[] = [
		{ id: "demos", text: "Demo landings", level: 2 },
		{ id: "page", text: "Assembled page", level: 2 },
		{ id: "craft", text: "Composition craft", level: 2 },
		{ id: "usage", text: "Usage", level: 2 },
	];

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${LANDING_PATTERNS_TITLE} — @sdxc/ui`}
			description={LANDING_PATTERNS_SUMMARY}
			canonical={ctx.url.href}
		>
			<DocsLayout
				tree={tree}
				activePath={activePath}
				breadcrumbs={[
					{ label: "API", href: routes.api.index.href() },
					{ label: "@sdxc/ui", href: routes.api.show.href({ name: "ui" }) },
					{ label: LANDING_PATTERNS_TITLE },
				]}
				aside={
					hasDocsAside(anchors) ? <DocsAside anchors={anchors} path={activePath} /> : undefined
				}
			>
				<article mix={[vstack({ gap: 10, align: "stretch" })]}>
					<header mix={[vstack({ gap: 4, align: "stretch" })]}>
						<PageTitle eyebrow="@sdxc/ui/patterns" title={LANDING_PATTERNS_TITLE}>
							Page-width bands that compose into a full landing. The library ships no copy: every
							string on the sample page below is a prop the page passes.
						</PageTitle>
						<PageActions
							markdownHref={markdownHref}
							markdownUrl={absoluteUrl(markdownHref)}
							sourceUrl={`${CATALOGUE_SOURCE_BASE}ui/src/patterns/landing-hero.tsx`}
						/>
					</header>

					<div
						mix={[
							container("ui-landing-patterns-docs"),
							relative(),
							vstack({ gap: 10, align: "stretch" }),
						]}
					>
						<ReferenceSection
							id="demos"
							title="Demo landings"
							lead="The patterns assembled into three complete landings, each with its own product, palette and type, to see how far the same bands stretch. They open in a new tab."
						>
							<DemoLandingLinks demos={await listDemoLandings()} />
						</ReferenceSection>

						<ReferenceSection
							id="page"
							title="Assembled page"
							lead="A sample uptime product, top to bottom: LandingHero, ProofStrip, FeatureBand as split, grid and stage, Bento in a MarketingSection, PricingBand, TestimonialBand, FaqBand and ClosingCta."
						>
							<div
								mix={[rounded("xl"), border({ color: "neutral", width: 1 }), overflow("hidden")]}
							>
								<HeadingScope>
									<LandingHero
										eyebrow="Status pages on your own domain"
										eyebrowHref="/examples/changelog"
										title={
											<>
												Catch the outage <AccentText>before customers do</AccentText>
											</>
										}
										description={
											<>
												Checks from six regions every thirty seconds, alerts that fire only when{" "}
												<strong>two regions agree</strong>, and a status page that updates itself.
											</>
										}
										actions={
											<>
												<Button color="brand" mix={[marketingCtaChrome()]}>
													Start monitoring free
												</Button>
												<LinkButton
													href="/examples/pricing"
													variant="surface"
													mix={[marketingCtaChrome()]}
												>
													See pricing
												</LinkButton>
											</>
										}
										note="Five monitors free forever. No card required."
										media={
											<ProductFrame stage="panel" lights title="Status" url="status.example.com">
												<StatusBoard />
											</ProductFrame>
										}
										mix={[viewReveal()]}
									/>

									<ProofStrip>
										<LogoCloud layout="spread" label="Watching production for teams at" muted>
											{WORDMARKS.map((mark) => (
												<Wordmark key={mark.name} name={mark.name} glyph={mark.glyph} />
											))}
										</LogoCloud>
										<StatStrip>
											<StatStrip.Item label="Checks run every day">1.2B</StatStrip.Item>
											<StatStrip.Item label="Median time to alert">38s</StatStrip.Item>
											<StatStrip.Item label="Probe regions">6</StatStrip.Item>
										</StatStrip>
									</ProofStrip>

									<FeatureBand
										layout="split"
										eyebrow="Incidents"
										title="Every outage leaves a record"
										description={
											<>
												Each state change lands on the incident timeline as it happens, so the{" "}
												<strong>post-mortem is drafted</strong> by the time the page clears.
											</>
										}
										media={
											<ProductFrame shadow="stage" lights title="Incident #482">
												<IncidentCard />
											</ProductFrame>
										}
										mix={[viewReveal()]}
									>
										<ul>
											<li>Status changes posted the moment they happen</li>
											<li>Acknowledgements and responders on the record</li>
											<li>One link to share with affected customers</li>
										</ul>
									</FeatureBand>

									<FeatureBand
										layout="grid"
										tone="brand"
										inset
										eyebrow="On-call"
										title="Fewer pages, better ones"
										description="Every alert arrives with the context to act on it."
										columns={3}
										mix={[viewReveal()]}
									>
										<Feature>
											<Feature.Icon tone="quiet">
												<GlobeIcon />
											</Feature.Icon>
											<Feature.Title>Six probe regions</Feature.Title>
											<Feature.Description>
												Every check runs from <strong>three continents</strong>, so a local outage
												never hides behind a healthy region.
											</Feature.Description>
										</Feature>
										<Feature>
											<Feature.Icon tone="quiet">
												<BellRingIcon />
											</Feature.Icon>
											<Feature.Title>Alerts that agree</Feature.Title>
											<Feature.Description>
												A page fires only when <strong>two regions</strong> see the failure, which
												keeps one flaky network off your phone.
											</Feature.Description>
										</Feature>
										<Feature>
											<Feature.Icon tone="quiet">
												<GaugeIcon />
											</Feature.Icon>
											<Feature.Title>Latency per region</Feature.Title>
											<Feature.Description>
												Response time is charted per region, so you see{" "}
												<strong>slow before down</strong>.
											</Feature.Description>
										</Feature>
									</FeatureBand>

									<FeatureBand
										layout="stage"
										id="landing-patterns-how"
										eyebrow="How it works"
										title="From failed probe to phone"
										description={
											<>
												Every alert is <strong>confirmed from two regions</strong> before it pages
												anyone.
											</>
										}
										mix={[viewReveal()]}
									>
										<TabbedStage.Item
											value="watch"
											label="Watch every endpoint"
											description="Add a URL from the dashboard or the CLI and probes start within a minute."
											defaultChecked
										>
											<CodeStage variant="terminal" title="~">
												{ADD_MONITOR_OUTPUT}
											</CodeStage>
										</TabbedStage.Item>
										<TabbedStage.Item
											value="confirm"
											label="Confirm before paging"
											description={
												<>
													A failure opens an incident only when <strong>two regions agree</strong>,
													so one bad route stays quiet.
												</>
											}
										>
											<CodeStage variant="terminal" title="probes">
												{PROBE_OUTPUT}
											</CodeStage>
										</TabbedStage.Item>
										<TabbedStage.Item
											value="page"
											label="Page the right person"
											description="Alerts follow the on-call rotation and escalate after five quiet minutes."
										>
											<CodeStage title="webhook.json">{ALERT_PAYLOAD}</CodeStage>
										</TabbedStage.Item>
									</FeatureBand>

									<MarketingSection mix={[viewReveal()]}>
										<MarketingHeader
											eyebrow="Platform"
											description="Monitors, incidents and status pages share one timeline, so nobody copies an update between tools."
										>
											One place for uptime
										</MarketingHeader>
										<HeadingScope>
											<Bento columns={3}>
												<Bento.Cell>
													<Bento.Media>
														<svg
															viewBox="0 0 360 140"
															role="img"
															aria-label="Availability over the last 45 days"
														>
															{AVAILABILITY_DAYS.map((day) => (
																<rect
																	key={day}
																	x={day * 8}
																	y={OUTAGE_DAYS.has(day) ? 64 : 24}
																	width="5"
																	height={OUTAGE_DAYS.has(day) ? 76 : 116}
																	rx="2"
																	fill="currentColor"
																	mix={[fg(OUTAGE_DAYS.has(day) ? "danger" : "success")]}
																/>
															))}
														</svg>
													</Bento.Media>
													<Bento.Title size="lg">Monitors</Bento.Title>
													<Bento.Body>
														HTTP, TCP and DNS checks every thirty seconds, with{" "}
														<strong>response time per region</strong> beside up or down.
													</Bento.Body>
												</Bento.Cell>
												<Bento.Cell>
													<Bento.Title>Incidents</Bento.Title>
													<Bento.Body>
														An outage opens an incident, pages whoever holds the pager and{" "}
														<strong>closes itself</strong> once every region recovers.
													</Bento.Body>
												</Bento.Cell>
												<Bento.Cell>
													<Bento.Title>Status pages</Bento.Title>
													<Bento.Body>
														Publish live status on your own domain, with{" "}
														<strong>subscriber updates</strong> by email and RSS.
													</Bento.Body>
												</Bento.Cell>
											</Bento>
										</HeadingScope>
									</MarketingSection>

									<PricingBand
										tone="tinted"
										eyebrow="Pricing"
										title="Priced by monitor, not seat"
										description={
											<>
												Every plan checks from six regions. Pay for{" "}
												<strong>more monitors and faster checks</strong>, never for teammates.
											</>
										}
										mix={[viewReveal()]}
									>
										<PricingBand.Plan
											name="Hobby"
											price="$0"
											period="/month"
											description="For side projects and a personal status page."
											features={
												<>
													<CheckRow>Five monitors</CheckRow>
													<CheckRow>Five-minute checks</CheckRow>
													<CheckRow>Email alerts</CheckRow>
													<CheckRow>One public status page</CheckRow>
												</>
											}
											action={
												<LinkButton
													href="/examples/signup"
													size="lg"
													color="neutral"
													variant="surface"
												>
													Start for free
												</LinkButton>
											}
										/>
										<PricingBand.Plan
											name="Team"
											price="$29"
											period="/month"
											featured
											badge={<Badge color="brand">Most popular</Badge>}
											description="For a product team that shares the on-call rotation."
											features={
												<>
													<CheckRow>Fifty monitors</CheckRow>
													<CheckRow>Thirty-second checks</CheckRow>
													<CheckRow>Slack, SMS and webhook alerts</CheckRow>
													<CheckRow>Status pages on your own domain</CheckRow>
												</>
											}
											action={
												<LinkButton href="/examples/signup?plan=team" size="lg" color="brand">
													Start a 14-day trial
												</LinkButton>
											}
										/>
										<PricingBand.Plan
											name="Business"
											price="$99"
											period="/month"
											description="For companies with an uptime promise in their contracts."
											features={
												<>
													<CheckRow>Two hundred monitors</CheckRow>
													<CheckRow>Ten-second checks</CheckRow>
													<CheckRow>Escalation policies</CheckRow>
													<CheckRow>Monthly SLA reports</CheckRow>
												</>
											}
											action={
												<LinkButton
													href="/examples/pricing"
													size="lg"
													color="neutral"
													variant="surface"
												>
													Talk to sales
												</LinkButton>
											}
										/>
									</PricingBand>

									<TestimonialBand
										columns={3}
										eyebrow="Customers"
										title="On-call teams sleep better"
										mix={[viewReveal()]}
									>
										<TestimonialBand.Quote
											name="Priya Natarajan"
											jobTitle="Staff SRE, Ledgerline"
											avatar="PN"
										>
											We used to learn about outages from support tickets. Now the alert lands{" "}
											<strong>before the first customer notices</strong>, and the status page
											updates itself.
										</TestimonialBand.Quote>
										<TestimonialBand.Quote
											name="Hannah Becker"
											jobTitle="Platform lead, Northwind Freight"
											avatar="HB"
										>
											Six regions means we finally see when it is <strong>only Singapore</strong>{" "}
											that is slow, instead of guessing from one probe in Virginia.
										</TestimonialBand.Quote>
										<TestimonialBand.Quote name="Omar Haddad" jobTitle="Solo developer" avatar="OH">
											The free plan covers all my side projects. When one of them started making
											money, upgrading took one click.
										</TestimonialBand.Quote>
									</TestimonialBand>

									<FaqBand
										eyebrow="FAQ"
										title="Questions before you start"
										columns={2}
										mix={[viewReveal()]}
									>
										<Accordion>
											<Accordion.Item name="landing-faq">
												<Accordion.Trigger>
													How fast will I hear about an outage?
													<ChevronDownIcon data-slot="icon" aria-hidden="true" />
												</Accordion.Trigger>
												<Accordion.Content>
													<p>
														On the Team plan a failing endpoint is checked every thirty seconds, and
														the alert goes out as soon as a second region confirms it. Most teams
														are paged in under a minute.
													</p>
												</Accordion.Content>
											</Accordion.Item>
											<Accordion.Item name="landing-faq">
												<Accordion.Trigger>
													Will a flaky network wake me up?
													<ChevronDownIcon data-slot="icon" aria-hidden="true" />
												</Accordion.Trigger>
												<Accordion.Content>
													<p>
														No single probe can page you. An incident opens only when two regions
														see the same failure, and it closes on its own once every region passes
														again.
													</p>
												</Accordion.Content>
											</Accordion.Item>
										</Accordion>
										<Accordion>
											<Accordion.Item name="landing-faq">
												<Accordion.Trigger>
													Can the status page use my domain?
													<ChevronDownIcon data-slot="icon" aria-hidden="true" />
												</Accordion.Trigger>
												<Accordion.Content>
													<p>
														Yes, on every paid plan. Point a CNAME at us and we issue the
														certificate, so the page lives at an address like status.yourcompany.com
														within minutes.
													</p>
												</Accordion.Content>
											</Accordion.Item>
											<Accordion.Item name="landing-faq">
												<Accordion.Trigger>
													What happens when I hit my monitor limit?
													<ChevronDownIcon data-slot="icon" aria-hidden="true" />
												</Accordion.Trigger>
												<Accordion.Content>
													<p>
														Existing monitors keep running and nothing is paused. You can upgrade
														from the dashboard at any time, and the price difference is prorated for
														the rest of the month.
													</p>
												</Accordion.Content>
											</Accordion.Item>
										</Accordion>
									</FaqBand>

									<ClosingCta
										inset
										title="Start watching in two minutes"
										description="Five monitors and a public status page, free for as long as you need them."
										actions={
											<>
												<Button color="brand" mix={[marketingCtaChrome()]}>
													Create an account
												</Button>
												<LinkButton
													href="/examples/pricing"
													variant="surface"
													mix={[marketingCtaChrome()]}
												>
													Talk to us
												</LinkButton>
											</>
										}
										mix={[viewReveal()]}
									/>
								</HeadingScope>
							</div>
						</ReferenceSection>

						<ReferenceSection
							id="craft"
							title="Composition craft"
							lead="Smaller pieces the bands are built from — a check list, an install strip and a tabbed stage — usable inside any band."
						>
							<div mix={[vstack({ gap: 8, align: "stretch" })]}>
								<CheckList orientation="horizontal">
									<CheckRow>Thirty-second checks</CheckRow>
									<CheckRow>Six probe regions</CheckRow>
									<CheckRow>No card required</CheckRow>
								</CheckList>

								<InstallTabs name="docs-pkg" aria-label="Package manager">
									<InstallTabs.Option value="bun" label="bun" defaultChecked>
										bun add @sdxc/ui
									</InstallTabs.Option>
									<InstallTabs.Option value="npm" label="npm">
										npm add @sdxc/ui
									</InstallTabs.Option>
									<InstallTabs.Option value="pnpm" label="pnpm">
										pnpm add @sdxc/ui
									</InstallTabs.Option>
								</InstallTabs>

								<TabbedStage name="docs-stage" aria-label="Product views">
									<TabbedStage.Item value="status" label="Status page" defaultChecked>
										<ProductFrame lights title="Status" url="status.example.com">
											<StatusBoard />
										</ProductFrame>
									</TabbedStage.Item>
									<TabbedStage.Item value="cli" label="CLI">
										<CodeStage variant="terminal" title="~">
											{ADD_MONITOR_OUTPUT}
										</CodeStage>
									</TabbedStage.Item>
								</TabbedStage>
							</div>
						</ReferenceSection>

						<ReferenceSection
							id="usage"
							title="Usage"
							lead="Import the bands from the patterns entry and pass every string from the page."
						>
							<Snippet code={USAGE_CODE} language="tsx" />
						</ReferenceSection>
					</div>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, adsDayTag());
}
