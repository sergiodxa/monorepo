/**
 * The opening of every docs page in one order: breadcrumb trail, the page's `<h1>`, its
 * lead, an optional plan or role notice, then one quiet row with the last-updated date
 * and the page actions. Every string arrives as a prop, so a localized site fills it in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { mergeMix, raw } from "@sdxc/u/general";
import { container, flex, gap, hidden, items, vstack } from "@sdxc/u/layout";
import { at, atMax } from "@sdxc/u/responsive";
import { m, minIs } from "@sdxc/u/size";
import {
	balance,
	font,
	leading,
	overflowWrap,
	pretty,
	text,
	tracking,
	weight,
} from "@sdxc/u/typography";

import { Breadcrumbs } from "../components/breadcrumbs.js";

/** Container the header measures; under 30rem the current crumb leaves the trail to the title. */
const HEADER_CONTAINER = "ui-docs-page-header";

/**
 * Prop types for {@link DocsPageHeader}.
 */
export namespace DocsPageHeader {
	/** One step of the trail; a step without `href` is a section with no page of its own. */
	export interface Crumb {
		label: string;
		href?: string;
	}

	/** When the page last changed. */
	export interface Updated {
		/** Text before the date, such as "Last updated". */
		label: string;
		/** Machine-readable date for `<time datetime>`, such as `2026-10-12`. */
		date: string;
		/** The date as the reader sees it; defaults to `date`. */
		text?: string;
	}

	/** Props accepted by {@link DocsPageHeader}. */
	export interface Props extends Omit<TagProps<"header">, "children" | "title"> {
		/** The trail from the docs root to this page; the last crumb is the page itself. */
		crumbs?: Crumb[];
		/** Name of the breadcrumb landmark, such as "Breadcrumb". */
		crumbsLabel?: string;
		title: RemixNode;
		/** Sets the title in the monospace face, for a title that is a name a reader types. */
		mono?: boolean;
		/** The lead under the title. */
		description?: RemixNode;
		updated?: Updated;
		/** Page actions for the meta row, such as `<PageActions>`. */
		actions?: RemixNode;
		/** A plan or role notice drawn under the lead. */
		notice?: RemixNode;
	}
}

/**
 * Renders the header. Long names in the title or lead break inside the column, the trail
 * wraps whole steps, and under 30rem of header width the page's own crumb hides since the title names it.
 *
 * @param handle Runtime handle carrying the header's props.
 * @returns The render function producing the header's markup.
 * @example
 * <DocsPageHeader crumbsLabel="Breadcrumb" crumbs={[{ label: "Docs", href: "/docs" }, { label: "Alerts" }]} title="Alerts" description="Page the right person." updated={{ label: "Last updated", date: "2026-10-12", text: "Oct 12, 2026" }} actions={<PageActions … />} />
 */
export function DocsPageHeader(handle: Handle<DocsPageHeader.Props>) {
	return () => {
		let {
			crumbs = [],
			crumbsLabel,
			title,
			mono = false,
			description,
			updated,
			actions,
			notice,
			mix,
			...rest
		} = handle.props;
		let hasMeta = updated !== undefined || actions !== undefined;

		return (
			<header
				{...rest}
				data-slot="docs-page-header"
				mix={mergeMix(
					[
						vstack({ gap: 3, align: "stretch" }),
						minIs(0),
						overflowWrap("break-word"),
						container(HEADER_CONTAINER),
					],
					mix,
				)}
			>
				{crumbs.length > 0 ? (
					<Breadcrumbs aria-label={crumbsLabel}>
						<Breadcrumbs.List mix={[raw({ flexWrap: "wrap", rowGap: "0.25rem" })]}>
							{crumbs.map((crumb, index) => {
								let isCurrent = index === crumbs.length - 1;
								return (
									<Breadcrumbs.Item
										key={`${index}:${crumb.label}`}
										mix={[
											raw({ whiteSpace: "nowrap" }),
											isCurrent && index > 0 ? atMax("29.9375rem", HEADER_CONTAINER, hidden()) : [],
										]}
									>
										<Breadcrumbs.Link
											href={isCurrent ? undefined : crumb.href}
											aria-current={isCurrent ? "page" : undefined}
										>
											{crumb.label}
										</Breadcrumbs.Link>
									</Breadcrumbs.Item>
								);
							})}
						</Breadcrumbs.List>
					</Breadcrumbs>
				) : null}

				<h1
					data-slot="docs-page-header-title"
					mix={[
						m(0),
						fg("neutral.emphasis"),
						weight("semibold"),
						leading(1.1),
						balance(),
						mono
							? [font("mono"), tracking("tight"), text("2xl")]
							: [tracking("-0.02em"), text("3xl")],
						at("48rem", HEADER_CONTAINER, text(mono ? "3xl" : "4xl")),
					]}
				>
					{title}
				</h1>

				{description ? (
					<p
						data-slot="docs-page-header-description"
						mix={[m(0), text("lg"), leading("relaxed"), fg("neutral"), pretty()]}
					>
						{description}
					</p>
				) : null}

				{notice ?? null}

				{hasMeta ? (
					<div
						data-slot="docs-page-header-meta"
						mix={[
							flex(),
							items("center"),
							gap(2, 4),
							raw({ flexWrap: "wrap" }),
							text("sm"),
							fg("neutral.muted"),
						]}
					>
						{updated ? (
							<p data-slot="docs-page-header-updated" mix={[m(0)]}>
								{updated.label} <time dateTime={updated.date}>{updated.text ?? updated.date}</time>
							</p>
						) : null}
						{actions ?? null}
					</div>
				) : null}
			</header>
		);
	};
}
