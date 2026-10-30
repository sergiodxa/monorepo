/**
 * `GET /api/ui/marketing-components` — Phase 1 marketing primitives with live
 * demos: bands, headers, CTA clusters, splits, stats, logo clouds, and features.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ActivityIcon, GlobeIcon, ShieldCheckIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { container, relative, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import {
	Button,
	CtaGroup,
	Feature,
	HeadingScope,
	LinkButton,
	LogoCloud,
	MarketingHeader,
	MarketingSection,
	Split,
	StatStrip,
} from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import { ProductFrame } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import type { AppContext } from "~/app/initializers/router";
import type { Anchor } from "~/app/services/article";
import type { NavTree } from "~/app/services/navigation";

import { withBundleCache } from "~/app/http/caching";
import { adsDayTag } from "~/app/services/ads";
import {
	MARKETING_COMPONENTS_SUMMARY,
	MARKETING_COMPONENTS_TITLE,
} from "~/app/services/catalogue-markdown";
import { MARKETING_COMPONENTS_SLUG, CATALOGUE_SOURCE_BASE } from "~/app/services/catalogue-pages";
import { absoluteUrl } from "~/config/constants";
import { IncidentCard, Wordmark, WORDMARKS } from "~/resources/components/demo-media";
import DocsAside, { hasDocsAside } from "~/resources/components/docs-aside";
import PageActions from "~/resources/components/page-actions";
import PageTitle from "~/resources/components/page-title";
import ReferenceSection from "~/resources/components/reference-section";
import Snippet from "~/resources/components/snippet";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The eyebrow looks the header demo walks through: variant, eyebrow copy and title. */
const EYEBROW_DEMOS = [
	["mono", "Monitoring", "Know it is down before your users do"],
	["quiet", "Status pages now support custom domains", "Your status page, on your domain"],
	["soft", "Alerting", "Page the right person, once"],
	["pill", "New", "Multi-region checks on every plan"],
	["numbered", "Incidents", "Every incident writes its own timeline"],
] as const satisfies readonly (readonly [MarketingHeader.EyebrowVariant, string, string])[];

/**
 * Renders the marketing components overview page.
 *
 * @param ctx - The request being answered.
 * @param tree - The `@sdxc/ui` tree, so the shell around the page still navigates.
 * @returns The rendered page, with the cache policy every generated page carries.
 */
export default async function marketingComponentsPage(ctx: AppContext, tree: NavTree) {
	let markdownHref = routes.markdown.component.href({ component: MARKETING_COMPONENTS_SLUG });
	let activePath = routes.api.component.href({ component: MARKETING_COMPONENTS_SLUG });

	let anchors: Anchor[] = [
		{ id: "section", text: "MarketingSection", level: 2 },
		{ id: "header", text: "MarketingHeader", level: 2 },
		{ id: "cta", text: "CtaGroup", level: 2 },
		{ id: "split", text: "Split", level: 2 },
		{ id: "stats", text: "StatStrip", level: 2 },
		{ id: "logos", text: "LogoCloud", level: 2 },
		{ id: "feature", text: "Feature", level: 2 },
	];

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${MARKETING_COMPONENTS_TITLE} — @sdxc/ui`}
			description={MARKETING_COMPONENTS_SUMMARY}
			canonical={ctx.url.href}
		>
			<DocsLayout
				tree={tree}
				activePath={activePath}
				breadcrumbs={[
					{ label: "API", href: routes.api.index.href() },
					{ label: "@sdxc/ui", href: routes.api.show.href({ name: "ui" }) },
					{ label: MARKETING_COMPONENTS_TITLE },
				]}
				aside={
					hasDocsAside(anchors) ? <DocsAside anchors={anchors} path={activePath} /> : undefined
				}
			>
				<article mix={[vstack({ gap: 10, align: "stretch" })]}>
					<header mix={[vstack({ gap: 4, align: "stretch" })]}>
						<PageTitle eyebrow="@sdxc/ui" title={MARKETING_COMPONENTS_TITLE}>
							Landing primitives built on the marketing foundations. Copy stays on the page — every
							string below is a demo prop. Listbox <code>Section</code> remains for menus.
						</PageTitle>
						<PageActions
							markdownHref={markdownHref}
							markdownUrl={absoluteUrl(markdownHref)}
							sourceUrl={`${CATALOGUE_SOURCE_BASE}ui/src/components/marketing-section.tsx`}
						/>
					</header>

					<div
						mix={[
							container("ui-marketing-docs"),
							relative(),
							vstack({ gap: 10, align: "stretch" }),
						]}
					>
						<ReferenceSection
							id="section"
							title="MarketingSection"
							lead='Tones plain, tinted, grid, inverse, brand and gradient; spacing compact, normal, hero and cta; an optional hairline and framed column. inset floats the band as a rounded panel ("top" / "bottom" join two). Pair with viewReveal() for scroll entry.'
						>
							<HeadingScope>
								<div mix={[vstack({ gap: 0, align: "stretch" })]}>
									<MarketingSection tone="tinted" spacing="compact" inset mix={[viewReveal()]}>
										<MarketingHeader
											eyebrow="Status pages"
											description={
												<>
													Publish incidents and maintenance from{" "}
													<strong>the dashboard your team already watches</strong>.
												</>
											}
											mix={[m(0)]}
										>
											Tell customers before they ask
										</MarketingHeader>
									</MarketingSection>
									<MarketingSection
										tone="brand"
										spacing="compact"
										align="center"
										inset
										mix={[viewReveal()]}
									>
										<MarketingHeader
											align="center"
											description="Six regions, thirty-second checks and a public status page on the free plan."
											mix={[m(0)]}
										>
											Five monitors free, forever
										</MarketingHeader>
									</MarketingSection>
								</div>
							</HeadingScope>
							<Snippet
								code={`<MarketingSection tone="tinted" spacing="compact" inset>
	<MarketingHeader eyebrow={t("badge")} description={t("lead")}>
		{t("title")}
	</MarketingHeader>
</MarketingSection>

<MarketingSection tone="brand" spacing="cta" align="center" inset>
	…
</MarketingSection>`}
								language="tsx"
							/>
						</ReferenceSection>

						<ReferenceSection
							id="header"
							title="MarketingHeader"
							lead="Eyebrow looks: mono (default), quiet, soft, pill and numbered, with eyebrowHref for a linked eyebrow and eyebrowIndex for a numbered one. Title uses chapter display size; lead uses marketingLead(), with <strong> drawn in the heading ink."
						>
							<div mix={[vstack({ gap: 10, align: "stretch" })]}>
								{EYEBROW_DEMOS.map(([variant, label, title]) => (
									<HeadingScope key={variant}>
										<MarketingHeader
											eyebrow={label}
											eyebrowVariant={variant}
											eyebrowHref={variant === "quiet" ? "/examples/changelog" : undefined}
											eyebrowIndex={variant === "numbered" ? "02" : undefined}
											description={
												<>
													<code>eyebrowVariant="{variant}"</code> — checks from six regions, and an
													alert only fires when <strong>two of them agree</strong>.
												</>
											}
											mix={[m(0)]}
										>
											{title}
										</MarketingHeader>
									</HeadingScope>
								))}
							</div>
						</ReferenceSection>

						<ReferenceSection
							id="cta"
							title="CtaGroup"
							lead='Primary + surface secondary. The group hands its size to every action without one: md (40px) by default for hero and closing rows, sm (32px) for nav. stack="phone" stacks the actions full width on a phone-width container. marketingCtaChrome() sets the CTA radius through --ui-button-radius and adds a soft edge.'
						>
							<CtaGroup stack="phone">
								<Button color="brand" mix={[marketingCtaChrome()]}>
									Start monitoring free
								</Button>
								<LinkButton href="/api/ui" variant="surface" mix={[marketingCtaChrome()]}>
									Read the docs
								</LinkButton>
							</CtaGroup>
						</ReferenceSection>

						<ReferenceSection
							id="split"
							title="Split"
							lead="Two columns that stack under the container. lean hands the wider track to copy or media; checks turns lists into claim rows."
						>
							<Split lean="copy">
								<Split.Copy checks>
									<p mix={[m(0), text("base"), fg("neutral")]}>
										Every incident writes its own timeline, so the postmortem starts half done.
									</p>
									<ul>
										<li>Status changes posted as they happen</li>
										<li>Responders and acknowledgements recorded</li>
										<li>One link to share with customers</li>
									</ul>
								</Split.Copy>
								<Split.Media>
									<ProductFrame stage="panel" lights title="Incident #2114">
										<IncidentCard />
									</ProductFrame>
								</Split.Media>
							</Split>
						</ReferenceSection>

						<ReferenceSection
							id="stats"
							title="StatStrip"
							lead="Numeric proof cells in two columns, one row from the lg container; an odd last cell spans both columns on a phone. Values and labels are always props."
						>
							<StatStrip>
								<StatStrip.Item label="Checks run every day">4.2M</StatStrip.Item>
								<StatStrip.Item label="Probe regions">6</StatStrip.Item>
								<StatStrip.Item label="Median alert latency">38s</StatStrip.Item>
								<StatStrip.Item label="Measured uptime">99.99%</StatStrip.Item>
							</StatStrip>
						</ReferenceSection>

						<ReferenceSection
							id="logos"
							title="LogoCloud"
							lead="Adopter marks at 1.75rem, 2.25rem from the lg container, laid out as a centered row, a row spread across the measure, or a ruled grid. label adds a line above; muted draws SVG marks in the body ink and image marks grayscale, at full opacity."
						>
							<LogoCloud layout="spread" label="Trusted by on-call teams at" muted>
								{WORDMARKS.map((mark) => (
									<Wordmark key={mark.name} name={mark.name} glyph={mark.glyph} />
								))}
							</LogoCloud>
						</ReferenceSection>

						<ReferenceSection
							id="feature"
							title="Feature + Feature.Grid"
							lead="Light claim cells by default. Feature.Grid draws hairlines between cells via a 1px gap."
						>
							<Feature.Grid columns={2}>
								<Feature>
									<Feature.Icon>
										<GlobeIcon />
									</Feature.Icon>
									<Feature.Title>Checks from six regions</Feature.Title>
									<Feature.Description>
										Every monitor runs from every region, every thirty seconds.
									</Feature.Description>
								</Feature>
								<Feature>
									<Feature.Icon>
										<ShieldCheckIcon />
									</Feature.Icon>
									<Feature.Title>Alerts that agree</Feature.Title>
									<Feature.Description>
										A page only fires when two regions see the same failure.
									</Feature.Description>
								</Feature>
								<Feature>
									<Feature.Icon>
										<ActivityIcon />
									</Feature.Icon>
									<Feature.Title>Status pages that update themselves</Feature.Title>
									<Feature.Description>
										Incidents post from the monitor that caught them.
									</Feature.Description>
								</Feature>
							</Feature.Grid>
						</ReferenceSection>
					</div>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, adsDayTag());
}
