/**
 * `GET /api/ui/:component` — one component's reference, and the theming page that shares
 * the segment with the catalogue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { CodeBlock, DocsPageHeader } from "@sdxc/ui";
import { Frame } from "remix/component";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { Anchor } from "~/app/services/article";
import type { PropsTable } from "~/app/services/components";

import { withBundleCache } from "~/app/http/caching";
import notFound from "~/app/http/controllers/docs-not-found";
import landingPatternsPage from "~/app/http/controllers/ui-landing-patterns";
import marketingComponentsPage from "~/app/http/controllers/ui-marketing-components";
import marketingFoundationsPage from "~/app/http/controllers/ui-marketing-foundations";
import themingPage from "~/app/http/controllers/ui-theming";
import { adsDayTag } from "~/app/services/ads";
import {
	LANDING_PATTERNS_SLUG,
	MARKETING_COMPONENTS_SLUG,
	MARKETING_FOUNDATIONS_SLUG,
	THEMING_SLUG,
	CATALOGUE_SOURCE_BASE,
} from "~/app/services/catalogue-pages";
import { importPath, readComponent } from "~/app/services/components";
import { toHeadline } from "~/app/services/headline";
import { buildComponentsNav } from "~/app/services/navigation";
import { absoluteUrl } from "~/config/constants";
import CompositionTree from "~/resources/components/composition-tree";
import { isFeedbackSent } from "~/resources/components/docs-feedback-block";
import { CODE_LABELS } from "~/resources/components/docs-labels";
import PageActions from "~/resources/components/page-actions";
import { findPreview, listExamples } from "~/resources/components/preview-registry.server";
import PropsReference from "~/resources/components/props-reference";
import ReferenceProse from "~/resources/components/reference-prose";
import ReferenceSection from "~/resources/components/reference-section";
import ReferenceTable from "~/resources/components/reference-table";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The install line every component page carries: `@sdxc/ui` brings the components, `remix` renders them. */
const INSTALL = `npm add @sdxc/ui remix`;

/** The stylesheet an app imports once, which every component reads its colors from. */
const THEME_IMPORT = `import "@sdxc/ui/theme.css";`;

/** The guide to owning a copy of a component, which `sdxc ui add` starts. */
const COPY_GUIDE_SLUG = "sdxc/copy-ui-components";

export default createAction(routes.api.component, async (ctx) => {
	let { component } = s.parse(s.object({ component: s.string() }), ctx.params);
	let tree = await buildComponentsNav();

	if (component === THEMING_SLUG) return await themingPage(ctx, tree);
	if (component === MARKETING_FOUNDATIONS_SLUG) return await marketingFoundationsPage(ctx, tree);
	if (component === MARKETING_COMPONENTS_SLUG) return await marketingComponentsPage(ctx, tree);
	if (component === LANDING_PATTERNS_SLUG) return await landingPatternsPage(ctx, tree);

	let reference = await readComponent(component);
	if (reference === null) return notFound(ctx, tree);

	let markdownHref = routes.markdown.component.href({ component });
	let preview = findPreview(component);
	let liveExamples = listExamples(component);
	let examples = liveExamples.length > 0 ? [] : reference.examples.slice(preview === null ? 0 : 1);
	let hasExamples = liveExamples.length > 0 || examples.length > 0;

	let anchors: Anchor[] = [
		{ id: "installation", text: "Installation", level: 2 },
		{ id: "usage", text: "Usage", level: 2 },
		reference.parts.length > 0 ? { id: "composition", text: "Composition", level: 2 } : null,
		hasExamples ? { id: "examples", text: "Examples", level: 2 } : null,
		{ id: "props", text: "Props", level: 2 },
		...reference.parts.map((part) => ({ id: anchorFor(part.name), text: part.name, level: 3 })),
	].filter((anchor): anchor is Anchor => anchor !== null);
	let activePath = routes.api.component.href({ component });

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${reference.name} — @sdxc/ui`}
			description={reference.summary}
			canonical={ctx.url.href}
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
								{ label: reference.name },
							]}
							title={reference.name}
							description={<ReferenceProse>{toHeadline(reference.summary)}</ReferenceProse>}
							actions={
								<PageActions
									markdownHref={markdownHref}
									markdownUrl={absoluteUrl(markdownHref)}
									sourceUrl={`${CATALOGUE_SOURCE_BASE}ui/src/${reference.module}/${component}.tsx`}
								/>
							}
						/>
					</header>

					{preview ? <Frame src={routes.frames.preview.href({ component })} /> : null}

					<ReferenceSection
						id="installation"
						title="Installation"
						lead="An ordinary dependency: install it, import the theme once, and import the component where it is used."
					>
						<div mix={[vstack({ gap: 3, align: "stretch" })]}>
							<CodeBlock labels={CODE_LABELS} code={INSTALL} language="bash" title="Terminal" />
							<CodeBlock labels={CODE_LABELS} code={THEME_IMPORT} language="typescript" />
							<p mix={[m(0), text("base"), fg("neutral")]}>
								Or{" "}
								<a href={routes.docs.show.href({ slug: COPY_GUIDE_SLUG })}>
									copy it into your project
								</a>{" "}
								to edit it:
							</p>
							<CodeBlock
								labels={CODE_LABELS}
								code={`sdxc ui add ${component}`}
								language="bash"
								title="Terminal"
							/>
						</div>
					</ReferenceSection>

					<ReferenceSection id="usage" title="Usage">
						<div mix={[vstack({ gap: 3, align: "stretch" })]}>
							<CodeBlock
								labels={CODE_LABELS}
								code={`import { ${reference.name} } from "${importPath(reference.module)}";`}
								language="typescript"
							/>
							<p mix={[m(0), text("base"), fg("neutral")]}>
								<ReferenceProse>{reference.description}</ReferenceProse>
							</p>
						</div>
					</ReferenceSection>

					{reference.parts.length > 0 ? (
						<ReferenceSection
							id="composition"
							title="Composition"
							lead="The parts the component publishes, each a static property of the host."
						>
							<CompositionTree host={reference.name} parts={reference.parts} />
						</ReferenceSection>
					) : null}

					{hasExamples ? (
						<ReferenceSection id="examples" title="Examples">
							<div mix={[vstack({ gap: 4, align: "stretch" })]}>
								{liveExamples.map((example) => (
									<section key={example.slug} mix={[vstack({ gap: 3, align: "stretch" })]}>
										<h3 mix={[m(0), text("base"), weight("semibold")]}>{example.title}</h3>
										<Frame src={routes.frames.example.href({ component, example: example.slug })} />
									</section>
								))}
								{examples.map((example) => (
									<CodeBlock language="tsx" labels={CODE_LABELS} key={example} code={example} />
								))}
							</div>
						</ReferenceSection>
					) : null}

					<ReferenceSection
						id="props"
						title="Props"
						lead="Read from the component's own types, so every prop, every default and every allowed value is listed."
					>
						<div mix={[vstack({ gap: 6, align: "stretch" })]}>
							{propsBlock(reference.name, reference.props)}

							{reference.parts.map((part) => (
								<section key={part.name} mix={[vstack({ gap: 3, align: "stretch" })]}>
									<h3
										id={anchorFor(part.name)}
										mix={[m(0), font("mono"), text("base"), weight("semibold")]}
									>
										{part.name}
									</h3>
									{propsBlock(part.name, part.props)}
								</section>
							))}
						</div>
					</ReferenceSection>

					{reference.types.length > 0 ? (
						<ReferenceSection id="types" title="Types">
							<ReferenceTable
								label={`${reference.name} types`}
								columns={["Name", "Values", "What it decides"]}
								rows={reference.types.map((type) => [
									<code mix={[font("mono"), text("sm"), fg("neutral.emphasis")]}>{type.name}</code>,
									<code mix={[font("mono"), text("sm"), fg("neutral")]}>
										{type.values.join(" | ")}
									</code>,
									<span mix={[text("sm"), fg("neutral")]}>
										<ReferenceProse>{type.description}</ReferenceProse>
									</span>,
								])}
							/>
						</ReferenceSection>
					) : null}

					{reference.related.length > 0 ? (
						<ReferenceSection
							id="related"
							title="Also exported"
							lead="Other components this module publishes."
						>
							<ul mix={[m(0)]}>
								{reference.related.map((entry) => (
									<li key={entry.name} mix={[text("sm")]}>
										<code mix={[font("mono")]}>{entry.name}</code>
									</li>
								))}
							</ul>
						</ReferenceSection>
					) : null}
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, adsDayTag());
});

/** The fragment a part's own props are linked by. */
function anchorFor(name: string): string {
	return `props-${name.replace(/\./g, "-").toLowerCase()}`;
}

/**
 * One prop interface as the page prints it. An interface declaring nothing of its own
 * still says something worth reading — that it is the host element's whole attribute
 * surface — so the inherited line stands in for the table rather than beside nothing.
 */
function propsBlock(owner: string, props: PropsTable) {
	return (
		<div mix={[vstack({ gap: 2, align: "stretch" })]}>
			{props.rows.length > 0 ? (
				<PropsReference label={`${owner} props`} nameLabel="Prop" rows={props.rows} />
			) : null}

			{props.inherits.map((inherited) => (
				<p key={inherited} mix={[m(0), text("sm"), fg("neutral")]}>
					Also accepts everything in <code mix={[font("mono")]}>{inherited}</code>.
				</p>
			))}
		</div>
	);
}
