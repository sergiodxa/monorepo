/**
 * `GET /api/ui/:subpath/:slug` — one mixin, behavior class, animation or style recipe
 * of `@sdxc/ui`. Every block is read from the module that declares it: the signature
 * from its types, the tables from its parameters and members, and below them the
 * events, constants and types the same module publishes for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text, textTransform, tracking, weight } from "@sdxc/u/typography";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { Anchor } from "~/app/services/article";
import type { PropRow } from "~/app/services/components";
import type { UiSymbol } from "~/app/services/ui-exports";

import { withBundleCache } from "~/app/http/caching";
import notFound from "~/app/http/controllers/docs-not-found";
import { sponsorsTag } from "~/app/http/middleware/sponsors";
import { toHeadline } from "~/app/services/headline";
import { buildComponentsNav } from "~/app/services/navigation";
import { absoluteUrl } from "~/app/services/site";
import { readUiExport } from "~/app/services/ui-exports";
import { UI_SOURCE_BASE } from "~/app/services/ui-pages";
import { isUiSubpath } from "~/app/services/ui-subpaths";
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

/** How a companion's kind is labelled above its name. */
const KIND_LABELS: Record<UiSymbol["kind"], string> = {
	mixin: "Mixin",
	function: "Function",
	class: "Class",
	event: "Event",
	constant: "Constant",
	interface: "Interface",
	type: "Type",
};

export default createAction(routes.api.uiExport, async (ctx) => {
	let { subpath, slug } = s.parse(s.object({ subpath: s.string(), slug: s.string() }), ctx.params);
	let tree = await buildComponentsNav();

	let reference = isUiSubpath(subpath) ? await readUiExport(subpath, slug) : null;
	if (reference === null) return notFound(ctx, tree);

	let { symbol, companions } = reference;
	let module = `@sdxc/ui/${reference.subpath}`;
	let markdownHref = routes.markdown.uiExport.href({ subpath: reference.subpath, slug });
	/** A description of one sentence is already the headline, so it is not printed twice. */
	let usage =
		symbol.description.replace(/\s+/g, " ") === reference.summary ? "" : symbol.description;

	let anchors: Anchor[] = [
		usage ? { id: "usage", text: "Usage", level: 2 } : null,
		symbol.signature ? { id: "signature", text: "Signature", level: 2 } : null,
		symbol.parameters.length > 0 ? { id: "parameters", text: "Parameters", level: 2 } : null,
		symbol.members.length > 0 ? { id: "properties", text: "Properties", level: 2 } : null,
		symbol.methods.length > 0 ? { id: "methods", text: "Methods", level: 2 } : null,
		symbol.examples.length > 0 ? { id: "examples", text: "Examples", level: 2 } : null,
		companions.length > 0 ? { id: "related", text: "Used with it", level: 2 } : null,
		...companions.map((companion) => ({
			id: anchorFor(companion.name),
			text: companion.name,
			level: 3,
		})),
	].filter((anchor): anchor is Anchor => anchor !== null);

	let response = await ctx.render(
		<DocumentLayout
			title={`${reference.name} — ${module}`}
			description={reference.summary}
			canonical={ctx.url.href}
			sponsors={ctx.sponsors}
		>
			<DocsLayout
				tree={tree}
				activePath={routes.api.uiExport.href({ subpath: reference.subpath, slug })}
				breadcrumbs={[
					{ label: "API", href: routes.api.index.href() },
					{ label: "@sdxc/ui", href: routes.api.show.href({ name: "ui" }) },
					{ label: reference.name },
				]}
				aside={<TableOfContents anchors={anchors} />}
			>
				<article mix={[vstack({ gap: 10, align: "stretch" })]}>
					<header mix={[vstack({ gap: 4, align: "stretch" })]}>
						<PageTitle eyebrow={module} title={reference.name} mono>
							<ReferenceProse>{toHeadline(reference.summary)}</ReferenceProse>
						</PageTitle>
						<PageActions
							markdownHref={markdownHref}
							markdownUrl={absoluteUrl(markdownHref)}
							sourceUrl={`${UI_SOURCE_BASE}${reference.subpath}/${reference.module}.ts`}
						/>
						<Snippet code={`import { ${importedName(symbol)} } from "${module}";`} />
					</header>

					{usage ? (
						<ReferenceSection id="usage" title="Usage">
							<p mix={[m(0), text("base"), fg("neutral")]}>
								<ReferenceProse>{usage}</ReferenceProse>
							</p>
						</ReferenceSection>
					) : null}

					{symbol.signature ? (
						<ReferenceSection id="signature" title="Signature">
							<div mix={[vstack({ gap: 3, align: "stretch" })]}>
								<Snippet code={symbol.signature} language="typescript" />
								{symbol.returns ? (
									<p mix={[m(0), text("sm"), fg("neutral")]}>
										<ReferenceProse>{`Returns ${lowerFirst(symbol.returns)}`}</ReferenceProse>
									</p>
								) : null}
							</div>
						</ReferenceSection>
					) : null}

					{symbol.parameters.length > 0 ? (
						<ReferenceSection id="parameters" title="Parameters">
							<RowTable
								label={`${symbol.name} parameters`}
								first="Parameter"
								rows={symbol.parameters}
							/>
						</ReferenceSection>
					) : null}

					{symbol.members.length > 0 ? (
						<ReferenceSection id="properties" title="Properties">
							<RowTable
								label={`${symbol.name} properties`}
								first="Property"
								rows={symbol.members}
							/>
						</ReferenceSection>
					) : null}

					{symbol.methods.length > 0 ? (
						<ReferenceSection id="methods" title="Methods">
							<MethodTable symbol={symbol} />
						</ReferenceSection>
					) : null}

					{symbol.examples.length > 0 ? (
						<ReferenceSection id="examples" title="Examples">
							<div mix={[vstack({ gap: 4, align: "stretch" })]}>
								{symbol.examples.map((example) => (
									<Snippet key={example} code={example} />
								))}
							</div>
						</ReferenceSection>
					) : null}

					{companions.length > 0 ? (
						<ReferenceSection
							id="related"
							title="Used with it"
							lead={`The events, constants and types its module publishes, each imported from ${module} too.`}
						>
							<div mix={[vstack({ gap: 8, align: "stretch" })]}>
								{companions.map((companion) => (
									<Companion key={companion.name} symbol={companion} />
								))}
							</div>
						</ReferenceSection>
					) : null}
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, sponsorsTag(ctx.sponsors));
});

/** The fragment a companion is linked by. */
function anchorFor(name: string): string {
	return `export-${name.replace(/\./g, "-").toLowerCase()}`;
}

/**
 * The name the page's import line brings in. A type nested in a namespace is reached
 * through the namespace, so the namespace is what gets imported.
 */
function importedName(symbol: UiSymbol): string {
	return symbol.name.split(".")[0] ?? symbol.name;
}

/** A `@returns` sentence continued after "Returns", keeping a leading code run as written. */
function lowerFirst(sentence: string): string {
	return /^[A-Z](?![A-Z])/.test(sentence)
		? sentence[0]?.toLowerCase() + sentence.slice(1)
		: sentence;
}

namespace RowTable {
	export interface Props {
		label: string;
		/** What the first column names: a parameter, a property, a member. */
		first: string;
		rows: PropRow[];
	}
}

/**
 * Parameters, properties or members as one table. A row typed as a union of strings
 * lists those strings, since which ones are allowed is what the type name leaves open.
 */
function RowTable(handle: Handle<RowTable.Props>) {
	return () => {
		let { first, label, rows } = handle.props;

		return (
			<ReferenceTable
				label={label}
				columns={[first, "Type", "Description"]}
				rows={rows.map((row) => [
					<code mix={[font("mono"), text("sm"), fg("neutral.emphasis")]}>
						{row.optional ? `${row.name}?` : row.name}
					</code>,
					<code mix={[font("mono"), text("sm"), fg("neutral")]}>
						{row.values.length > 0 ? row.values.join(" | ") : row.type}
					</code>,
					<span mix={[text("sm"), fg("neutral")]}>
						<ReferenceProse>{row.description}</ReferenceProse>
					</span>,
				])}
			/>
		);
	};
}

namespace MethodTable {
	export interface Props {
		symbol: UiSymbol;
	}
}

/** A class's public methods, each as the call a caller writes beside what it does. */
function MethodTable(handle: Handle<MethodTable.Props>) {
	return () => {
		let { symbol } = handle.props;

		return (
			<ReferenceTable
				label={`${symbol.name} methods`}
				columns={["Method", "Description"]}
				rows={symbol.methods.map((method) => [
					<code mix={[font("mono"), text("sm"), fg("neutral.emphasis")]}>{method.signature}</code>,
					<span mix={[text("sm"), fg("neutral")]}>
						<ReferenceProse>{method.description}</ReferenceProse>
					</span>,
				])}
			/>
		);
	};
}

namespace Companion {
	export interface Props {
		symbol: UiSymbol;
	}
}

/**
 * One export the page's subject is used with, drawn compactly under its kind: an event
 * with the fields a listener reads, a constant with its value, a type with its members.
 */
function Companion(handle: Handle<Companion.Props>) {
	return () => {
		let { symbol } = handle.props;

		return (
			<section mix={[vstack({ gap: 3, align: "stretch" })]}>
				<div mix={[vstack({ gap: 1, align: "stretch" })]}>
					<span
						mix={[
							font("mono"),
							text("xs"),
							textTransform("uppercase"),
							tracking("widest"),
							fg("neutral"),
						]}
					>
						{KIND_LABELS[symbol.kind]}
					</span>
					<h3
						id={anchorFor(symbol.name)}
						mix={[m(0), font("mono"), text("base"), weight("semibold")]}
					>
						{symbol.name}
					</h3>
				</div>

				{symbol.description ? (
					<p mix={[m(0), text("sm"), fg("neutral")]}>
						<ReferenceProse>{symbol.description}</ReferenceProse>
					</p>
				) : null}

				{symbol.signature ? <Snippet code={symbol.signature} language="typescript" /> : null}

				{symbol.parameters.length > 0 && symbol.kind !== "event" ? (
					<RowTable
						label={`${symbol.name} parameters`}
						first="Parameter"
						rows={symbol.parameters}
					/>
				) : null}

				{symbol.members.length > 0 ? (
					<RowTable
						label={`${symbol.name} ${symbol.kind === "interface" ? "members" : "properties"}`}
						first={symbol.kind === "interface" ? "Member" : "Property"}
						rows={symbol.members}
					/>
				) : null}

				{symbol.methods.length > 0 ? <MethodTable symbol={symbol} /> : null}

				{symbol.examples.map((example) => (
					<Snippet key={example} code={example} />
				))}
			</section>
		);
	};
}
