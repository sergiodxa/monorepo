/**
 * `GET /api/ui/<namespace>-foundations` — the intro each `@sdxc/ui` namespace's sidebar group
 * opens with: what the namespace solves and when to reach for it, the ideas its components
 * share, and every CSS variable it reads or declares.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { font, leading, nowrap, text, weight } from "@sdxc/u/typography";
import { Typeset } from "@sdxc/ui";
import { CodeBlock, DocsPageHeader } from "@sdxc/ui/docs";

import type { AppContext } from "~/app/initializers/router";
import type { Anchor } from "~/app/services/article";
import type { NavTree } from "~/app/services/navigation";
import type { Foundations } from "~/resources/content/foundations";

import { withBundleCache } from "~/app/http/caching";
import { adsDayTag } from "~/app/services/ads";
import { CATALOGUE_SOURCE_BASE, THEMING_SLUG } from "~/app/services/catalogue-pages";
import { absoluteUrl } from "~/config/constants";
import { isFeedbackSent } from "~/resources/components/docs-feedback-block";
import { CODE_LABELS } from "~/resources/components/docs-labels";
import PageActions from "~/resources/components/page-actions";
import ReferenceSection from "~/resources/components/reference-section";
import ReferenceTable from "~/resources/components/reference-table";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The namespaces whose demos the gallery lists, so their intro points readers at them. */
const DEMOED_MODULES = new Set<Foundations["module"]>(["landing", "docs", "app"]);

/**
 * Renders one namespace's Foundations page.
 *
 * @param ctx - The request being answered.
 * @param tree - The `@sdxc/ui` tree, so the shell around the page still navigates.
 * @param foundations - The namespace the page introduces.
 * @returns The rendered page, with the cache policy every generated page carries.
 */
export default async function foundationsPage(
	ctx: AppContext,
	tree: NavTree,
	foundations: Foundations,
) {
	let markdownHref = routes.markdown.component.href({ component: foundations.slug });
	let activePath = routes.api.component.href({ component: foundations.slug });

	let anchors: Anchor[] = [
		{ id: "when", text: "When to reach for it", level: 2 },
		{ id: "ideas", text: "Shared ideas", level: 2 },
		{ id: "variables", text: "CSS variables", level: 2 },
		...foundations.variables.map((group) => ({
			id: variablesAnchor(group.title),
			text: group.title,
			level: 3,
		})),
	];

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${foundations.title} — @sdxc/ui`}
			description={foundations.summary}
			canonical={ctx.url.href}
			siteFooter={false}
		>
			<DocsLayout
				tree={tree}
				activePath={activePath}
				anchors={anchors}
				feedback={{ sent: isFeedbackSent(ctx.url) }}
			>
				<article mix={[vstack({ gap: 10, align: "stretch" })]}>
					<header mix={[vstack({ gap: 4, align: "stretch" })]}>
						<DocsPageHeader
							crumbs={[
								{ label: "API", href: routes.api.index.href() },
								{ label: "@sdxc/ui", href: routes.api.show.href({ name: "ui" }) },
								{ label: foundations.title },
							]}
							title={foundations.title}
							description={foundations.summary}
							actions={
								<PageActions
									markdownHref={markdownHref}
									markdownUrl={absoluteUrl(markdownHref)}
									sourceUrl={`${CATALOGUE_SOURCE_BASE}${foundations.source}`}
								/>
							}
						/>
					</header>

					<Typeset preset="docs">
						{foundations.intro.map((paragraph) => (
							<p key={paragraph}>{paragraph}</p>
						))}
						{DEMOED_MODULES.has(foundations.module) ? (
							<p>
								See the components assembled into whole sites in the{" "}
								<a href={routes.demos.href()}>demo gallery</a>.
							</p>
						) : null}
					</Typeset>

					<CodeBlock
						labels={CODE_LABELS}
						code={`import "@sdxc/ui/theme.css";\nimport { … } from "${foundations.importPath}";`}
						language="typescript"
					/>

					<ReferenceSection id="when" title="When to reach for it">
						<Typeset preset="docs">
							<ul>
								{foundations.reachFor.map((line) => (
									<li key={line}>
										<InlineCode text={line} />
									</li>
								))}
							</ul>
						</Typeset>
					</ReferenceSection>

					<ReferenceSection id="ideas" title="Shared ideas">
						<ul
							mix={[
								m(0),
								p(0),
								raw({ listStyle: "none" }),
								grid(),
								gap(4),
								gridTemplate({ columns: "repeat(auto-fill, minmax(min(100%, 16rem), 1fr))" }),
							]}
						>
							{foundations.ideas.map((idea) => (
								<li
									key={idea.title}
									mix={[
										vstack({ gap: 1, align: "stretch" }),
										p(4),
										rounded("lg"),
										border({ color: "neutral.border", width: 1, style: "solid" }),
									]}
								>
									<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
										{idea.title}
									</span>
									<span mix={[text("sm"), leading("relaxed"), fg("neutral")]}>
										<InlineCode text={idea.body} />
									</span>
								</li>
							))}
						</ul>
					</ReferenceSection>

					<ReferenceSection
						id="variables"
						title="CSS variables"
						lead="Every custom property the namespace reads or declares, with its default and what it controls."
					>
						<p mix={[m(0), text("sm"), fg("neutral")]}>
							<InlineCode text={foundations.roles} /> The roles are documented on{" "}
							<a href={routes.api.component.href({ component: THEMING_SLUG })}>Theming</a>.
						</p>
						{foundations.variables.map((group) => (
							<section key={group.title} mix={[vstack({ gap: 3, align: "stretch" })]}>
								<h3
									id={variablesAnchor(group.title)}
									mix={[m(0), text("lg"), fg("neutral.emphasis")]}
								>
									{group.title}
								</h3>
								{group.lead ? (
									<p mix={[m(0), text("sm"), fg("neutral")]}>
										<InlineCode text={group.lead} />
									</p>
								) : null}
								<ReferenceTable
									label={`${foundations.title}: ${group.title}`}
									columns={["Variable", "Default", "What it controls"]}
									rows={group.variables.map((variable) => [
										<code mix={[font("mono"), text("sm"), fg("neutral.emphasis")]}>
											{variable.name.split(", ").map((name, index) => (
												<>
													{index > 0 ? ", " : null}
													<span mix={[nowrap()]}>{name}</span>
												</>
											))}
										</code>,
										<code
											mix={[
												font("mono"),
												text("sm"),
												fg("neutral"),
												raw({ overflowWrap: "break-word", wordBreak: "normal" }),
											]}
										>
											{variable.default}
										</code>,
										<span mix={[text("sm"), fg("neutral")]}>
											<InlineCode text={variable.controls} />
										</span>,
									])}
								/>
							</section>
						))}
					</ReferenceSection>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, adsDayTag());
}

namespace InlineCode {
	export interface Props {
		/** Prose that marks code between backticks, as the Foundations records write it. */
		text: string;
	}
}

/**
 * Draws a line of Foundations prose with every backticked span set as code, so a component,
 * prop or variable name reads as something to type.
 */
function InlineCode(handle: Handle<InlineCode.Props>) {
	return () =>
		handle.props.text.split("`").map((part, index) =>
			index % 2 === 1 ? (
				<code
					mix={[
						font("mono"),
						raw({
							fontSize: "0.875em",
							paddingInline: "0.25em",
							whiteSpace: "nowrap",
							borderRadius: "0.25rem",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{part}
				</code>
			) : (
				part
			),
		);
}

/** The id a variables group's heading takes, from its title. */
function variablesAnchor(title: string): string {
	return `variables-${title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")}`;
}
