/**
 * `GET /api/ui/docs-components` — every `@sdxc/ui/docs` component filed by the job it does
 * on a page, each group opening on live previews of its main pieces and listing every
 * member with a link to its own catalogue page.
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
import { DOCS_COMPONENTS_SUMMARY, DOCS_COMPONENTS_TITLE } from "~/app/services/catalogue-markdown";
import { CATALOGUE_SOURCE_BASE, DOCS_COMPONENTS_SLUG } from "~/app/services/catalogue-pages";
import { absoluteUrl } from "~/config/constants";
import DemoLinks from "~/resources/components/demo-links";
import { isFeedbackSent } from "~/resources/components/docs-feedback-block";
import { CODE_LABELS } from "~/resources/components/docs-labels";
import PageActions from "~/resources/components/page-actions";
import ReferenceSection from "~/resources/components/reference-section";
import RuledGrid, { RuledCell } from "~/resources/components/ruled-grid";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import { demoDocsLinks } from "~/resources/views/demo-docs";
import routes from "~/routes/web";

/** One docs component as its group lists it: its catalogue slug, its name and its job. */
interface Member {
	slug: string;
	name: string;
	line: string;
}

/** One job on a docs page, the components that do it, and which of them open live. */
interface Group {
	id: string;
	title: string;
	lead: string;
	/** Slugs whose catalogue preview the group draws live, in order. */
	previews: string[];
	members: Member[];
}

/** Every docs component, filed by the part of a page it builds. */
const DOCS_COMPONENT_GROUPS: Group[] = [
	{
		id: "shell",
		title: "Shell and navigation",
		lead: "The frame every page sits in: the sidebar, the heading rail, the hub a reader starts from and the 404 that still searches.",
		previews: ["docs-nav", "table-of-contents"],
		members: [
			{
				slug: "docs-layout",
				name: "DocsLayout",
				line: "Sidebar, article, heading rail and phone drawer",
			},
			{ slug: "docs-nav", name: "DocsNav", line: "The sidebar drawn from a DocsTree" },
			{
				slug: "docs-nav-tools",
				name: "DocsNavTools",
				line: "Opens the sidebar at the current page, filters it",
			},
			{
				slug: "table-of-contents",
				name: "TableOfContents",
				line: "On this page, with a marker that follows",
			},
			{ slug: "docs-hub", name: "DocsHub", line: "The docs home, routing a reader by task" },
			{
				slug: "docs-not-found",
				name: "DocsNotFound",
				line: "A 404 inside the shell that searches for you",
			},
			{
				slug: "docs-footer",
				name: "DocsFooter",
				line: "The compact footer over the article and rail",
			},
		],
	},
	{
		id: "furniture",
		title: "Page furniture",
		lead: "The same skeleton on every page: the header with its actions, headings a reader can link to, and the way out at the bottom.",
		previews: ["docs-page-header", "next-steps"],
		members: [
			{
				slug: "docs-page-header",
				name: "DocsPageHeader",
				line: "Breadcrumb, title, lead, plan and updated date",
			},
			{
				slug: "page-actions",
				name: "PageActions",
				line: "Copy page as Markdown, open it in an assistant",
			},
			{ slug: "anchor-heading", name: "AnchorHeading", line: "A heading with its own # link" },
			{ slug: "next-steps", name: "NextSteps", line: "Two to four hand-picked places to go next" },
			{ slug: "docs-pager", name: "DocsPager", line: "Previous and next, each a whole-card link" },
			{ slug: "docs-feedback", name: "DocsFeedback", line: "Was this helpful? as a plain form" },
		],
	},
	{
		id: "content",
		title: "Content blocks",
		lead: "One block for each job inside the prose: a sequence, an aside, a layout, a set of options, a control in the product.",
		previews: ["steps", "callout"],
		members: [
			{ slug: "steps", name: "Steps", line: "A numbered procedure whose titles are headings" },
			{ slug: "callout", name: "Callout", line: "A note, tip, warning or danger, used rarely" },
			{ slug: "file-tree", name: "FileTree", line: "A project layout that folds without script" },
			{
				slug: "props-table",
				name: "PropsTable",
				line: "Props, options or fields, nested ones expanding",
			},
			{
				slug: "ui-label",
				name: "UiLabel / UiPath",
				line: "A control's name, and the path of clicks to it",
			},
			{ slug: "plan-notice", name: "PlanNotice", line: "Which plan or role a feature needs" },
		],
	},
	{
		id: "code",
		title: "Code",
		lead: "Code that names its file, copies without the prompt, and stays on the reader's package manager across the site.",
		previews: ["code-block", "code-tabs"],
		members: [
			{
				slug: "code-block",
				name: "CodeBlock",
				line: "Titled code with marked lines and a copy button",
			},
			{ slug: "code-tabs", name: "CodeTabs", line: "Tabs over code mirroring a reader's choice" },
			{
				slug: "code-tabs-sync",
				name: "CodeTabsSync",
				line: "Keeps every tab set on the same choice",
			},
			{ slug: "copy-button", name: "CopyButton", line: "The copy button a code block carries" },
			{
				slug: "install-command",
				name: "InstallCommand",
				line: "Install lines in every package manager",
			},
		],
	},
];

/** The islands a browser entry maps for the docs components, which the usage section prints. */
const ISLANDS_CODE = `const PACKAGE_MODULES: Record<string, () => Promise<unknown>> = {
	"@sdxc/ui/docs/code-tabs-sync": () => import("@sdxc/ui/docs/code-tabs-sync"),
	"@sdxc/ui/docs/copy-button": () => import("@sdxc/ui/docs/copy-button"),
	"@sdxc/ui/dialog-dismiss": () => import("@sdxc/ui/dialog-dismiss"),
	"@sdxc/ui/docs/docs-nav-tools": () => import("@sdxc/ui/docs/docs-nav-tools"),
	"@sdxc/ui/docs/page-actions": () => import("@sdxc/ui/docs/page-actions"),
	"@sdxc/ui/docs/table-of-contents": () => import("@sdxc/ui/docs/table-of-contents"),
};

run({
	async loadModule(moduleUrl, exportName) {
		let load = PACKAGE_MODULES[moduleUrl];
		let mod = load ? await load() : await import(moduleUrl);
		return Reflect.get(mod as object, exportName);
	},
});`;

/**
 * Renders the docs components overview page.
 *
 * @param ctx - The request being answered.
 * @param tree - The `@sdxc/ui` tree, so the shell around the page still navigates.
 * @returns The rendered page, with the cache policy every generated page carries.
 */
export default async function docsComponentsPage(ctx: AppContext, tree: NavTree) {
	let markdownHref = routes.markdown.component.href({ component: DOCS_COMPONENTS_SLUG });
	let activePath = routes.api.component.href({ component: DOCS_COMPONENTS_SLUG });

	let anchors: Anchor[] = [
		{ id: "demos", text: "Demo docs", level: 2 },
		...DOCS_COMPONENT_GROUPS.map((group) => ({ id: group.id, text: group.title, level: 2 })),
		{ id: "islands", text: "Islands", level: 2 },
	];

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${DOCS_COMPONENTS_TITLE} — @sdxc/ui`}
			description={DOCS_COMPONENTS_SUMMARY}
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
								{ label: DOCS_COMPONENTS_TITLE },
							]}
							title={DOCS_COMPONENTS_TITLE}
							description={
								<>
									Every component <code>@sdxc/ui/docs</code> exports, by the part of the page it
									builds. They read the{" "}
									<a href={routes.api.component.href({ component: "docs-foundations" })}>
										Docs foundations
									</a>
									, and compose into the pages on{" "}
									<a href={routes.api.component.href({ component: "docs-patterns" })}>
										Docs patterns
									</a>
									. Every string is a prop; the library ships no copy.
								</>
							}
							actions={
								<PageActions
									markdownHref={markdownHref}
									markdownUrl={absoluteUrl(markdownHref)}
									sourceUrl={`${CATALOGUE_SOURCE_BASE}ui/src/docs/index.ts`}
								/>
							}
						/>
					</header>

					<ReferenceSection
						id="demos"
						title="Demo docs"
						lead="Four docs sites built only from these components, each a different kind of docs with its own product, palette and type. They open in a new tab."
					>
						<DemoLinks links={await demoDocsLinks()} />
					</ReferenceSection>

					{DOCS_COMPONENT_GROUPS.map((group) => (
						<ReferenceSection key={group.id} id={group.id} title={group.title} lead={group.lead}>
							{group.previews.map((component) => (
								<div key={component}>
									<Frame src={routes.frames.preview.href({ component })} />
								</div>
							))}
							<RuledGrid min="15rem">
								{group.members.map((member) => (
									<RuledCell
										key={member.slug}
										href={routes.api.component.href({ component: member.slug })}
										name={member.name}
										description={member.line}
									/>
								))}
							</RuledGrid>
						</ReferenceSection>
					))}

					<ReferenceSection
						id="islands"
						title="Islands"
						lead="Five docs components hydrate, plus the general DialogDismiss the phone drawer closes with; everything else is server HTML. Map their modules in the browser entry so each loads only on a page that draws it."
					>
						<CodeBlock
							labels={CODE_LABELS}
							code={ISLANDS_CODE}
							language="ts"
							title="bootstrap/browser.ts"
						/>
					</ReferenceSection>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, adsDayTag());
}
