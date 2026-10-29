/**
 * `GET /api/ui/landing-patterns` — Phase 2 building blocks composed as a
 * reference landing: Hero → Proof → FeatureBand × N → Faq → ClosingCta, plus
 * composition craft demos. Copy is placeholder props only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { container, inlineFlex, items, relative, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import {
	Accordion,
	Button,
	Feature,
	HeadingScope,
	LinkButton,
	LogoCloud,
	StatStrip,
} from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	Bento,
	CheckList,
	CheckRow,
	ClosingCta,
	CodeStage,
	FaqBand,
	FeatureBand,
	InstallTabs,
	LandingHero,
	ProductFrame,
	ProofStrip,
	StepList,
	TabbedStage,
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
import DocsAside, { hasDocsAside } from "~/resources/components/docs-aside";
import PageActions from "~/resources/components/page-actions";
import PageTitle from "~/resources/components/page-title";
import ReferenceSection from "~/resources/components/reference-section";
import Snippet from "~/resources/components/snippet";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

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
							Building blocks that encode catalog patterns. Every string below is a placeholder prop
							— the library ships no copy.
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
							id="page"
							title="Assembled page"
							lead="Hero → Proof → FeatureBand × N → Faq → ClosingCta. Import from @sdxc/ui/patterns."
						>
							<div
								mix={[rounded("xl"), border({ color: "neutral", width: 1 }), overflow("hidden")]}
							>
								<HeadingScope>
									<LandingHero
										tone="grid"
										eyebrow="Patterns"
										title="Assemble landings from shared bands"
										description="Placeholder lead — pages pass every string. Media sits beside the copy by default."
										actions={
											<>
												<Button size="lg" color="brand" mix={[marketingCtaChrome()]}>
													Start free
												</Button>
												<LinkButton
													href="/api/ui/marketing-components"
													size="lg"
													color="neutral"
													variant="outline"
												>
													Browse primitives
												</LinkButton>
											</>
										}
										media={
											<ProductFrame lights title="Product" url="app.example.com">
												<div
													mix={[
														bg("neutral.tint"),
														p(10),
														text("sm"),
														fg("neutral.muted"),
														font("mono"),
													]}
												>
													Media slot
												</div>
											</ProductFrame>
										}
										mix={[viewReveal()]}
									/>

									<ProofStrip>
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
										<StatStrip>
											<StatStrip.Item label="Packages">80+</StatStrip.Item>
											<StatStrip.Item label="Patterns">5</StatStrip.Item>
											<StatStrip.Item label="Craft">9</StatStrip.Item>
										</StatStrip>
									</ProofStrip>

									<FeatureBand
										layout="split"
										ruled
										title="Split a claim beside media"
										description='FeatureBand layout="split" wraps MarketingHeader + Split.'
										media={<CodeStage title="install.sh">bun add @sdxc/ui</CodeStage>}
										mix={[viewReveal()]}
									>
										<ul>
											<li>Shared measure and gutters</li>
											<li>Container-query stacks</li>
											<li>No copy baked into the library</li>
										</ul>
									</FeatureBand>

									<FeatureBand
										layout="grid"
										tone="tinted"
										ruled
										title="Or a feature grid"
										description='layout="grid" lays Feature cells with hairlines.'
										columns={2}
										mix={[viewReveal()]}
									>
										<Feature>
											<Feature.Icon>
												<span mix={[text("xs"), weight("bold")]}>1</span>
											</Feature.Icon>
											<Feature.Title>Foundations</Feature.Title>
											<Feature.Description>Tokens and style factories.</Feature.Description>
										</Feature>
										<Feature>
											<Feature.Icon>
												<span mix={[text("xs"), weight("bold")]}>2</span>
											</Feature.Icon>
											<Feature.Title>Primitives</Feature.Title>
											<Feature.Description>Section, header, split, proof.</Feature.Description>
										</Feature>
										<Feature>
											<Feature.Icon>
												<span mix={[text("xs"), weight("bold")]}>3</span>
											</Feature.Icon>
											<Feature.Title>Patterns</Feature.Title>
											<Feature.Description>Composites that encode the catalog.</Feature.Description>
										</Feature>
									</FeatureBand>

									<FeatureBand
										layout="steps"
										ruled
										title="How it works"
										description='layout="steps" numbers StepList children.'
										mix={[viewReveal()]}
									>
										<StepList.Item title="Compose">
											Import patterns and pass copy as props.
										</StepList.Item>
										<StepList.Item title="Frame media">
											Wrap shots in ProductFrame or CodeStage.
										</StepList.Item>
										<StepList.Item title="Ship">
											Reuse the same bands across landings.
										</StepList.Item>
									</FeatureBand>

									<FaqBand title="Questions" columns={2} ruled mix={[viewReveal()]}>
										<Accordion>
											<Accordion.Item name="landing-faq">
												<Accordion.Trigger>
													Where do strings live?
													<ChevronDownIcon data-slot="icon" aria-hidden="true" />
												</Accordion.Trigger>
												<Accordion.Content>
													<p>Every user-facing string is a prop or child from the page.</p>
												</Accordion.Content>
											</Accordion.Item>
											<Accordion.Item name="landing-faq">
												<Accordion.Trigger>
													Do patterns hydrate?
													<ChevronDownIcon data-slot="icon" aria-hidden="true" />
												</Accordion.Trigger>
												<Accordion.Content>
													<p>
														No — markup and style only. Tabs and install strips use radios + CSS.
													</p>
												</Accordion.Content>
											</Accordion.Item>
										</Accordion>
										<Accordion>
											<Accordion.Item name="landing-faq">
												<Accordion.Trigger>
													Root catalog or patterns?
													<ChevronDownIcon data-slot="icon" aria-hidden="true" />
												</Accordion.Trigger>
												<Accordion.Content>
													<p>
														Primitives stay on <code>@sdxc/ui</code>; composites import from{" "}
														<code>@sdxc/ui/patterns</code>.
													</p>
												</Accordion.Content>
											</Accordion.Item>
											<Accordion.Item name="landing-faq">
												<Accordion.Trigger>
													Can I mix craft pieces?
													<ChevronDownIcon data-slot="icon" aria-hidden="true" />
												</Accordion.Trigger>
												<Accordion.Content>
													<p>
														Yes — ProductFrame, IconWell, Bento, and friends compose inside any
														band.
													</p>
												</Accordion.Content>
											</Accordion.Item>
										</Accordion>
									</FaqBand>

									<ClosingCta
										title="Ready to assemble?"
										description="Placeholder closing lead."
										actions={
											<>
												<Button size="lg" color="brand" mix={[marketingCtaChrome()]}>
													Get started
												</Button>
												<LinkButton
													href="/api/ui/marketing-foundations"
													size="lg"
													color="neutral"
													variant="outline"
												>
													Foundations
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
							lead="Small affordances used inside bands — frames, stages, checks, wells, bento."
						>
							<div mix={[vstack({ gap: 8, align: "stretch" })]}>
								<CheckList orientation="horizontal">
									<CheckRow>No default English</CheckRow>
									<CheckRow>Container queries</CheckRow>
									<CheckRow>Platform-first tabs</CheckRow>
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
									<TabbedStage.Item value="frame" label="Frame" defaultChecked>
										<ProductFrame lights title="Inbox">
											<div mix={[bg("neutral.tint"), p(8), text("sm"), fg("neutral.muted")]}>
												Framed inbox
											</div>
										</ProductFrame>
									</TabbedStage.Item>
									<TabbedStage.Item value="code" label="Code">
										<CodeStage variant="terminal" title="~">
											$ bunx sdxc upgrade
										</CodeStage>
									</TabbedStage.Item>
								</TabbedStage>

								<Bento columns={3}>
									<Bento.Cell>
										<Bento.Title>Measure</Bento.Title>
										<Bento.Body>Shared marketing measure and gutters.</Bento.Body>
									</Bento.Cell>
									<Bento.Cell>
										<Bento.Title>Type</Bento.Title>
										<Bento.Body>Display and chapter recipes on Heading.</Bento.Body>
									</Bento.Cell>
									<Bento.Cell>
										<Bento.Title>Motion</Bento.Title>
										<Bento.Body>viewReveal on band hosts; reduced-motion safe.</Bento.Body>
									</Bento.Cell>
								</Bento>
							</div>
						</ReferenceSection>

						<ReferenceSection
							id="usage"
							title="Usage"
							lead="Import building blocks from the patterns entry."
						>
							<Snippet
								code={`import { Button, LinkButton, HeadingScope } from "@sdxc/ui";
import {
	LandingHero,
	ProofStrip,
	FeatureBand,
	ClosingCta,
	FaqBand,
} from "@sdxc/ui/patterns";

<HeadingScope>
	<LandingHero
		tone="grid"
		title={t("hero.title")}
		description={t("hero.lead")}
		actions={
			<>
				<Button size="lg">{t("hero.cta")}</Button>
				<LinkButton href={docs} variant="outline" size="lg">
					{t("hero.docs")}
				</LinkButton>
			</>
		}
		media={<img src={shot} alt={t("hero.alt")} />}
	/>
	<ProofStrip>{/* LogoCloud or StatStrip */}</ProofStrip>
	<FeatureBand layout="split" title={t("f1.title")} description={t("f1.lead")} media={...}>
		{/* claim list */}
	</FeatureBand>
	<FaqBand title={t("faq.title")} columns={2}>
		<Accordion>{left}</Accordion>
		<Accordion>{right}</Accordion>
	</FaqBand>
	<ClosingCta title={t("close.title")} description={t("close.lead")} actions={...} />
</HeadingScope>`}
								language="tsx"
							/>
						</ReferenceSection>
					</div>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, adsDayTag());
}
