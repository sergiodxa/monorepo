/**
 * The shell every help page composes into: the public site's header over the shared docs
 * layout, with the help tree pinned on the left opened at the page being read, the page's
 * own headings on the right, type set for reading, and a compact footer beside the tree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle, RemixNode } from "remix/component";

import { LifeBuoyIcon, TableIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { DocsFooter, DocsLayout as Shell, DocsNav } from "@sdxc/ui/docs";

import { docHref, docsTree } from "~/resources/docs/registry";
import MarketingLayout from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** The site header: its 4rem bar and 1px rule, which the sticky docs chrome sits below. */
const HEADER_HEIGHT = "calc(4rem + 1px)";

namespace DocsLayout {
	export interface Props {
		t: Translate;
		isSignedIn: boolean;
		/** The path being read, which marks one link in the tree as current. */
		activePath: string;
		/** The page's own headings; a page with fewer than two draws no rail. */
		toc?: TableOfContents.Item[];
		/** The page's closing pieces drawn in its footer above the site links, such as feedback. */
		footer?: RemixNode;
		children: RemixNode;
	}
}

/** Renders the site chrome, the help tree and the page between them. */
export default function DocsLayout(handle: Handle<DocsLayout.Props>) {
	return () => {
		let { activePath, children, footer, isSignedIn, t, toc = [] } = handle.props;

		return (
			<MarketingLayout t={t} isSignedIn={isSignedIn} siteFooter={false}>
				<Shell
					main={false}
					dock="md"
					stickyTop={HEADER_HEIGHT}
					sidebar={
						<DocsNav
							tree={docsTree(t, t("docs.nav.label"))}
							activePath={activePath}
							filter={{
								label: t("docs.nav.filter"),
								placeholder: t("docs.nav.filterPlaceholder"),
								noResults: t("docs.nav.noResults"),
							}}
							footer={<NavFooter t={t} />}
						/>
					}
					toc={toc}
					tocLabel={t("docs.nav.toc")}
					menuLabel={t("docs.nav.menu")}
					drawerLabel={t("docs.nav.label")}
					closeLabel={t("docs.nav.close")}
					footer={
						<DocsFooter
							legal={t("landing.footer.copyright", { year: String(new Date().getFullYear()) })}
							links={[
								{ label: t("app.name"), href: routes.home.href() },
								{ label: t("docs.title"), href: routes.docs.index.href() },
								{ label: t("docs.footer.plans"), href: docHref("plans") },
								{ label: t("docs.nav.support"), href: routes.support.index.href() },
							]}
							linksLabel={t("landing.footer.label")}
						>
							{footer}
						</DocsFooter>
					}
				>
					<div data-slot="docs-prose" mix={[docsProse()]}>
						{children}
					</div>
				</Shell>
			</MarketingLayout>
		);
	};
}

/** The sidebar's foot: a person to write to, and the plan table, always one click away. */
function NavFooter(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		let link = [
			raw({
				display: "flex",
				alignItems: "center",
				gap: "0.5rem",
				padding: "0.375rem 0.625rem",
				borderRadius: "0.375rem",
				fontSize: "0.875rem",
				color: "var(--ui-neutral-fg)",
				textDecoration: "none",
			}),
			when(":hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })),
		];
		return (
			<div mix={[raw({ display: "grid", gap: "0.125rem" })]}>
				<a href={routes.support.index.href()} mix={link}>
					<LifeBuoyIcon size={16} aria-hidden="true" />
					{t("docs.nav.support")}
				</a>
				<a href={docHref("plans")} mix={link}>
					<TableIcon size={16} aria-hidden="true" />
					{t("docs.nav.plans")}
				</a>
			</div>
		);
	};
}

/**
 * Long-reading type for a help page's body: 16px at a relaxed line height, one gap between
 * every block that no component's own margin can cancel, headings clearly larger with room
 * above, and tables that scroll inside their own box. List rules reach only the page's prose.
 */
function docsProse() {
	return [
		raw({
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr)",
			rowGap: "1.25rem",
			fontSize: "1rem",
			lineHeight: "1.7",
			color: "var(--ui-neutral-fg)",
		}),
		when("& > *", raw({ marginBlock: "0" })),
		when(
			"& :where(h2[data-slot='anchor-heading'])",
			raw({
				marginBlock: "1.5rem 0",
				fontSize: "1.5rem",
				lineHeight: "1.25",
				fontWeight: "600",
				letterSpacing: "-0.01em",
				color: "var(--ui-neutral-fg-emphasis)",
				textWrap: "balance",
			}),
		),
		when("& > :where(ul, ol)", raw({ paddingInlineStart: "1.25rem" })),
		when("& > :where(ul, ol) > li + li", raw({ marginBlockStart: "0.375rem" })),
		when(
			"& :where(p, td) a, & > :where(ul, ol) > li a",
			raw({
				color: "var(--ui-brand-fg)",
				textDecorationLine: "underline",
				textUnderlineOffset: "0.2em",
				textDecorationThickness: "1px",
			}),
		),
		when(
			"& :where(p, li, td, th) code",
			raw({
				fontFamily: "var(--ui-font-mono)",
				fontSize: "0.875em",
				padding: "0.0625em 0.3em",
				borderRadius: "0.25rem",
				backgroundColor: "var(--ui-neutral-bg-tint)",
				overflowWrap: "anywhere",
			}),
		),
		when(
			"& > table, & > [data-slot='docs-scroll'] > table",
			raw({
				display: "block",
				maxInlineSize: "100%",
				overflowX: "auto",
				borderCollapse: "collapse",
				fontSize: "0.9375rem",
				lineHeight: "1.5",
			}),
		),
		when(
			"& > table :where(th, td)",
			raw({
				padding: "0.5rem 0.75rem",
				borderBlockEnd: "1px solid var(--ui-neutral-border)",
				textAlign: "start",
				verticalAlign: "top",
			}),
		),
		when(
			"& > table thead th",
			raw({ fontSize: "0.8125rem", fontWeight: "600", color: "var(--ui-neutral-fg-muted)" }),
		),
		when("& > table caption", raw({ paddingBlockEnd: "0.5rem" })),
	];
}
