/**
 * `GET /api/ui/:component` — one component's reference, and the theming page
 * that shares the segment with the catalogue. The hero is the component itself: these
 * render as server HTML and work before any script loads, so the preview is this page
 * importing the component rather than a sandbox pretending to be one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { isApplePlatform } from "@sdxc/user-agent/helpers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { Anchor } from "~/app/services/article";
import type { PropsTable } from "~/app/services/components";

import { withBundleCache } from "~/app/http/caching";
import notFound from "~/app/http/controllers/docs-not-found";
import themingPage from "~/app/http/controllers/ui-theming";
import { sponsorsTag } from "~/app/http/middleware/sponsors";
import { readComponent } from "~/app/services/components";
import { toHeadline } from "~/app/services/headline";
import { buildComponentsNav } from "~/app/services/navigation";
import { absoluteUrl } from "~/app/services/site";
import { THEMING_SLUG, UI_SOURCE_BASE } from "~/app/services/ui-pages";
import ComponentPreview from "~/resources/components/component-preview";
import CompositionTree from "~/resources/components/composition-tree";
import PageActions from "~/resources/components/page-actions";
import PageTitle from "~/resources/components/page-title";
import { findPreview } from "~/resources/components/preview-registry.server";
import ReferenceProse from "~/resources/components/reference-prose";
import ReferenceSection from "~/resources/components/reference-section";
import ReferenceTable from "~/resources/components/reference-table";
import Snippet from "~/resources/components/snippet";
import { TableOfContents } from "~/resources/components/table-of-contents";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The install line every component page carries, since the package is one dependency. */
const INSTALL = `npm add @sdxc/ui`;

/** The stylesheet an app imports once, which every component reads its colors from. */
const THEME_IMPORT = `import "@sdxc/ui/theme.css";`;

export default createAction(routes.api.component, async (ctx) => {
	let { component } = s.parse(s.object({ component: s.string() }), ctx.params);
	let tree = await buildComponentsNav();

	if (component === THEMING_SLUG) return await themingPage(ctx, tree);

	let reference = await readComponent(component);
	if (reference === null) return notFound(ctx, tree);

	let markdownHref = routes.markdown.component.href({ component });
	let preview = findPreview(component);
	let examples = reference.examples.slice(preview === null ? 0 : 1);

	let anchors: Anchor[] = [
		{ id: "installation", text: "Installation", level: 2 },
		{ id: "usage", text: "Usage", level: 2 },
		reference.parts.length > 0 ? { id: "composition", text: "Composition", level: 2 } : null,
		examples.length > 0 ? { id: "examples", text: "Examples", level: 2 } : null,
		{ id: "props", text: "Props", level: 2 },
		...reference.parts.map((part) => ({ id: anchorFor(part.name), text: part.name, level: 3 })),
	].filter((anchor): anchor is Anchor => anchor !== null);

	let response = await ctx.render(
		<DocumentLayout
			title={`${reference.name} — @sdxc/ui`}
			description={reference.summary}
			canonical={ctx.url.href}
			sponsors={ctx.sponsors}
		>
			<DocsLayout
				tree={tree}
				activePath={routes.api.component.href({ component })}
				breadcrumbs={[
					{ label: "API", href: routes.api.index.href() },
					{ label: "@sdxc/ui", href: routes.api.show.href({ name: "ui" }) },
					{ label: reference.name },
				]}
				aside={<TableOfContents anchors={anchors} />}
			>
				<article mix={[vstack({ gap: 10, align: "stretch" })]}>
					<header mix={[vstack({ gap: 4, align: "stretch" })]}>
						<PageTitle eyebrow="@sdxc/ui" title={reference.name}>
							<ReferenceProse>{toHeadline(reference.summary)}</ReferenceProse>
						</PageTitle>
						<PageActions
							markdownHref={markdownHref}
							markdownUrl={absoluteUrl(markdownHref)}
							sourceUrl={`${UI_SOURCE_BASE}components/${component}.tsx`}
						/>
					</header>

					{preview ? (
						<ComponentPreview code={preview.code} flush={preview.flush}>
							{preview.render({ appleKeyboard: isApplePlatform(ctx) })}
						</ComponentPreview>
					) : null}

					<ReferenceSection
						id="installation"
						title="Installation"
						lead="An ordinary dependency: install it, import the theme once, and import the component where it is used."
					>
						<div mix={[vstack({ gap: 3, align: "stretch" })]}>
							<Snippet code={INSTALL} language="bash" />
							<Snippet code={THEME_IMPORT} language="typescript" />
						</div>
					</ReferenceSection>

					<ReferenceSection id="usage" title="Usage">
						<div mix={[vstack({ gap: 3, align: "stretch" })]}>
							<Snippet
								code={`import { ${reference.name} } from "@sdxc/ui";`}
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

					{examples.length > 0 ? (
						<ReferenceSection id="examples" title="Examples">
							<div mix={[vstack({ gap: 4, align: "stretch" })]}>
								{examples.map((example) => (
									<Snippet key={example} code={example} />
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

	return await withBundleCache(ctx.request, response, sponsorsTag(ctx.sponsors));
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
				<ReferenceTable
					label={`${owner} props`}
					columns={["Prop", "Type", "Description"]}
					rows={props.rows.map((prop) => [
						<code mix={[font("mono"), text("sm"), fg("neutral.emphasis")]}>
							{prop.optional ? `${prop.name}?` : prop.name}
						</code>,
						<code mix={[font("mono"), text("sm"), fg("neutral")]}>
							{prop.values.length > 0 ? prop.values.join(" | ") : prop.type}
						</code>,
						<span mix={[text("sm"), fg("neutral")]}>
							<ReferenceProse>{prop.description}</ReferenceProse>
						</span>,
					])}
				/>
			) : null}

			{props.inherits.map((inherited) => (
				<p key={inherited} mix={[m(0), text("sm"), fg("neutral")]}>
					Also accepts everything in <code mix={[font("mono")]}>{inherited}</code>.
				</p>
			))}
		</div>
	);
}
