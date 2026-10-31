/**
 * The shell every help page composes into: the public site's header and footer around the
 * shared docs layout, with the help tree on the left opened at the page being read, the
 * page's own headings on the right, and type set for reading.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { TableOfContents } from "@sdxc/ui";
import type { Handle, RemixNode } from "remix/component";

import { LifeBuoyIcon, TableIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { DocsNav } from "@sdxc/ui";
import { DocsLayout as Shell } from "@sdxc/ui/patterns";

import { SUPPORT_EMAIL } from "~/config/support";
import { docHref, docsTree } from "~/resources/docs/registry";
import MarketingLayout from "~/resources/layouts/marketing";

/** The public site header's height, which the sticky docs chrome and jumped-to headings sit below. */
const HEADER_HEIGHT = "4rem";

namespace DocsLayout {
	export interface Props {
		t: Translate;
		isSignedIn: boolean;
		/** The path being read, which marks one link in the tree as current. */
		activePath: string;
		/** The page's own headings; a page with fewer than two draws no rail. */
		toc?: TableOfContents.Item[];
		children: RemixNode;
	}
}

/** Renders the site chrome, the help tree and the page between them. */
export default function DocsLayout(handle: Handle<DocsLayout.Props>) {
	return () => {
		let { activePath, children, isSignedIn, t, toc = [] } = handle.props;

		return (
			<MarketingLayout t={t} isSignedIn={isSignedIn}>
				<Shell
					main={false}
					dock="md"
					stickyTop={HEADER_HEIGHT}
					sidebar={
						<DocsNav
							tree={docsTree(t("docs.nav.label"))}
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
				<a href={`mailto:${SUPPORT_EMAIL}`} mix={link}>
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
 * Long-reading type for a help page's body: 16px at a relaxed line height, headings clearly
 * larger with room above, tables that scroll inside their own box, and links that read as
 * links. Scoped to direct prose so the scenes and shared blocks keep their own styles.
 */
function docsProse() {
	return [
		raw({ fontSize: "1rem", lineHeight: "1.7", color: "var(--ui-neutral-fg)" }),
		when(
			"& > :where(p, ul, ol, table, figure, aside, [data-slot='steps'], [data-slot='docs-faq'])",
			raw({ marginBlock: "0 1.25rem" }),
		),
		when(
			"& :where(h2[data-slot='anchor-heading'])",
			raw({
				marginBlock: "2.75rem 1rem",
				fontSize: "1.5rem",
				lineHeight: "1.25",
				fontWeight: "600",
				letterSpacing: "-0.01em",
				color: "var(--ui-neutral-fg-emphasis)",
				textWrap: "balance",
			}),
		),
		when("& :where(ul, ol):not([data-slot])", raw({ paddingInlineStart: "1.25rem" })),
		when("& :where(li) + :where(li)", raw({ marginBlockStart: "0.375rem" })),
		when(
			"& :where(p, li, td) a",
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
