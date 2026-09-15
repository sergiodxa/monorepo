/**
 * The list of posts every reading surface renders, and the pair of links that walk it. The
 * queue, a single feed and a search differ in which posts they hold and in nothing about
 * how one is shown, so the markup lives here and each controller supplies the page it is
 * showing.
 *
 * A post is one row: the mark that changes what has been read, the title, who it came
 * from, and when. Reading a list of posts is scanning it, and a row that takes one line
 * puts twenty of them on a screen where a panel puts seven.
 *
 * Every string arrives translated and every date arrives formatted: interpolation and
 * locale-aware formatting belong to the controller, which is where the dictionary and the
 * request's language are.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { CircleCheckIcon, CircleIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, borderEdge, colorMix, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import {
	flex,
	gap,
	grow,
	inline,
	inlineFlex,
	items,
	justify,
	relative,
	shrink,
} from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, maxIs, mbs, minIs, mis, p, pb, pi } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { color } from "@sdxc/u/tokens";
import {
	leading,
	nowrap,
	text,
	textAlign,
	textDecoration,
	truncate,
	verticalAlign,
	weight,
} from "@sdxc/u/typography";
import { Button, Text } from "@sdxc/ui";

import { pageBleed } from "~/resources/layouts/app";
import OutboundMark from "~/resources/views/outbound-mark";
import routes from "~/routes/web";

/**
 * The fill a row takes under the pointer: the rule between rows thinned until it reads as
 * a shade of the page rather than a band across it, which keeps it the same weight on a
 * light page and a dark one.
 */
const ROW_HOVER = colorMix("oklab", { color: color("neutral.border"), weight: 25 }, "transparent");

/**
 * Where a row has the width for its title, source and time on one line. Below it the row
 * keeps the title to itself and drops the two quiet columns underneath, which is the only
 * way a phone shows a title rather than the first three words of one.
 */
const WIDE_ROW = "(min-width: 34rem)";

/**
 * Width of the column naming where a post came from. Fixed, so the column reads as a
 * column: a source sized to its own words would leave every row's time in a different
 * place.
 */
const SOURCE_COLUMN = "9rem";

/**
 * Least width of the column holding the time, which is what lines the times up. A phrase
 * longer than this takes the room it needs rather than reaching back over the source.
 */
const TIME_COLUMN = "6rem";

/** Edge of the read mark, sized to the label a small button would have carried instead. */
const ICON_SIZE = 16;

/** Edge of the square the mark sits in, which is the tallest thing on a row. */
const TOGGLE_SIZE = "1.75rem";

export namespace Timeline {
	/** One post, with every piece of it already resolved to the text that is printed. */
	export interface Entry {
		id: string;
		title: string;
		/** Where the post lives, or `null` for a feed that published none. */
		url: string | null;
		/**
		 * Where the browser reports that the title was followed, which is what marks the post
		 * read on the way out. `null` on a row whose title is not a link, since there is
		 * nothing to follow.
		 */
		ping: string | null;
		/**
		 * Who the post is from: the feed on a surface holding many of them, the author on
		 * one feed's own page, and `null` when neither is known.
		 */
		source: string | null;
		summary: string | null;
		/** How long ago the post was published, short enough to scan down a column. */
		time: string;
		/** The full publication date, which the short one stands for. */
		timeLabel: string;
		/** The publication date as a machine reads it, for the `datetime` attribute. */
		dateTime: string;
		isRead: boolean;
	}

	/** The list's translated copy. */
	export interface Copy {
		markRead: string;
		markUnread: string;
		/**
		 * That a post has been read, for a reader who cannot see the row dim. Contrast and
		 * the mark's own glyph carry the state on screen; this carries it to a screen reader.
		 */
		read: string;
		newer: string;
		older: string;
	}

	export interface Props {
		entries: Entry[];
		copy: Copy;
		/**
		 * The `id` the list of rows answers to, which a paging enhancement names to append
		 * the pages it fetches into. Left off a surface that pages by its links alone.
		 */
		listId?: string;
		/** The page the mark-read form returns to, which is the page being rendered. */
		returnTo: string;
		/** The URL of the page holding older and newer posts, or `null` at either end. */
		cursors: { next: string | null; prev: string | null };
	}
}

/**
 * The mark the control wears, which is one glyph of the app's icon set so every mark on a
 * page belongs together. It draws the state the post is in: an empty ring for one still
 * to read and a ticked ring for one already read, so the two differ in outline rather
 * than in shade alone.
 */
function ReadMark(handle: Handle<{ isRead: boolean }>) {
	return () => {
		let { isRead } = handle.props;

		return isRead ? <CircleCheckIcon size={ICON_SIZE} /> : <CircleIcon size={ICON_SIZE} />;
	};
}

/**
 * A post's title, and the link out to it for a post whose feed gave it an address. The
 * outbound mark is what says the words can be followed and where following them goes,
 * which leaves a screenful of rows reading as a list of posts rather than as a page of
 * rules; pointing at one underlines it and takes the brand color.
 *
 * Only the words are allowed to run out of room. The mark sits beside them as its own
 * column and never shrinks, because a row clips more titles than it shows in full — and
 * a clipped title that also loses its mark is a link with nothing left to say so.
 */
function PostTitle(handle: Handle<{ title: string; url: string | null; ping: string | null }>) {
	return () => {
		let { ping, title, url } = handle.props;

		if (!url) return title;

		return (
			<a
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				/**
				 * Following the title is what a reader does instead of ticking the row, so the
				 * browser reports the trip and the post is marked read on its way out. It is a
				 * `POST` the browser makes itself, which no prefetcher walks; a browser that
				 * turns pings off leaves the tick beside the row as the way to say so.
				 *
				 * A `null` would reach the attribute as the word, and the browser would report
				 * the trip to a page of that name.
				 */
				ping={ping ?? undefined}
				mix={[
					inlineFlex(),
					items("center"),
					maxIs("100%"),
					verticalAlign("bottom"),
					fg("inherit"),
					textDecoration("none"),
					hover([fg("brand"), textDecoration({ line: "underline", thickness: 1, offset: 3 })]),
				]}
			>
				<span mix={[minIs(0), truncate()]}>{title}</span>
				<OutboundMark mix={[shrink(0), mis(1)]} />
			</a>
		);
	};
}

/**
 * The mark-read control, at the head of the row it belongs to. A form rather than a link,
 * since following it changes what the reader has read, and a link is what a prefetcher
 * and a mail scanner follow on their own.
 *
 * The mark is the whole control, so `label` is what names it: it reaches a screen reader
 * through `aria-label` and a pointer through the native tooltip `title` gives.
 */
function ReadToggle(
	handle: Handle<{ id: string; isRead: boolean; label: string; returnTo: string }>,
) {
	return () => {
		let { id, isRead, label, returnTo } = handle.props;

		return (
			<form method="post" action={routes.items.read.href({ itemId: id })} mix={[shrink(), flex()]}>
				<input type="hidden" name="returnTo" value={returnTo} />
				<input type="hidden" name="read" value={isRead ? "false" : "true"} />
				{/**
				 * A square box in place of the padding a worded button carries, so one glyph
				 * centres in it rather than sitting in a pill.
				 */}
				<Button
					type="submit"
					color="neutral"
					variant="ghost"
					size="sm"
					aria-label={label}
					title={label}
					mix={[pi(0), pb(0), is(TOGGLE_SIZE), bs(TOGGLE_SIZE)]}
				>
					<ReadMark isRead={isRead} />
				</Button>
			</form>
		);
	};
}

/** Renders one page of posts and the links to the pages either side of it. */
export default function Timeline(handle: Handle<Timeline.Props>) {
	return () => {
		let { copy, cursors, entries, listId, returnTo } = handle.props;

		/**
		 * One row without a source would pull its time out of the column every other row's
		 * time sits in, so the cell is drawn for the whole list or for none of it.
		 */
		let hasSource = entries.some((entry) => entry.source !== null);

		return (
			<div>
				{/**
				 * A row carries its own inline padding, so on a screen no wider than the page's
				 * column the list takes the gutter back: the words keep their place and the rules
				 * between rows run the full width of the screen.
				 */}
				<ol id={listId} mix={[p(0), pageBleed()]}>
					{entries.map((entry) => (
						<li
							key={entry.id}
							mix={[
								pb(1),
								pi(2),
								rounded("md"),
								borderEdge("block-end", { color: "neutral.border", width: 1 }),
								hover(bg(ROW_HOVER)),
							]}
						>
							<article mix={[flex(), items("center"), gap(2)]}>
								<ReadToggle
									id={entry.id}
									isRead={entry.isRead}
									label={entry.isRead ? copy.markUnread : copy.markRead}
									returnTo={returnTo}
								/>

								{/**
								 * The title takes the line and the two quiet columns follow it, until the
								 * line is too narrow to hold all three and they drop underneath.
								 */}
								<div mix={[grow(), minIs(0), media(WIDE_ROW, [flex(), items("baseline"), gap(3)])]}>
									{/**
									 * A read post keeps its title as body copy and an unread one wears the
									 * page's own strongest foreground, so a screenful sorts into the two at a
									 * glance.
									 *
									 * The weight is deliberately not one of those differences. A heavier face
									 * is a wider one, so switching it rewrites every glyph on the line and the
									 * title reflows under the reader's eye at the moment they mark a post.
									 */}
									<div
										mix={[
											grow(),
											minIs(0),
											/**
											 * The note a screen reader hears is taken out of the flow, and a
											 * positioned box belongs to the page itself unless something nearer
											 * claims it. Claiming it here keeps it inside the clip: its place in
											 * the line is the far end of a summary the row never shows, which is
											 * a page-wide sideways scroll on a phone when the page owns it.
											 */
											relative(),
											truncate(),
											text("sm"),
											leading("normal"),
											fg(entry.isRead ? "neutral" : "neutral.emphasis"),
										]}
									>
										<h2 mix={[inline(), weight("medium")]}>
											<PostTitle title={entry.title} url={entry.url} ping={entry.ping} />
										</h2>

										{/**
										 * The opening of the post, carried on the title's own line in the space
										 * a short title leaves: quiet enough to read as a continuation rather
										 * than as a second title, and clipped with it.
										 */}
										{entry.summary && (
											<span mix={[mis(2), fg("neutral.muted")]}>{entry.summary}</span>
										)}

										{entry.isRead && <Text mix={[visuallyHidden()]}>{copy.read}</Text>}
									</div>

									<div
										mix={[
											flex(),
											items("baseline"),
											gap(2),
											shrink(),
											text("xs"),
											fg("neutral.muted"),
											mbs(1),
											media(WIDE_ROW, mbs(0)),
										]}
									>
										{hasSource && (
											<span
												mix={[truncate(), media(WIDE_ROW, [is(SOURCE_COLUMN), textAlign("end")])]}
											>
												{entry.source}
											</span>
										)}

										<time
											dateTime={entry.dateTime}
											title={entry.timeLabel}
											mix={[nowrap(), media(WIDE_ROW, [minIs(TIME_COLUMN), textAlign("end")])]}
										>
											{entry.time}
										</time>
									</div>
								</div>
							</article>
						</li>
					))}
				</ol>

				{(cursors.prev ?? cursors.next) && (
					<nav mix={[flex(), items("center"), gap(3), p(3, 0)]}>
						{cursors.prev && (
							<a
								href={cursors.prev}
								rel="prev"
								mix={[
									p(2, 3),
									rounded("md"),
									fg("brand"),
									textDecoration("none"),
									hover(textDecoration("underline")),
								]}
							>
								{copy.newer}
							</a>
						)}

						<span aria-hidden="true" mix={[grow()]} />

						{cursors.next && (
							<a
								href={cursors.next}
								rel="next"
								mix={[
									p(2, 3),
									rounded("md"),
									fg("brand"),
									textDecoration("none"),
									hover(textDecoration("underline")),
									justify("end"),
									/**
									 * A paging enhancement marks this link while it is the one fetching pages,
									 * which leaves the words off a list already growing under the reader. Focus
									 * brings them back, so tabbing past the last row still reaches the next page.
									 */
									when("&[data-paging]:not(:focus-visible)", visuallyHidden()),
								]}
							>
								{copy.older}
							</a>
						)}
					</nav>
				)}
			</div>
		);
	};
}
