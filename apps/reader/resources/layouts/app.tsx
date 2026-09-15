/**
 * The chrome every signed-in page wears: the app's name, the navigation whose current
 * link is marked with `aria-current`, the way out, and the column the page's own content
 * sits in. It exists so each page describes only what it shows.
 *
 * Copy arrives already translated, so the layout renders text without reaching for a
 * dictionary and a controller stays the one place a key is named.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, borderEdge, fg, translucent } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import {
	flex,
	flexWrap,
	gap,
	grow,
	inlineFlex,
	insBs,
	items,
	sticky,
	vstack,
} from "@sdxc/u/layout";
import { maxIs, mi, minBs, minIs, mis, p, pb, pi } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { hover, when } from "@sdxc/u/state";
import { overflowWrap, text, textDecoration, weight } from "@sdxc/u/typography";
import { Heading, LinkButton, NavLink } from "@sdxc/ui";

import DocumentLayout from "~/resources/layouts/document";
import OutboundMark from "~/resources/views/outbound-mark";
import routes from "~/routes/web";

/**
 * Width of the column the page reads in. The header's own row takes it too, so the first
 * navigation link starts on the same vertical line as the page heading below it.
 */
const PAGE_COLUMN = "48rem";

/** Gutter that column keeps from the viewport edge, shared for the same reason. */
const PAGE_GUTTER = 6;

export namespace AppLayout {
	/** Which navigation link is the page being rendered. */
	export type Page = "reading" | "feeds" | "settings";

	/** Where a heading points when the thing it names lives outside the app. */
	export interface HeadingLink {
		href: string;
		/**
		 * What following the heading does, since the heading's own words name the thing and
		 * not the trip. It reaches a screen reader beside the heading text and a pointer
		 * through the tooltip `title` gives.
		 */
		label: string;
	}

	/** The navigation's copy, translated by the controller that renders the page. */
	export interface Nav {
		/** Accessible name for the navigation itself. */
		label: string;
		reading: string;
		feeds: string;
		settings: string;
		logout: string;
	}

	export interface Props {
		/** Text for the `<title>` element. */
		documentTitle: string;
		/** The page's own heading, shown above its content. */
		heading: string;
		/** Where the heading leads, for a page whose subject has a home of its own. */
		headingLink?: HeadingLink;
		/**
		 * Controls acting on what the heading names, laid out in a row at the end of its
		 * line. They wrap to a line of their own, still at the end, when the heading wants
		 * the width.
		 */
		headingActions?: RemixNode;
		/** Which navigation link this page is, so exactly one is marked current. */
		current: Page;
		/** The request's detected language, set as `<html lang>`. */
		locale?: string;
		nav: Nav;
		children: RemixNode;
	}
}

/**
 * One navigation tab. The filled pill sits on top of the library's own `aria-current`
 * styling, which is a foreground-color change alone and reads as muted against the
 * header's tinted panel in a dark scheme.
 */
function AppNavLink(handle: Handle<{ href: string; label: string; isCurrent: boolean }>) {
	return () => {
		let { href, label, isCurrent } = handle.props;

		return (
			<NavLink
				href={href}
				hasBackground
				aria-current={isCurrent ? "page" : undefined}
				mix={[
					pi(3),
					pb(2),
					rounded("md"),
					when('&[aria-current="page"]', [bg("brand.tint"), fg("brand.emphasis")]),
				]}
			>
				{label}
			</NavLink>
		);
	};
}

/** Renders the header, navigation and page column around a signed-in page's content. */
export default function AppLayout(handle: Handle<AppLayout.Props>) {
	return () => {
		let { children, current, documentTitle, heading, headingActions, headingLink, locale, nav } =
			handle.props;

		return (
			<DocumentLayout title={documentTitle} locale={locale}>
				{/** The band spans the viewport so its rule does; the row inside it holds the column. */}
				<header
					mix={[
						sticky(),
						insBs(0),
						z(10),
						translucent(),
						bg("neutral.tint"),
						borderEdge("block-end", { color: "neutral.border", width: 1 }),
					]}
				>
					<div
						mix={[
							mi("auto"),
							maxIs(PAGE_COLUMN),
							minBs("4rem"),
							pi(PAGE_GUTTER),
							pb(2),
							flex(),
							items("center"),
							flexWrap("wrap"),
							gap(2),
						]}
					>
						<nav aria-label={nav.label} mix={[flex(), items("center"), flexWrap("wrap"), gap(1)]}>
							<AppNavLink
								href={routes.reading.href()}
								label={nav.reading}
								isCurrent={current === "reading"}
							/>
							<AppNavLink
								href={routes.feeds.index.href()}
								label={nav.feeds}
								isCurrent={current === "feeds"}
							/>
							<AppNavLink
								href={routes.settings.index.href()}
								label={nav.settings}
								isCurrent={current === "settings"}
							/>
						</nav>

						<span aria-hidden="true" mix={[grow()]} />

						<LinkButton href={routes.logout.index.href()} color="neutral" variant="ghost" size="sm">
							{nav.logout}
						</LinkButton>
					</div>
				</header>

				<main mix={[vstack({ gap: 6 }), mi("auto"), maxIs(PAGE_COLUMN), p(PAGE_GUTTER)]}>
					{/**
					 * The heading takes the line and whatever acts on it sits at the far end of the
					 * same one. A title long enough to want the width pushes the controls onto a line
					 * of their own rather than into them.
					 */}
					<div mix={[flex(), items("center"), flexWrap("wrap"), gap(3)]}>
						{/**
						 * The heading itself is what carries the page's subject off to its own site, so
						 * the obvious words on the page are the ones worth clicking. It keeps the
						 * heading's own color, so it reads as the page's title rather than as a link.
						 */}
						<Heading
							level={1}
							mix={[grow(), minIs(0), overflowWrap("anywhere"), text("xl"), weight("semibold")]}
						>
							{headingLink ? (
								<a
									href={headingLink.href}
									target="_blank"
									rel="noopener noreferrer"
									title={headingLink.label}
									mix={[
										inlineFlex(),
										items("center"),
										gap(2),
										fg("neutral.emphasis"),
										textDecoration("none"),
										hover(textDecoration("underline")),
									]}
								>
									{heading}
									<span mix={[visuallyHidden()]}>{headingLink.label}</span>
									<OutboundMark />
								</a>
							) : (
								heading
							)}
						</Heading>

						{headingActions && (
							<div mix={[flex(), items("center"), flexWrap("wrap"), gap(2), mis("auto")]}>
								{headingActions}
							</div>
						)}
					</div>

					{children}
				</main>
			</DocumentLayout>
		);
	};
}
