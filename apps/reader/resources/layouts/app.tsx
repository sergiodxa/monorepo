/**
 * The chrome every signed-in page wears: the app's name, a navigation toolbar whose
 * current link is marked with `aria-current`, the way out, and the column the page's own
 * content sits in. It exists so each page describes only what it shows.
 *
 * Copy arrives already translated, so the layout renders text without reaching for a
 * dictionary and a controller stays the one place a key is named.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { bg, borderEdge, fg, translucent } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, flexWrap, gap, grow, insBs, items, sticky, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, maxIs, mi, p, pb, pi } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Heading, LinkButton, NavLink, Toolbar } from "@sdxc/ui";

import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Container step at which the page gains the roomier padding of a desktop window. */
const WIDE_WIDTH = "lg";

export namespace AppLayout {
	/** Which navigation link is the page being rendered. */
	export type Page = "reading" | "feeds" | "settings";

	/** The toolbar's copy, translated by the controller that renders the page. */
	export interface Nav {
		/** Accessible name for the toolbar itself. */
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
		let { children, current, documentTitle, heading, locale, nav } = handle.props;

		return (
			<DocumentLayout title={documentTitle} locale={locale}>
				<header
					mix={[
						sticky(),
						insBs(0),
						z(10),
						flex(),
						items("center"),
						flexWrap("wrap"),
						gap(2),
						bs("4rem"),
						p(0, 4),
						translucent(),
						bg("neutral.tint"),
						borderEdge("block-end", { color: "neutral.border", width: 1 }),
					]}
				>
					<Toolbar aria-label={nav.label} mix={[flex(), items("center"), flexWrap("wrap"), gap(2)]}>
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
					</Toolbar>

					<span aria-hidden="true" mix={[grow()]} />

					<LinkButton href={routes.logout.index.href()} color="neutral" variant="outline" size="sm">
						{nav.logout}
					</LinkButton>
				</header>

				<main mix={[vstack({ gap: 6 }), mi("auto"), maxIs("48rem"), p(6), at(WIDE_WIDTH, p(10))]}>
					<Heading level={1} mix={[text("xl"), weight("semibold")]}>
						{heading}
					</Heading>

					{children}
				</main>
			</DocumentLayout>
		);
	};
}
