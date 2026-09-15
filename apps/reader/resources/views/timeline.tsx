/**
 * The list of posts every reading surface renders, and the links that walk it. The queue
 * and a single feed differ in which posts they hold and in nothing about how one is shown,
 * so the markup lives here and each controller supplies the page it is showing.
 *
 * A long list continues by fetching the next page into a frame below this one, and that
 * page ends with a frame of its own, so a reader scrolling walks the list without asking
 * for each page in turn. Each page is an ordered list starting where the one above it
 * stopped, rather than rows folded into a list that is already open, so the positions the
 * numbers carry stay true however many pages have arrived.
 *
 * The links are what the frame replaces, and what a browser running no script keeps.
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
import { flex, gap, grow, inline, inlineFlex, items, relative, shrink } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, maxIs, mbs, minIs, mis, p, pb, pi } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
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

import LazyFrame from "~/resources/components/lazy-frame";
import { listBleed, listRowGutter } from "~/resources/layouts/app";
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
		/** Said where the list stops, so it is known to have an end rather than to go on. */
		end: string;
	}

	export interface Props {
		entries: Entry[];
		copy: Copy;
		/**
		 * The position of this page's first row in the list as a whole, or `null` for a page
		 * that cannot say: a cursor records where to read from and not how far in that is, so
		 * a page reached by its cursor alone counts from one like any other list.
		 */
		start?: number | null;
		/** The page the mark-read form returns to, which is the page being rendered. */
		returnTo: string;
		/** The URL of the page holding older and newer posts, or `null` at either end. */
		cursors: { next: string | null; prev: string | null };
		/**
		 * Where the page below this one is fetched from as the reader reaches the end of this
		 * one, or `null` for a surface walked by its links alone. It is that page's own
		 * address asked for as a fragment, which is a different URL from the link beside it:
		 * the link is a page to navigate to, this is a piece to write into this one.
		 */
		continueSrc?: string | null;
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

/**
 * The way to the page below this one, which is what a reader walks the list with and what
 * that page replaces once it has arrived under them.
 *
 * It is drawn with an inline style rather than with the app's own mixins, which is the one
 * place in this app that is true: the link travels to the browser inside a client entry's
 * serialized props, and the runtime accepts only plain values there. Everything the link
 * needs is a declaration, so nothing is lost but the underline a pointer would draw.
 */
function OlderLink(handle: Handle<{ href: string; label: string }>) {
	return () => (
		<nav style="display: flex; justify-content: flex-end; padding-block: 0.75rem;">
			<a
				href={handle.props.href}
				rel="next"
				style="padding: 0.5rem 0.75rem; border-radius: var(--ui-radius-md, 0.375rem); color: var(--ui-brand-fg); text-decoration: none;"
			>
				{handle.props.label}
			</a>
		</nav>
	);
}

/**
 * The way back to the page above this one, which only a page reached by following one has.
 * It sits above the rows, where the posts it leads to are.
 */
function NewerLink(handle: Handle<{ href: string; label: string }>) {
	return () => (
		<nav mix={[flex(), items("center"), p(3, 0)]}>
			<a
				href={handle.props.href}
				rel="prev"
				mix={[
					p(2, 3),
					rounded("md"),
					fg("brand"),
					textDecoration("none"),
					hover(textDecoration("underline")),
				]}
			>
				{handle.props.label}
			</a>
		</nav>
	);
}

/** Renders one page of posts, and whatever carries the reader on from the end of it. */
export default function Timeline(handle: Handle<Timeline.Props>) {
	return () => {
		let { continueSrc = null, copy, cursors, entries, returnTo, start } = handle.props;

		/**
		 * One row without a source would pull its time out of the column every other row's
		 * time sits in, so the cell is drawn for the whole list or for none of it.
		 */
		let hasSource = entries.some((entry) => entry.source !== null);

		return (
			<div>
				{cursors.prev && <NewerLink href={cursors.prev} label={copy.newer} />}

				{/**
				 * The list takes the page's gutter back and each row spends it inside itself, so the
				 * words keep their place while the rules between rows and the fill under the pointer
				 * run the full width of the pane.
				 */}
				<ol start={start ?? undefined} mix={[p(0), listBleed()]}>
					{entries.map((entry) => (
						<li
							key={entry.id}
							mix={[
								pb(1),
								listRowGutter(),
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

				{/**
				 * The list is closed before whatever follows it, so the page that arrives below
				 * opens a list of its own numbered from where this one stopped. Rows fetched into
				 * a list already open would be nested inside it rather than beside its own.
				 *
				 * The link is what the frame holds rather than what sits beside it: the server
				 * sends the link, a browser running no script keeps it, and the page it leads to
				 * takes its place the moment it arrives — so the two never stand together and the
				 * rows of one page meet the rows of the next with nothing between them.
				 */}
				{continueSrc && cursors.next ? (
					<LazyFrame src={continueSrc}>
						<OlderLink href={cursors.next} label={copy.older} />
					</LazyFrame>
				) : (
					cursors.next && <OlderLink href={cursors.next} label={copy.older} />
				)}

				{/**
				 * Where the list stops, said in words. A reader scrolling reaches it the way they
				 * reach any other row, and one listening is told the list has an end rather than
				 * being left to keep asking.
				 */}
				{cursors.next === null && entries.length > 0 && (
					<Text role="status" mix={[p(3, 0), text("sm"), fg("neutral.muted")]}>
						{copy.end}
					</Text>
				)}
			</div>
		);
	};
}
