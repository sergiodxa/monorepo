/**
 * `GET /api/u/:utility` — one utility's reference. Every block on the page
 * is read from the module it documents: the quick-reference table is the paired
 * `@example` tags, the theme section is the variables the implementation reads, and
 * the link out is the `@see` the author wrote. Nothing here can disagree with the
 * utility, because there is nothing here the utility did not say.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, nowrap, text } from "@sdxc/u/typography";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { Anchor } from "~/app/services/article";

import { withBundleCache } from "~/app/http/caching";
import notFound from "~/app/http/controllers/docs-not-found";
import { CATALOGUE_SOURCE_BASE } from "~/app/services/catalogue-pages";
import { buildUtilitiesNav } from "~/app/services/navigation";
import { absoluteUrl } from "~/app/services/site";
import { findUtility, readUtility } from "~/app/services/utilities";
import {
	atWidth,
	customValue,
	onState,
	RESPONSIVE_FAMILY,
	STATE_FAMILY,
} from "~/app/services/utility-calls";
import PageActions from "~/resources/components/page-actions";
import PageTitle from "~/resources/components/page-title";
import ReferenceProse from "~/resources/components/reference-prose";
import ReferenceSection from "~/resources/components/reference-section";
import ReferenceTable from "~/resources/components/reference-table";
import Snippet from "~/resources/components/snippet";
import { TableOfContents } from "~/resources/components/table-of-contents";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

export default createAction(routes.api.utility, async (ctx) => {
	let { utility } = s.parse(s.object({ utility: s.string() }), ctx.params);
	let tree = await buildUtilitiesNav();

	let reference = await readUtility(utility);
	let entry = await findUtility(utility);
	if (reference === null || entry === null) return notFound(ctx, tree);

	let markdownHref = routes.markdown.utility.href({ utility });

	let table = reference.examples.filter((example) => example.output !== null);
	let snippets = reference.examples.filter((example) => example.output === null);

	let anchors: Anchor[] = [
		table.length > 0 ? { id: "quick-reference", text: "Quick reference", level: 2 } : null,
		snippets.length > 0 ? { id: "examples", text: "Examples", level: 2 } : null,
		{ id: "custom-value", text: "Using a custom value", level: 2 },
		reference.family === STATE_FAMILY
			? null
			: { id: "states", text: "Applying on a state", level: 2 },
		reference.family === RESPONSIVE_FAMILY
			? null
			: { id: "responsive", text: "Responsive design", level: 2 },
		reference.tokens.length > 0 ? { id: "theme", text: "Customizing the theme", level: 2 } : null,
	].filter((anchor): anchor is Anchor => anchor !== null);

	let response = await ctx.render(
		<DocumentLayout
			title={`${reference.property} — @sdxc/u`}
			description={reference.summary}
			canonical={ctx.url.href}
		>
			<DocsLayout
				tree={tree}
				activePath={routes.api.utility.href({ utility })}
				breadcrumbs={[
					{ label: "API", href: routes.api.index.href() },
					{ label: "@sdxc/u", href: routes.api.show.href({ name: "u" }) },
					{ label: reference.property },
				]}
				aside={<TableOfContents anchors={anchors} />}
			>
				<article mix={[vstack({ gap: 10, align: "stretch" })]}>
					<header mix={[vstack({ gap: 4, align: "stretch" })]}>
						<PageTitle eyebrow={`@sdxc/u/${reference.family}`} title={reference.property}>
							<ReferenceProse>{reference.summary}</ReferenceProse>
						</PageTitle>

						{reference.see.map((link) => (
							<a key={link.href} href={link.href} mix={[m(0), text("sm"), fg("brand")]}>
								{link.label}
							</a>
						))}

						<PageActions
							markdownHref={markdownHref}
							markdownUrl={absoluteUrl(markdownHref)}
							sourceUrl={`${CATALOGUE_SOURCE_BASE}u/src/${entry.family}/${entry.module}.ts`}
						/>

						<Snippet code={`import { ${reference.name} } from "@sdxc/u/${reference.family}";`} />
					</header>

					{table.length > 0 ? (
						<ReferenceSection
							id="quick-reference"
							title="Quick reference"
							lead="Every documented call, beside the CSS it emits."
						>
							<ReferenceTable
								label={`${reference.name} quick reference`}
								columns={["Call", "CSS"]}
								rows={table.map((example) => [
									<code mix={[font("mono"), text("sm"), fg("neutral.emphasis"), nowrap()]}>
										{example.call}
									</code>,
									<code mix={[font("mono"), text("sm"), fg("neutral")]}>{example.output}</code>,
								])}
							/>
						</ReferenceSection>
					) : null}

					{snippets.length > 0 ? (
						<ReferenceSection
							id="examples"
							title="Examples"
							lead="Calls that compose other mixins rather than emitting declarations of their own."
						>
							<div mix={[vstack({ gap: 4, align: "stretch" })]}>
								{snippets.map((example) => (
									<Snippet key={example.call} code={example.call} language="typescript" />
								))}
							</div>
						</ReferenceSection>
					) : null}

					<ReferenceSection
						id="custom-value"
						title="Using a custom value"
						lead="Every scale argument also takes a raw CSS value, which passes through untouched."
					>
						<Snippet code={customValue(reference)} language="typescript" />
					</ReferenceSection>

					{reference.family === STATE_FAMILY ? null : (
						<ReferenceSection
							id="states"
							title="Applying on a state"
							lead="Wrap the call in a state utility to scope it to one selector."
						>
							<Snippet code={onState(reference)} language="typescript" />
						</ReferenceSection>
					)}

					{reference.family === RESPONSIVE_FAMILY ? null : (
						<ReferenceSection
							id="responsive"
							title="Responsive design"
							lead="Wrap the call in a container query to scope it to one width."
						>
							<Snippet code={atWidth(reference)} language="typescript" />
						</ReferenceSection>
					)}

					{reference.tokens.length > 0 ? (
						<ReferenceSection
							id="theme"
							title="Customizing the theme"
							lead="The custom properties this utility reads, which a theme redefines."
						>
							<ReferenceTable
								label={`${reference.name} theme variables`}
								columns={["Variable"]}
								rows={reference.tokens.map((token) => [
									<code mix={[font("mono"), text("sm"), fg("neutral.emphasis"), nowrap()]}>
										{token}
									</code>,
								])}
							/>
						</ReferenceSection>
					) : null}

					<ReferenceSection id="signature" title="Signature">
						<Snippet code={reference.signature} language="typescript" />
					</ReferenceSection>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response);
});
