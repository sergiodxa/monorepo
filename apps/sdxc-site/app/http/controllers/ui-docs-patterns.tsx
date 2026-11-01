/**
 * `GET /api/ui/docs-patterns` — the `@sdxc/ui/docs` components composed into the five pages
 * a docs site is made of: the shell, the hub, a reference page, a task page and the 404,
 * each sketched in code and linked to the demo docs pages that ship it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { CodeBlock, DocsPageHeader } from "@sdxc/ui/docs";
import { Frame } from "remix/component";

import type { AppContext } from "~/app/initializers/router";
import type { Anchor } from "~/app/services/article";
import type { NavTree } from "~/app/services/navigation";

import { withBundleCache } from "~/app/http/caching";
import { adsDayTag } from "~/app/services/ads";
import { DOCS_PATTERNS_SUMMARY, DOCS_PATTERNS_TITLE } from "~/app/services/catalogue-markdown";
import { CATALOGUE_SOURCE_BASE, DOCS_PATTERNS_SLUG } from "~/app/services/catalogue-pages";
import { absoluteUrl } from "~/config/constants";
import DemoLinks from "~/resources/components/demo-links";
import { isFeedbackSent } from "~/resources/components/docs-feedback-block";
import { CODE_LABELS } from "~/resources/components/docs-labels";
import PageActions from "~/resources/components/page-actions";
import ReferenceSection from "~/resources/components/reference-section";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import { demoDocsHref, demoDocsLinks } from "~/resources/views/demo-docs";
import routes from "~/routes/web";

/** One demo docs page a pattern links to, as its card names it. */
interface Example {
	site: string;
	page?: string;
	eyebrow: string;
	title: string;
	description: string;
}

/** One page a docs site is made of: what it is for, how it composes, and where it ships. */
interface Pattern {
	id: string;
	title: string;
	lead: string;
	/** The catalogue preview drawn live above the sketch, when one shows the whole pattern. */
	preview?: string;
	code: string;
	examples: Example[];
}

/** The five patterns, in the order a reader meets them on a site. */
const PATTERNS: Pattern[] = [
	{
		id: "shell",
		title: "Layout shell",
		lead: "Every page sits in one DocsLayout: the DocsNav sidebar docked from the header to the viewport's foot, the article at a reading measure, its headings in the rail, and DocsFooter across the article and rail. On a phone the sidebar becomes a drawer and the headings a sticky bar.",
		preview: "docs-layout",
		code: `<DocsLayout
	header={<SiteHeader />}
	stickyTop="3.5rem"
	sidebar={
		<>
			<DocsNav tree={tree} activePath={url.pathname} />
			<DocsNavTools />
		</>
	}
	toc={page.toc}
	tocLabel="On this page"
	menuLabel="Menu"
	drawerLabel="Documentation"
	closeLabel="Close menu"
	footer={
		<DocsFooter links={footerLinks} legal={legal}>
			<DocsFeedback page={url.pathname} action="/docs/feedback" labels={feedbackLabels} />
		</DocsFooter>
	}
>
	{article}
</DocsLayout>`,
		examples: [
			{
				site: "driftwood",
				page: "guides/custom-domains",
				eyebrow: "Content docs",
				title: "Driftwood: Custom domains",
				description:
					"A guide in the shell, with the sidebar open at its section and a rail beside it.",
			},
			{
				site: "lattice",
				page: "getting-started/theming",
				eyebrow: "Component docs",
				title: "Lattice: Theming",
				description: "The same shell under a different palette and type.",
			},
		],
	},
	{
		id: "hub",
		title: "Hub",
		lead: "The docs home routes by task before a reader types: a search, topic chips for the common questions, a larger Start here path, the sections as cards with their page counts, and the articles read most.",
		preview: "docs-hub",
		code: `<DocsHub
	eyebrow="Docs"
	title="Deploy anything to the edge"
	lead="Ship a site in a minute, then add domains, previews and environments."
	search={<SearchTrigger />}
	start={[{ eyebrow: "Quickstart", title: "Deploy your first site", href, description, cta }]}
	sections={tree.sections.map(toHubSection)}
	popular={mostRead}
	labels={labels}
	formatCount={(count) => \`\${count} pages\`}
/>`,
		examples: [
			{
				site: "driftwood",
				eyebrow: "Content docs",
				title: "Driftwood Docs",
				description: "A hub for a hosting product: quickstart first, then guides and concepts.",
			},
			{
				site: "parcelo",
				eyebrow: "API reference",
				title: "Parcelo Docs",
				description: "A hub for an API, starting from authentication and the first request.",
			},
		],
	},
	{
		id: "reference",
		title: "Reference page",
		lead: "A reference page answers one lookup: a header naming the thing in mono, a sentence on what it does, a usage block, then the options in a PropsTable and examples with their results. It is read in pieces, so every heading is an AnchorHeading.",
		code: `<DocsPageHeader
	crumbs={[{ label: "Shipments", href: "/docs/shipments" }, { label: "Create" }]}
	title="POST /v1/shipments"
	mono
	description="Creates a shipment and buys its label in one request."
	updated={{ label: "Updated", date: "2026-10-12" }}
	actions={<PageActions markdownHref={markdownHref} labels={actionLabels} />}
/>
<CodeTabs tabs={requestSamples} syncKey="language" persist="cookie" selected={language} />
<AnchorHeading id="body" level={2}>Body</AnchorHeading>
<PropsTable rows={bodyFields} labels={propsLabels} aria-label="Request body" />
<AnchorHeading id="response" level={2}>Response</AnchorHeading>
<CodeBlock title="200 OK" language="json" code={response} labels={codeLabels} />
<DocsPager previous={previous} next={next} labels={pagerLabels} />`,
		examples: [
			{
				site: "parcelo",
				page: "shipments/create",
				eyebrow: "API reference",
				title: "Parcelo: Create a shipment",
				description: "An endpoint: request in the reader's language, body fields, response.",
			},
			{
				site: "lattice",
				page: "components/button",
				eyebrow: "Component docs",
				title: "Lattice: Button",
				description: "A component: a preview, its install line and its props.",
			},
		],
	},
	{
		id: "task",
		title: "Task page",
		lead: "A task page is titled as the task and answers in its first sentence. A PlanNotice says who can do it, Steps walk the sequence with copyable code, a Callout marks the one thing not to miss, and NextSteps hands the reader on.",
		code: `<DocsPageHeader
	crumbs={[{ label: "Guides", href: "/docs/guides" }, { label: "Custom domains" }]}
	title="Add a custom domain"
	description="Point your domain at Driftwood and get a certificate in about a minute."
	notice={<PlanNotice>Available on the Pro plan for project owners.</PlanNotice>}
/>
<Steps>
	<Steps.Item title="Add the domain">
		<p>Open <UiPath items={["Project", "Settings", "Domains"]} /> and enter the hostname.</p>
	</Steps.Item>
	<Steps.Item title="Create the DNS record">
		<CodeBlock title="Terminal" language="sh" code={dnsCommand} labels={codeLabels} />
	</Steps.Item>
</Steps>
<Callout kind="warning" label="Warning">Remove the old record before you verify.</Callout>
<NextSteps title="Next steps" id="next-steps" items={next} />`,
		examples: [
			{
				site: "driftwood",
				page: "start/quickstart",
				eyebrow: "Content docs",
				title: "Driftwood: Quickstart",
				description: "A tutorial: a first deploy in four steps, with what each one prints.",
			},
			{
				site: "driftwood",
				page: "guides/custom-domains",
				eyebrow: "Content docs",
				title: "Driftwood: Custom domains",
				description: "A how-to with a plan notice, UI paths, steps and next steps.",
			},
		],
	},
	{
		id: "not-found",
		title: "404",
		lead: "A missing page stays inside the shell so the sidebar still navigates. DocsNotFound names the address that matched nothing, runs the search with the words from it, and offers the pages a lost reader most often wanted.",
		preview: "docs-not-found",
		code: `<DocsNotFound
	path={url.pathname}
	search={<SearchField defaultValue={searchQueryFromPath(url.pathname)} />}
	links={[{ title: "Quickstart", href: "/docs/start/quickstart" }]}
	labels={{ title: "This page moved or never existed", body, linksTitle: "Try one of these" }}
/>`,
		examples: [
			{
				site: "driftwood",
				page: "guides/time-travel",
				eyebrow: "Content docs",
				title: "Driftwood: a page that is not there",
				description: "The 404 inside the shell, searching for the words in the address.",
			},
		],
	},
];

/**
 * Renders the docs patterns overview page.
 *
 * @param ctx - The request being answered.
 * @param tree - The `@sdxc/ui` tree, so the shell around the page still navigates.
 * @returns The rendered page, with the cache policy every generated page carries.
 */
export default async function docsPatternsPage(ctx: AppContext, tree: NavTree) {
	let markdownHref = routes.markdown.component.href({ component: DOCS_PATTERNS_SLUG });
	let activePath = routes.api.component.href({ component: DOCS_PATTERNS_SLUG });

	let anchors: Anchor[] = [
		{ id: "demos", text: "Demo docs", level: 2 },
		...PATTERNS.map((pattern) => ({ id: pattern.id, text: pattern.title, level: 2 })),
	];

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${DOCS_PATTERNS_TITLE} — @sdxc/ui`}
			description={DOCS_PATTERNS_SUMMARY}
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
								{ label: DOCS_PATTERNS_TITLE },
							]}
							title={DOCS_PATTERNS_TITLE}
							description={
								<>
									A docs site is five kinds of page. Each is sketched below from the{" "}
									<a href={routes.api.component.href({ component: "docs-components" })}>
										Docs components
									</a>{" "}
									and linked to the demo docs pages that ship it, so you can judge it finished.
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
						id="demos"
						title="Demo docs"
						lead="The patterns assembled into four complete docs sites: content, components, utilities and an API reference. They open in a new tab."
					>
						<DemoLinks links={await demoDocsLinks()} />
					</ReferenceSection>

					{PATTERNS.map((pattern) => (
						<ReferenceSection
							key={pattern.id}
							id={pattern.id}
							title={pattern.title}
							lead={pattern.lead}
						>
							{pattern.preview ? (
								<Frame src={routes.frames.preview.href({ component: pattern.preview })} />
							) : null}
							<CodeBlock labels={CODE_LABELS} code={pattern.code} language="tsx" />
							<DemoLinks
								links={pattern.examples.map((example) => ({
									href: demoDocsHref(example.site)(example.page),
									eyebrow: example.eyebrow,
									title: example.title,
									description: example.description,
								}))}
							/>
						</ReferenceSection>
					))}
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, adsDayTag());
}
