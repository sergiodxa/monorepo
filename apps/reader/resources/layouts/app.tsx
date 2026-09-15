/**
 * The chrome every signed-in page wears: the navigation whose current link is marked with
 * `aria-current`, the way out, and the column the page's own content sits in. It exists so
 * each page describes only what it shows.
 *
 * Copy arrives already translated, so the layout renders text without reaching for a
 * dictionary and a controller stays the one place a key is named.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { LogOutIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, borderEdge, fg, translucent } from "@sdxc/u/color";
import {
	flex,
	flexWrap,
	gap,
	grow,
	hidden,
	inline,
	inlineFlex,
	insBs,
	items,
	sticky,
	vstack,
} from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bleed, maxIs, mi, minBs, minIs, mis, p, pb, pi } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { hover } from "@sdxc/u/state";
import { overflowWrap, text, textDecoration, weight } from "@sdxc/u/typography";
import { Heading, LinkButton, NavLink } from "@sdxc/ui";

import DocumentLayout from "~/resources/layouts/document";
import OutboundMark from "~/resources/views/outbound-mark";
import routes from "~/routes/web";

/**
 * Width of the column a page of prose and fields reads in, and the width every page starts
 * from. The header's own row takes it too, so the first navigation link starts on the same
 * vertical line as the page heading below it.
 *
 * A form on a page that widens caps itself here, since a field is no easier to fill for
 * spanning a window.
 */
export const PAGE_COLUMN = "48rem";

/** Gutter that column keeps from the viewport edge, shared for the same reason. */
const PAGE_GUTTER = 6;

/**
 * The widths a page of rows climbs through, each taken once the window can hold it and
 * still leave the page margins. A row spends what it is given on the summary beside a
 * title, which is the part a narrow column cuts first.
 *
 * Stepped rather than fluid: a row's source and time hold their columns across a drag of
 * the window rather than sliding under the reader's eye.
 */
const LIST_STEPS: [query: string, column: string][] = [
	["(min-width: 64rem)", "60rem"],
	["(min-width: 80rem)", "68rem"],
	["(min-width: 96rem)", "78rem"],
	["(min-width: 120rem)", "88rem"],
];

/**
 * Where the viewport is no wider than the column, so the gutter is width taken off the
 * page rather than slack around it.
 */
const NARROW_PAGE = `(max-width: ${PAGE_COLUMN})`;

/** Where the header's row has the width for the way out to say so in words. */
const WIDE_HEADER = "(min-width: 30rem)";

/** Edge of the glyph the way out is drawn with, sized to the label beside it. */
const LOGOUT_ICON_SIZE = 16;

/**
 * How wide the page is allowed to read, which the header takes along with the content so
 * the navigation stays on the page heading's own vertical line.
 *
 * @param width - What the page holds, which is what decides whether it widens.
 */
function pageWidth(width: AppLayout.Width) {
	if (width === "column") return maxIs(PAGE_COLUMN);

	return [maxIs(PAGE_COLUMN), LIST_STEPS.map(([query, column]) => media(query, maxIs(column)))];
}

/**
 * Runs a list of rows out to the viewport edge on a screen no wider than the column, where
 * the page's gutter and a row's own inline padding would otherwise be spent one inside the
 * other. The row keeps its padding, so the words land where they always did and it is the
 * rules between them that reach the edges of the screen.
 *
 * A wider viewport has the gutter to spare, so the list stays inside the column there.
 */
export function pageBleed() {
	return media(NARROW_PAGE, bleed(PAGE_GUTTER));
}

export namespace AppLayout {
	/** Which navigation link is the page being rendered. */
	export type Page = "reading" | "feeds" | "search" | "settings";

	/**
	 * What the page holds, which is what it does with a large window: a list of rows takes
	 * the extra width, because a row has more to show than it fits; anything else keeps the
	 * column a paragraph and a field are read in.
	 */
	export type Width = "column" | "list";

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
		search: string;
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
		/** What the page holds. Defaults to the column, so nothing widens by accident. */
		width?: Width;
		nav: Nav;
		children: RemixNode;
	}
}

/**
 * One link in a row of them: the app's sections here, and a page's own filters where a
 * page offers any. The one being read wears the app's strongest foreground and the rest
 * settle to body copy, which is the pair of shades an unread post and a read one already
 * differ by on every other surface.
 *
 * The weight stays put across the row for the reason a post's title holds its own: a
 * heavier face is a wider one, so marking a label current would nudge the ones beside it
 * along the line. Pointing at a label underlines it, which is what the app's other links do.
 */
export function AppNavLink(handle: Handle<{ href: string; label: string; isCurrent: boolean }>) {
	return () => {
		let { href, label, isCurrent } = handle.props;

		return (
			<NavLink
				href={href}
				aria-current={isCurrent ? "page" : undefined}
				mix={[
					text("sm"),
					weight("medium"),
					textDecoration("none"),
					hover(textDecoration({ line: "underline", thickness: 1, offset: 4 })),
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
		let {
			children,
			current,
			documentTitle,
			heading,
			headingActions,
			headingLink,
			locale,
			nav,
			width = "column",
		} = handle.props;

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
					{/**
					 * One row at every width, which is what keeps a phone's first screenful the page
					 * rather than the chrome above it.
					 */}
					<div
						mix={[
							mi("auto"),
							pageWidth(width),
							minBs("3.5rem"),
							pi(PAGE_GUTTER),
							pb(2),
							flex(),
							items("center"),
							gap(3),
							media(WIDE_HEADER, gap(4)),
						]}
					>
						<nav
							aria-label={nav.label}
							mix={[flex(), items("center"), gap(3), media(WIDE_HEADER, gap(4))]}
						>
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
								href={routes.search.href()}
								label={nav.search}
								isCurrent={current === "search"}
							/>
							<AppNavLink
								href={routes.settings.index.href()}
								label={nav.settings}
								isCurrent={current === "settings"}
							/>
						</nav>

						{/**
						 * Leaving is not a fifth section, so it takes the far end of the row and the
						 * sections keep the start of it. It is quiet where the sections are quiet and
						 * set in their size, which is what keeps the two halves one header.
						 *
						 * The glyph follows the words the way a post's outbound mark follows its title:
						 * the label names the action and the mark says where following it takes you.
						 * The row is a flex line, so the two stay on it together.
						 */}
						<LinkButton
							href={routes.logout.index.href()}
							color="neutral"
							variant="ghost"
							aria-label={nav.logout}
							title={nav.logout}
							mix={[mis("auto"), pi(2), gap(1)]}
						>
							{/**
							 * The words wherever the row has room for them. A phone has room for the
							 * glyph, which is how the marks on a post's row are read there too, and the
							 * name the link carries is what a screen reader announces at either width.
							 */}
							<span mix={[hidden(), media(WIDE_HEADER, inline())]}>{nav.logout}</span>
							<LogOutIcon size={LOGOUT_ICON_SIZE} />
						</LinkButton>
					</div>
				</header>

				<main mix={[vstack({ gap: 6 }), mi("auto"), pageWidth(width), p(PAGE_GUTTER)]}>
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
