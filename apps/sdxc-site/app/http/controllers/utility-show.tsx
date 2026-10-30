/**
 * `GET /api/u/:utility` — one utility's reference. The quick-reference table is the
 * paired `@example` tags, each live example is a frame drawn from its own module with the
 * code cut from that module's source, and the theme section is the scales the utility
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, nowrap, text, weight } from "@sdxc/u/typography";
import { Frame } from "remix/component";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { Anchor } from "~/app/services/article";

import { withBundleCache } from "~/app/http/caching";
import notFound from "~/app/http/controllers/docs-not-found";
import { adsDayTag } from "~/app/services/ads";
import { CATALOGUE_SOURCE_BASE } from "~/app/services/catalogue-pages";
import { buildUtilitiesNav } from "~/app/services/navigation";
import { findUtility, readUtility } from "~/app/services/utilities";
import {
	atWidth,
	customValue,
	onState,
	RESPONSIVE_FAMILY,
	STATE_FAMILY,
} from "~/app/services/utility-calls";
import { listUtilityExamples } from "~/app/services/utility-examples";
import { themeScales } from "~/app/services/utility-theme";
import { absoluteUrl } from "~/config/constants";
import PageActions from "~/resources/components/page-actions";
import PageTitle from "~/resources/components/page-title";
import ReferenceProse from "~/resources/components/reference-prose";
import ReferenceSection from "~/resources/components/reference-section";
import ReferenceTable from "~/resources/components/reference-table";
import Snippet from "~/resources/components/snippet";
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
	let live = await listUtilityExamples(utility);
	let scales = themeScales(reference);
	let custom = customValue(reference);

	let anchors: Anchor[] = [
		table.length > 0 ? { id: "quick-reference", text: "Quick reference", level: 2 } : null,
		live.length > 0 || snippets.length > 0 ? { id: "examples", text: "Examples", level: 2 } : null,
		...live.map((example) => ({ id: `example-${example.slug}`, text: example.title, level: 3 })),
		custom === null ? null : { id: "custom-value", text: "Using a custom value", level: 2 },
		reference.family === STATE_FAMILY
			? null
			: { id: "states", text: "Applying on a state", level: 2 },
		reference.family === RESPONSIVE_FAMILY
			? null
			: { id: "responsive", text: "Responsive design", level: 2 },
		scales.length > 0 ? { id: "theme", text: "Customizing your theme", level: 2 } : null,
		...scales.map((scale) => ({ id: scale.id, text: scale.title, level: 3 })),
	].filter((anchor): anchor is Anchor => anchor !== null);

	let activePath = routes.api.utility.href({ utility });

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${reference.property} — @sdxc/u`}
			description={reference.summary}
			canonical={ctx.url.href}
		>
			<DocsLayout
				tree={tree}
				activePath={activePath}
				breadcrumbs={[
					{ label: "API", href: routes.api.index.href() },
					{ label: "@sdxc/u", href: routes.api.show.href({ name: "u" }) },
					{ label: reference.property },
				]}
				anchors={anchors}
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

					{live.length > 0 || snippets.length > 0 ? (
						<ReferenceSection id="examples" title="Examples">
							<div mix={[vstack({ gap: 10, align: "stretch" })]}>
								{live.map((example) => (
									<section key={example.slug} mix={[vstack({ gap: 3, align: "stretch" })]}>
										<h3
											id={`example-${example.slug}`}
											mix={[m(0), fg("neutral.emphasis"), text("lg"), weight("semibold")]}
										>
											{example.title}
										</h3>
										<p mix={[m(0), text("base"), fg("neutral")]}>
											<ReferenceProse>{example.description}</ReferenceProse>
										</p>
										<Frame src={routes.frames.utility.href({ utility, example: example.slug })} />
									</section>
								))}
								{snippets.map((example) => (
									<Snippet key={example.call} code={example.call} language="typescript" />
								))}
							</div>
						</ReferenceSection>
					) : null}

					{custom === null ? null : (
						<ReferenceSection
							id="custom-value"
							title="Using a custom value"
							lead="Every scale argument also takes a raw CSS value, which passes through untouched."
						>
							<Snippet code={custom} language="typescript" />
						</ReferenceSection>
					)}

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

					{scales.length > 0 ? (
						<ReferenceSection id="theme" title="Customizing your theme">
							<div mix={[vstack({ gap: 10, align: "stretch" })]}>
								{scales.map((scale) => (
									<section key={scale.id} mix={[vstack({ gap: 3, align: "stretch" })]}>
										<h3
											id={scale.id}
											mix={[m(0), fg("neutral.emphasis"), text("lg"), weight("semibold")]}
										>
											{scale.title}
										</h3>
										<p mix={[m(0), text("base"), fg("neutral")]}>
											<ReferenceProse>{scale.lead}</ReferenceProse>
										</p>
										<Snippet code={scale.css} language="css" />
										{scale.declaration === null ? null : (
											<Snippet code={scale.declaration} language="typescript" />
										)}
										<p mix={[m(0), text("base"), fg("neutral")]}>
											<ReferenceProse>{scale.usageLead}</ReferenceProse>
										</p>
										<Snippet code={scale.usage} language="typescript" />
									</section>
								))}
							</div>
						</ReferenceSection>
					) : null}

					<ReferenceSection id="signature" title="Signature">
						<Snippet code={reference.signature} language="typescript" />
					</ReferenceSection>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, adsDayTag());
});
