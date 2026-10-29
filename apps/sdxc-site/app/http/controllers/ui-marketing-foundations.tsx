/**
 * `GET /api/ui/marketing-foundations` — marketing layout tokens, band tones,
 * section spacing, and the style factories that read them, with live demos.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { container, gap, inlineFlex, items, relative, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { font, nowrap, text, tracking, weight } from "@sdxc/u/typography";
import { viewReveal } from "@sdxc/ui/animations";
import {
	displayHeading,
	logoCloudMark,
	marketingBandTone,
	marketingContainer,
	marketingHairline,
	marketingLead,
	marketingSectionSpace,
} from "@sdxc/ui/styles";

import type { AppContext } from "~/app/initializers/router";
import type { Anchor } from "~/app/services/article";
import type { NavTree } from "~/app/services/navigation";

import { withBundleCache } from "~/app/http/caching";
import { adsDayTag } from "~/app/services/ads";
import {
	MARKETING_FOUNDATIONS_SUMMARY,
	MARKETING_FOUNDATIONS_TITLE,
} from "~/app/services/catalogue-markdown";
import { MARKETING_FOUNDATIONS_SLUG, CATALOGUE_SOURCE_BASE } from "~/app/services/catalogue-pages";
import { absoluteUrl } from "~/config/constants";
import DocsAside, { hasDocsAside } from "~/resources/components/docs-aside";
import PageActions from "~/resources/components/page-actions";
import PageTitle from "~/resources/components/page-title";
import ReferenceSection from "~/resources/components/reference-section";
import ReferenceTable from "~/resources/components/reference-table";
import Snippet from "~/resources/components/snippet";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Every marketing token the foundations page tables, with what it controls. */
const MARKETING_TOKENS = [
	["--ui-marketing-measure", "Max content width of a marketing column (default 72rem)"],
	[
		"--ui-marketing-gutter",
		"Inline padding at the narrowest container step (1rem → 1.5rem → 2rem)",
	],
	["--ui-marketing-section-space", "Block padding for a normal band (6rem)"],
	["--ui-marketing-section-space-compact", "Block padding for a compact band (4rem)"],
	["--ui-marketing-section-space-hero", "Block padding for a hero band (8rem)"],
	["--ui-marketing-display-tracking", "Letter-spacing for display headlines (−0.04em)"],
	["--ui-marketing-display-weight", "Font weight for display headlines (500)"],
	["--ui-marketing-display-leading", "Line-height for display headlines (1)"],
	["--ui-marketing-lead-measure", "Max width of supporting lead copy (40rem)"],
	["--ui-marketing-lead-size", "Font size of supporting lead copy (1.125rem)"],
	["--ui-marketing-chapter-size", "Font size of a marketing section H2 (2.75rem)"],
	["--ui-marketing-logo-height", "Forced height of a logo-cloud mark (1rem)"],
	["--ui-marketing-header-height", "Sticky marketing header target (4rem)"],
	[
		"--ui-marketing-cta-radius",
		"Corner radius language for brand CTAs (0.5rem; override per brand)",
	],
	["--ui-font-display", "Optional display family; falls back to the body face"],
] as const;

/** Band tones the live demo walks through. */
const TONES = ["plain", "tinted", "grid", "inverse"] as const;

/** Section spacing steps the live demo walks through. */
const SPACINGS = ["compact", "normal", "hero"] as const;

/**
 * Renders the marketing foundations page.
 *
 * @param ctx - The request being answered.
 * @param tree - The `@sdxc/ui` tree, so the shell around the page still navigates.
 * @returns The rendered page, with the cache policy every generated page carries.
 */
export default async function marketingFoundationsPage(ctx: AppContext, tree: NavTree) {
	let markdownHref = routes.markdown.component.href({ component: MARKETING_FOUNDATIONS_SLUG });
	let activePath = routes.api.component.href({ component: MARKETING_FOUNDATIONS_SLUG });

	let anchors: Anchor[] = [
		{ id: "tokens", text: "Tokens", level: 2 },
		{ id: "tones", text: "Band tones", level: 2 },
		{ id: "spacing", text: "Section spacing", level: 2 },
		{ id: "type", text: "Display type", level: 2 },
		{ id: "motion", text: "Motion", level: 2 },
		{ id: "notes", text: "Notes", level: 2 },
	];

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${MARKETING_FOUNDATIONS_TITLE} — @sdxc/ui`}
			description={MARKETING_FOUNDATIONS_SUMMARY}
			canonical={ctx.url.href}
		>
			<DocsLayout
				tree={tree}
				activePath={activePath}
				breadcrumbs={[
					{ label: "API", href: routes.api.index.href() },
					{ label: "@sdxc/ui", href: routes.api.show.href({ name: "ui" }) },
					{ label: MARKETING_FOUNDATIONS_TITLE },
				]}
				aside={
					hasDocsAside(anchors) ? <DocsAside anchors={anchors} path={activePath} /> : undefined
				}
			>
				<article mix={[vstack({ gap: 10, align: "stretch" })]}>
					<header mix={[vstack({ gap: 4, align: "stretch" })]}>
						<PageTitle eyebrow="@sdxc/ui" title={MARKETING_FOUNDATIONS_TITLE}>
							Layout tokens and style factories for landing bands. Override the tokens per brand;
							compose the factories into section hosts. Listbox <code>Section</code> stays for menus
							— landing bands use <code>MarketingSection</code> and the other primitives on{" "}
							<a href={routes.api.component.href({ component: "marketing-components" })}>
								Marketing components
							</a>
							.
						</PageTitle>
						<PageActions
							markdownHref={markdownHref}
							markdownUrl={absoluteUrl(markdownHref)}
							sourceUrl={`${CATALOGUE_SOURCE_BASE}ui/src/styles/marketing.ts`}
						/>
					</header>

					<ReferenceSection
						id="tokens"
						title="Tokens"
						lead="Declared on :root in theme.css. Apps override any of them; brand colors stay on the existing --ui-color-* scales."
					>
						<ReferenceTable
							label="Marketing layout tokens"
							columns={["Token", "What it controls"]}
							rows={MARKETING_TOKENS.map(([name, controls]) => [
								<code mix={[font("mono"), text("sm"), fg("neutral.emphasis"), nowrap()]}>
									{name}
								</code>,
								<span mix={[text("sm"), fg("neutral")]}>{controls}</span>,
							])}
						/>
						<Snippet
							code={`import "@sdxc/ui/theme.css";

:root {
	--ui-marketing-measure: 72rem; /* or 76rem for a wider frame */
	--ui-marketing-cta-radius: 9999px; /* pill CTAs */
}`}
							language="css"
						/>
					</ReferenceSection>

					<div
						mix={[
							container("ui-marketing-docs"),
							relative(),
							vstack({ gap: 10, align: "stretch" }),
						]}
					>
						<ReferenceSection
							id="tones"
							title="Band tones"
							lead="marketingBandTone() paints the band host. Pair it with marketingSectionSpace() and marketingContainer() on the inner column."
						>
							<div mix={[vstack({ gap: 4, align: "stretch" })]}>
								{TONES.map((tone) => (
									<section
										key={tone}
										mix={[
											marketingBandTone(tone),
											marketingSectionSpace("compact"),
											viewReveal(),
											border({ color: "neutral", width: 1 }),
										]}
									>
										<div mix={[marketingContainer(), vstack({ gap: 2, align: "stretch" })]}>
											<span
												mix={[
													font("mono"),
													text("sm"),
													weight("medium"),
													tone === "inverse" ? fg("neutral.onSolid") : fg("neutral.emphasis"),
												]}
											>
												marketingBandTone("{tone}")
											</span>
											<p
												mix={[
													m(0),
													text("sm"),
													tone === "inverse" ? fg("neutral.onSolid") : fg("neutral.muted"),
												]}
											>
												A quiet band fill for alternating sections, a grid, or an inverted closing
												call-to-action.
											</p>
										</div>
									</section>
								))}
							</div>
						</ReferenceSection>

						<ReferenceSection
							id="spacing"
							title="Section spacing"
							lead="Three block-padding steps only — compact, normal, hero — so pages keep a shared rhythm."
						>
							<div mix={[vstack({ gap: 3, align: "stretch" })]}>
								{SPACINGS.map((spacing) => (
									<section
										key={spacing}
										mix={[
											marketingBandTone("tinted"),
											marketingSectionSpace(spacing),
											border({ color: "neutral", width: 1 }),
										]}
									>
										<div mix={[marketingContainer()]}>
											<span
												mix={[font("mono"), text("sm"), weight("medium"), fg("neutral.emphasis")]}
											>
												marketingSectionSpace("{spacing}")
											</span>
										</div>
									</section>
								))}
							</div>
						</ReferenceSection>

						<ReferenceSection
							id="type"
							title="Display type"
							lead="displayHeading() for H1/H2, marketingLead() for the support line, marketingHairline() for rules, logoCloudMark() for adopter marks."
						>
							<section
								mix={[
									marketingBandTone("plain"),
									marketingSectionSpace("normal"),
									marketingHairline(),
									border({ color: "neutral", width: 1 }),
								]}
							>
								<div mix={[marketingContainer(), vstack({ gap: 4, align: "stretch" })]}>
									<h1 mix={[displayHeading(1)]}>Ship the landing with shared measure</h1>
									<p mix={[marketingLead()]}>
										Lead copy stays narrower than the headline, at eighteen pixels, so the claim
										reads first and the support follows.
									</p>
									<div mix={[inlineFlex(), items("center"), gap(3)]}>
										{[0, 1, 2, 3].map((index) => (
											<span
												key={String(index)}
												mix={[
													logoCloudMark(),
													inlineFlex(),
													items("center"),
													rounded("sm"),
													bg("neutral.tint"),
													border({ color: "neutral", width: 1 }),
													p(0, 3),
													font("mono"),
													text("xs"),
													tracking("wide"),
													weight("medium"),
												]}
											>
												Mark
											</span>
										))}
									</div>
								</div>
							</section>
						</ReferenceSection>
					</div>

					<ReferenceSection
						id="motion"
						title="Motion"
						lead="Landing bands reuse viewReveal() from @sdxc/ui/animations. Apply it on the band host; reduced-motion already collapses the translate. No separate marketing animation system."
					>
						<Snippet
							code={`import { viewReveal } from "@sdxc/ui/animations";
import { marketingBandTone, marketingSectionSpace } from "@sdxc/ui/styles";

<section mix={[marketingBandTone("grid"), marketingSectionSpace(), viewReveal()]}>
	{/* … */}
</section>`}
							language="tsx"
						/>
					</ReferenceSection>

					<ReferenceSection
						id="notes"
						title="Notes"
						lead="Defaults pick 72rem for measure (uptime's 1152px column). Override to 76rem where a wider frame already ships. CTA radius is soft-rect by default; set 9999px for pills."
					>
						<p mix={[m(0), text("sm"), fg("neutral")]}>
							Factories live under <code>@sdxc/ui/styles</code>. The listbox <code>Section</code>{" "}
							component remains for menus; landing pages compose <code>MarketingSection</code> and
							the other marketing primitives documented under Marketing components.
						</p>
					</ReferenceSection>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, adsDayTag());
}
