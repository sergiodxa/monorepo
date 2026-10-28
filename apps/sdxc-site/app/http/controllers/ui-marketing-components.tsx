/**
 * `GET /api/ui/marketing-components` — Phase 1 marketing primitives with live
 * demos: bands, headers, CTA clusters, splits, stats, logo clouds, and features.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { container, inlineFlex, items, relative, vstack } from "sdxc/u/layout";
import { m, p } from "sdxc/u/size";
import { font, text, weight } from "sdxc/u/typography";
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
} from "sdxc/ui";
import { viewReveal } from "sdxc/ui/animations";
import { marketingCtaChrome } from "sdxc/ui/styles";

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
import DocsAside, { hasDocsAside } from "~/resources/components/docs-aside";
import PageActions from "~/resources/components/page-actions";
import PageTitle from "~/resources/components/page-title";
import ReferenceSection from "~/resources/components/reference-section";
import Snippet from "~/resources/components/snippet";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

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
							lead="Tone, spacing, optional hairline, and an optional framed column. Pair with viewReveal() for scroll entry."
						>
							<HeadingScope>
								<MarketingSection tone="tinted" spacing="compact" ruled mix={[viewReveal()]}>
									<MarketingHeader
										eyebrow="Band"
										description="A quiet tint behind the content column."
									>
										MarketingSection tone="tinted"
									</MarketingHeader>
								</MarketingSection>
							</HeadingScope>
							<Snippet
								code={`<MarketingSection tone="tinted" spacing="normal" ruled>
	<MarketingHeader eyebrow={t("badge")} description={t("lead")}>
		{t("title")}
	</MarketingHeader>
</MarketingSection>`}
								language="tsx"
							/>
						</ReferenceSection>

						<ReferenceSection
							id="header"
							title="MarketingHeader"
							lead="Eyebrow variants: pill, mono, chip. Title uses chapter display size; lead uses marketingLead()."
						>
							<div mix={[vstack({ gap: 6, align: "stretch" })]}>
								{(
									[
										["pill", "New"],
										["mono", "Section"],
										["chip", "Beta"],
									] as const
								).map(([variant, label]) => (
									<HeadingScope key={variant}>
										<MarketingHeader
											eyebrow={label}
											eyebrowVariant={variant}
											description={`eyebrowVariant="${variant}"`}
											align="start"
											mix={[m(0)]}
										>
											Chapter-sized title
										</MarketingHeader>
									</HeadingScope>
								))}
							</div>
						</ReferenceSection>

						<ReferenceSection
							id="cta"
							title="CtaGroup"
							lead='Primary + secondary actions. Hero rows use size="lg" (~48px); nav rows use size="sm" (~32px). marketingCtaChrome() adds brand radius + soft shadow.'
						>
							<CtaGroup>
								<Button size="lg" color="brand" mix={[marketingCtaChrome()]}>
									Start free
								</Button>
								<LinkButton href="/api/ui" size="lg" color="neutral" variant="outline">
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
										Prose on the wide track; claims below carry brand checks.
									</p>
									<ul>
										<li>Shared measure and gutters</li>
										<li>Container-query stacks</li>
										<li>No copy baked into the library</li>
									</ul>
								</Split.Copy>
								<Split.Media>
									<div
										mix={[
											rounded("lg"),
											border({ color: "neutral", width: 1 }),
											bg("neutral.tint"),
											p(8),
											text("sm"),
											fg("neutral.muted"),
											font("mono"),
										]}
									>
										Media slot
									</div>
								</Split.Media>
							</Split>
						</ReferenceSection>

						<ReferenceSection
							id="stats"
							title="StatStrip"
							lead="Numeric proof cells. Values and labels are always props."
						>
							<StatStrip>
								<StatStrip.Item label="Packages">80+</StatStrip.Item>
								<StatStrip.Item label="Apps">12</StatStrip.Item>
								<StatStrip.Item label="Tokens">1 theme</StatStrip.Item>
								<StatStrip.Item label="Motion">viewReveal</StatStrip.Item>
							</StatStrip>
						</ReferenceSection>

						<ReferenceSection
							id="logos"
							title="LogoCloud"
							lead="Adopter marks forced to ~1rem with muted currentColor treatment."
						>
							<LogoCloud muted>
								{(["Acme", "Globex", "Initech", "Umbrella"] as const).map((name) => (
									<span
										key={name}
										mix={[
											inlineFlex(),
											items("center"),
											rounded("sm"),
											bg("neutral.tint"),
											border({ color: "neutral", width: 1 }),
											p(0, 3),
											font("mono"),
											text("xs"),
											weight("medium"),
										]}
									>
										{name}
									</span>
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
										<span mix={[text("sm"), weight("bold")]}>1</span>
									</Feature.Icon>
									<Feature.Title>Foundations first</Feature.Title>
									<Feature.Description>
										Tokens and factories unlock every later band.
									</Feature.Description>
								</Feature>
								<Feature>
									<Feature.Icon>
										<span mix={[text("sm"), weight("bold")]}>2</span>
									</Feature.Icon>
									<Feature.Title>Primitives next</Feature.Title>
									<Feature.Description>
										Assemble pages from section, header, split, and proof.
									</Feature.Description>
								</Feature>
								<Feature>
									<Feature.Icon>
										<span mix={[text("sm"), weight("bold")]}>3</span>
									</Feature.Icon>
									<Feature.Title>Composites later</Feature.Title>
									<Feature.Description>
										LandingHero and FeatureBand encode full patterns in Phase 2.
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
