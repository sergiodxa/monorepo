/**
 * `GET /api/ui/docs-foundations` — what every `@sdxc/ui/docs` page stands on: the shell's
 * measures, the tokens a jump and a line of prose read, the reading type, the mixins that
 * finish the islands, and the tree helpers, with a live sample of the type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { font, nowrap, text } from "@sdxc/u/typography";
import { Typeset } from "@sdxc/ui";
import { Callout, CodeBlock, DocsPageHeader } from "@sdxc/ui/docs";

import type { AppContext } from "~/app/initializers/router";
import type { Anchor } from "~/app/services/article";
import type { NavTree } from "~/app/services/navigation";

import { withBundleCache } from "~/app/http/caching";
import { adsDayTag } from "~/app/services/ads";
import {
	DOCS_FOUNDATIONS_SUMMARY,
	DOCS_FOUNDATIONS_TITLE,
} from "~/app/services/catalogue-markdown";
import { CATALOGUE_SOURCE_BASE, DOCS_FOUNDATIONS_SLUG } from "~/app/services/catalogue-pages";
import { absoluteUrl } from "~/config/constants";
import { isFeedbackSent } from "~/resources/components/docs-feedback-block";
import { CODE_LABELS } from "~/resources/components/docs-labels";
import PageActions from "~/resources/components/page-actions";
import ReferenceSection from "~/resources/components/reference-section";
import ReferenceTable from "~/resources/components/reference-table";
import RuledGrid, { RuledCell } from "~/resources/components/ruled-grid";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The `DocsLayout` props that size the shell, with their defaults and what each one bounds. */
const MEASURES = [
	["measure", "64rem", "Widest the article column grows; code, tables and images fill it"],
	["proseMeasure", "66ch", "Widest line of running text, so paragraphs stay at 60–75 characters"],
	["maxWidth", "88rem", "Widest the three columns together grow"],
	["dock", '"lg"', "Width the sidebar docks from (md 48rem, lg 64rem); narrower, it is a drawer"],
	["stickyTop", '"0px"', "Height of the site header above the shell, which sticky columns clear"],
	["tocMinItems", "2", "Fewest headings that draw the rail; fewer draw no list at all"],
] as const;

/** The custom properties the docs components set and read, with who sets each one. */
const TOKENS = [
	[
		"--ui-docs-prose-measure",
		"Set by DocsLayout from proseMeasure; paragraphs, lists, headings and callouts stop at it",
	],
	[
		"--ui-docs-scroll-margin",
		"Set by DocsLayout from stickyTop and the sticky bar; every jumped-to heading clears it (5rem outside the shell)",
	],
	["--ui-typeset-size", "Body size Typeset sets text from; the docs preset writes 1.125rem (18px)"],
	["--ui-typeset-leading", "Line height of running text; the docs preset writes 1.75"],
	["--ui-typeset-flow", "Space between blocks of prose; the docs preset writes 1.25em"],
] as const;

/** The mixins `@sdxc/ui/docs` exports, each finishing one island, keyed by its page's slug. */
const MIXINS = [
	["toc-spy", "tocSpy", "Slides the rail's marker to every section in view and marks the last"],
	["docs-nav-tools", "docsNavTools", "Opens the sidebar at the current page and filters it"],
	["code-tabs-sync", "codeTabsSync", "Keeps every tab set sharing a key on the reader's choice"],
	["copy-from-url", "copyFromUrl", "Copies a page's Markdown twin, fetched on the first click"],
	["copy-feedback", "copyFeedback", "Swaps a copy button's icon and label for a moment"],
] as const;

/** The sample sidebar the tree section prints. */
const TREE_CODE = `import type { DocsTree } from "@sdxc/ui/docs";
import { findNeighbours, flattenDocsTree } from "@sdxc/ui/docs";

let tree: DocsTree = {
	label: "Documentation",
	sections: [
		{
			title: "Get started",
			items: [
				{ title: "Quickstart", href: "/docs/quickstart" },
				{ title: "Install the CLI", href: "/docs/cli" },
			],
		},
	],
};

let pages = flattenDocsTree(tree); // every page, in reading order
let { previous, next } = findNeighbours(tree, "/docs/cli"); // what DocsPager links`;

/**
 * Renders the docs foundations page.
 *
 * @param ctx - The request being answered.
 * @param tree - The `@sdxc/ui` tree, so the shell around the page still navigates.
 * @returns The rendered page, with the cache policy every generated page carries.
 */
export default async function docsFoundationsPage(ctx: AppContext, tree: NavTree) {
	let markdownHref = routes.markdown.component.href({ component: DOCS_FOUNDATIONS_SLUG });
	let activePath = routes.api.component.href({ component: DOCS_FOUNDATIONS_SLUG });

	let anchors: Anchor[] = [
		{ id: "measures", text: "Shell measures", level: 2 },
		{ id: "tokens", text: "Tokens", level: 2 },
		{ id: "type", text: "Reading type", level: 2 },
		{ id: "mixins", text: "Mixins", level: 2 },
		{ id: "tree", text: "The docs tree", level: 2 },
		{ id: "motion", text: "Motion", level: 2 },
	];

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${DOCS_FOUNDATIONS_TITLE} — @sdxc/ui`}
			description={DOCS_FOUNDATIONS_SUMMARY}
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
								{ label: DOCS_FOUNDATIONS_TITLE },
							]}
							title={DOCS_FOUNDATIONS_TITLE}
							description={
								<>
									The measures, tokens and type a docs page reads, and the mixins that finish its
									islands in the browser. The pieces built on them are on{" "}
									<a href={routes.api.component.href({ component: "docs-components" })}>
										Docs components
									</a>
									, and whole pages on{" "}
									<a href={routes.api.component.href({ component: "docs-patterns" })}>
										Docs patterns
									</a>
									.
								</>
							}
							actions={
								<PageActions
									markdownHref={markdownHref}
									markdownUrl={absoluteUrl(markdownHref)}
									sourceUrl={`${CATALOGUE_SOURCE_BASE}ui/src/docs/docs-layout.tsx`}
								/>
							}
						/>
					</header>

					<ReferenceSection
						id="measures"
						title="Shell measures"
						lead="DocsLayout sizes the page from a handful of props. The defaults keep prose at a readable line and give code and tables the wider column."
					>
						<ReferenceTable
							label="DocsLayout measures"
							columns={["Prop", "Default", "What it bounds"]}
							rows={MEASURES.map(([name, value, bounds]) => [
								<code mix={[font("mono"), text("sm"), fg("neutral.emphasis"), nowrap()]}>
									{name}
								</code>,
								<code mix={[font("mono"), text("sm"), fg("neutral"), nowrap()]}>{value}</code>,
								<span mix={[text("sm"), fg("neutral")]}>{bounds}</span>,
							])}
						/>
						<CodeBlock
							labels={CODE_LABELS}
							code={`<DocsLayout
	sidebar={<DocsNav tree={tree} activePath={url.pathname} />}
	toc={headings}
	stickyTop="3.5rem"
	proseMeasure="70ch"
	tocLabel="On this page"
	menuLabel="Menu"
	drawerLabel="Documentation"
	closeLabel="Close menu"
>
	{article}
</DocsLayout>`}
							language="tsx"
						/>
					</ReferenceSection>

					<ReferenceSection
						id="tokens"
						title="Tokens"
						lead="Custom properties the docs components set and read. Set them through DocsLayout's props or Typeset's preset; override one on a single block where it needs a different value."
					>
						<ReferenceTable
							label="Docs tokens"
							columns={["Token", "What it controls"]}
							rows={TOKENS.map(([name, controls]) => [
								<code mix={[font("mono"), text("sm"), fg("neutral.emphasis"), nowrap()]}>
									{name}
								</code>,
								<span mix={[text("sm"), fg("neutral")]}>{controls}</span>,
							])}
						/>
					</ReferenceSection>

					<ReferenceSection
						id="type"
						title="Reading type"
						lead='Typeset preset="docs" sets rendered prose at 18px on a 1.75 line, with every block 1.25em apart. A component drawn inside it opts out with data-not-typeset on its own elements.'
					>
						<Typeset
							preset="docs"
							mix={[
								p(6),
								rounded("lg"),
								border({ color: "neutral.border", width: 1, style: "solid" }),
							]}
						>
							<h3>Add your first monitor</h3>
							<p>
								Paste the address you want watched. Checks start within a minute, from six regions,
								and an alert only fires when <strong>two of them agree</strong>.
							</p>
							<ul>
								<li>
									Run <code>beacon monitors add</code> from the CLI
								</li>
								<li>Or open Monitors → New monitor in the dashboard</li>
							</ul>
							<Callout kind="tip" label="Tip" title="Start with your health check">
								A path that touches the database catches more than the home page does.
							</Callout>
						</Typeset>
						<CodeBlock
							labels={CODE_LABELS}
							code={`<Typeset preset="docs">{renderedMarkdown}</Typeset>`}
							language="tsx"
						/>
					</ReferenceSection>

					<ReferenceSection
						id="mixins"
						title="Mixins"
						lead="Each island loads its mixin in the browser, so the server markup works on its own and the mixin only adds what needs script. Use them directly when a custom component needs the same behavior."
					>
						<RuledGrid min="16rem">
							{MIXINS.map(([slug, name, line]) => (
								<RuledCell
									key={slug}
									href={routes.api.uiExport.href({ subpath: "mixins", slug })}
									name={name}
									description={line}
								/>
							))}
						</RuledGrid>
					</ReferenceSection>

					<ReferenceSection
						id="tree"
						title="The docs tree"
						lead="One DocsTree feeds the sidebar, the pager and search, so a page added to the tree is listed, linked and found in one edit."
					>
						<CodeBlock labels={CODE_LABELS} code={TREE_CODE} language="tsx" />
					</ReferenceSection>

					<ReferenceSection
						id="motion"
						title="Motion"
						lead="Motion marks a change of state only: the rail's marker sliding, a drawer opening, a tab switching, a copy confirming. Each runs 150–300ms with an ease-out and stops under reduced motion."
					>
						<p mix={[m(0), text("sm"), fg("neutral")]}>
							Pages scroll at the reader's pace: headings, cards and blocks appear without an entry
							animation.
						</p>
					</ReferenceSection>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, adsDayTag());
}
