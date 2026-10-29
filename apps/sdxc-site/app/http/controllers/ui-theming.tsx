/**
 * `GET /api/ui/theming` — the theme contract: every `--ui-*` variable, what it
 * controls, and which components read it, then the two schemes over the same names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, nowrap, text, tracking, weight } from "@sdxc/u/typography";

import type { AppContext } from "~/app/initializers/router";
import type { Anchor } from "~/app/services/article";
import type { NavTree } from "~/app/services/navigation";
import type { ThemeDeclaration } from "~/app/services/theming";

import { withBundleCache } from "~/app/http/caching";
import { adsDayTag } from "~/app/services/ads";
import { THEMING_SUMMARY, THEMING_TITLE } from "~/app/services/catalogue-markdown";
import { THEMING_SLUG, CATALOGUE_SOURCE_BASE } from "~/app/services/catalogue-pages";
import { readTheme } from "~/app/services/theming";
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

/**
 * Renders the theming page.
 *
 * @param ctx - The request being answered.
 * @param tree - The `@sdxc/ui` tree, so the shell around the page still navigates.
 * @returns The rendered page, with the cache policy every generated page carries.
 */
export default async function themingPage(ctx: AppContext, tree: NavTree) {
	let theme = await readTheme();
	let markdownHref = routes.markdown.component.href({ component: THEMING_SLUG });

	let anchors: Anchor[] = [
		{ id: "roles", text: "Semantic roles", level: 2 },
		...theme.groups.map((group) => ({ id: anchorFor(group.title), text: group.title, level: 3 })),
		{ id: "light", text: "Light", level: 2 },
		{ id: "dark", text: "Dark", level: 2 },
	];

	let activePath = routes.api.component.href({ component: THEMING_SLUG });

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${THEMING_TITLE} — @sdxc/ui`}
			description={THEMING_SUMMARY}
			canonical={ctx.url.href}
		>
			<DocsLayout
				tree={tree}
				activePath={activePath}
				breadcrumbs={[
					{ label: "API", href: routes.api.index.href() },
					{ label: "@sdxc/ui", href: routes.api.show.href({ name: "ui" }) },
					{ label: THEMING_TITLE },
				]}
				aside={
					hasDocsAside(anchors) ? <DocsAside anchors={anchors} path={activePath} /> : undefined
				}
			>
				<article mix={[vstack({ gap: 10, align: "stretch" })]}>
					<header mix={[vstack({ gap: 4, align: "stretch" })]}>
						<PageTitle eyebrow="@sdxc/ui" title={THEMING_TITLE}>
							Every color a component draws comes from a variable, and every variable belongs to a
							role. Redefine the variables and the whole catalogue moves with them.
						</PageTitle>
						<PageActions
							markdownHref={markdownHref}
							markdownUrl={absoluteUrl(markdownHref)}
							sourceUrl={`${CATALOGUE_SOURCE_BASE}ui/src/theme.css`}
						/>
					</header>

					<ReferenceSection
						id="roles"
						title="Semantic roles"
						lead="A component picks a role — brand, neutral, success, warning, danger — and the role resolves to a fill, the text on that fill, a border and a focus ring. That pairing is the convention: a component never names a color, only the part of a role it needs."
					>
						<div mix={[vstack({ gap: 8, align: "stretch" })]}>
							{theme.groups.map((group) => (
								<section key={group.title} mix={[vstack({ gap: 3, align: "stretch" })]}>
									<h3
										id={anchorFor(group.title)}
										mix={[m(0), text("base"), weight("semibold"), tracking("tight")]}
									>
										{group.title}
									</h3>
									<p mix={[m(0), text("sm"), fg("neutral")]}>{group.description}</p>

									<ReferenceTable
										label={`${group.title} variables`}
										columns={["Token", "What it controls", "Components that read it"]}
										rows={group.tokens.map((token) => [
											<code mix={[font("mono"), text("sm"), fg("neutral.emphasis"), nowrap()]}>
												{token.name}
											</code>,
											<span mix={[text("sm"), fg("neutral")]}>{token.controls}</span>,
											<span mix={[text("sm"), fg("neutral")]}>
												{token.components.length > 0 ? token.components.join(", ") : "—"}
											</span>,
										])}
									/>
								</section>
							))}
						</div>
					</ReferenceSection>

					<ReferenceSection
						id="light"
						title="Light"
						lead="What a document resolves to with no scheme class on it."
					>
						<Snippet code={block(":root", theme.light)} language="css" />
					</ReferenceSection>

					<ReferenceSection
						id="dark"
						title="Dark"
						lead="The same names, redefined under a dark ancestor. Add `.dark` to force it, or `.system` to follow the reader's own setting."
					>
						<Snippet code={block(":is(.dark, .dark *)", theme.dark)} language="css" />
					</ReferenceSection>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, adsDayTag());
}

/** The fragment one band of the contract is linked by. */
function anchorFor(title: string): string {
	return `tokens-${title.replace(/\s+/g, "-")}`;
}

/** One scheme printed back as the rule that declares it. */
function block(selector: string, declarations: ThemeDeclaration[]): string {
	let body = declarations
		.map((declaration) => `\t${declaration.name}: ${declaration.value};`)
		.join("\n");

	return `${selector} {\n${body}\n}`;
}
