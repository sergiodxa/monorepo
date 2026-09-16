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

import { FlagIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, borderEdge, colorMix, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import {
	flex,
	gap,
	grow,
	inline,
	inlineFlex,
	items,
	relative,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, maxIs, mbs, mie, minIs, mis, p, pb } from "@sdxc/u/size";
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
import { Text } from "@sdxc/ui";
import { css } from "remix/ui";

import type { TagChips } from "~/resources/views/tag-chips";

import LazyFrame from "~/resources/components/lazy-frame";
import ReadToggle from "~/resources/components/read-toggle";
import SaveToggle from "~/resources/components/save-toggle";
import { listBleed, listRowGutter } from "~/resources/layouts/app";
import OutboundMark from "~/resources/views/outbound-mark";
import TagStrip from "~/resources/views/tag-chips";
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

/**
 * The room a paging link takes, above and below. It is the rhythm of the rows it sits
 * against, because the link is a control: the way through the list for a reader running no
 * script, and what stands there for the moment before the frame holding it mounts. The
 * note that replaces it when a page fails to arrive is about this tall too, so the rows
 * above hold still as one gives way to the other.
 *
 * Spelled here and written into the links' own styles by hand, since those travel to the
 * browser as plain declarations.
 */
const LINK_ROOM = "0.75rem";

/**
 * Marks the row's own words and the link its title is, so the row can colour each of them
 * for the state it is in. The state is one attribute on the row, set by the server and
 * turned over by the mark at its head, which leaves what read and unread look like written
 * once rather than once here and again in the browser.
 */
const ROW_WORDS = "data-post-words";
const ROW_TITLE = "data-post-title";

/** The attribute the row wears while its post has been read. */
const ROW_READ = "data-read";

/**
 * What a row's words are coloured by, which is the one thing that changes as a post is read.
 *
 * A title still to read takes the brand colour, so a screenful reads as a list of things to
 * open and the loudest rows are the ones still wanting the reader. Read, it keeps the link
 * and drops the hue: quiet enough that a screenful sorts into the two at a glance, and at
 * the same lightness, so it stays a comfortable read on a light page and a dark one alike.
 *
 * The weight is deliberately not one of the differences. A heavier face is a wider one, so
 * switching it rewrites every glyph on the line and the title reflows under the reader's eye
 * at the moment they mark the post.
 *
 * A post whose feed gave it no address is words rather than a link, so it takes the row's own
 * foreground: the brand colour is a promise that clicking goes somewhere.
 */
function readState() {
	return css({
		[`& [${ROW_WORDS}]`]: { color: "var(--ui-neutral-fg-emphasis)" },
		[`& [${ROW_TITLE}]`]: { color: "var(--ui-brand-fg)" },
		[`&[${ROW_READ}] [${ROW_WORDS}]`]: { color: "var(--ui-neutral-fg)" },
		[`&[${ROW_READ}] [${ROW_TITLE}]`]: { color: "var(--ui-neutral-fg)" },
	});
}

/**
 * The fill the closing panel carries: the rule between rows thinned nearly to nothing, so
 * it reads as a patch of the page rather than as a notice pasted onto it, and holds that
 * weight on a light page and a dark one alike. Derived the way a row's own hover fill is,
 * since a flat colour picked for one scheme is the wrong one in the other.
 */
const END_FILL = colorMix("oklab", { color: color("neutral.border"), weight: 15 }, "transparent");

/**
 * Edge of the mark the closing panel carries, sized against the sentence beside it rather
 * than against a row's own controls, which are half this.
 */
const END_ICON_SIZE = 28;

/**
 * How far above the viewport the newer page starts arriving. Short, where the reach below
 * is generous: a page arriving above the reader moves the document under them, so it is
 * fetched as they actually turn back toward it rather than on the chance that they might.
 * Only the top is extended, which is the side they approach it from.
 */
const NEWER_REACH = "200px 0px 0px 0px";

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
		/** Whether the reader has asked to keep this post, which no rule that deletes one reaches. */
		isSaved: boolean;
		/**
		 * Whether one of the reader's own rules marked this post as it arrived. The mark says
		 * a rule picked it out and nothing more: it is kept, aged out and reclaimed exactly as
		 * every other post is.
		 */
		isFlagged: boolean;
		/**
		 * The labels on this post, each a way into what else is kept under it. Only the
		 * surfaces that ask their store for them have any, and the rest of the lists print
		 * no strip at all.
		 */
		tags?: TagChips.Chip[];
		/** Where a label is put on this post, or `null` on a list that draws no strip. */
		applyTagAction?: string | null;
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
		/** What the mark says when the server refused the last move, which it wears until the next. */
		markFailed: string;
		/** Keeping a post, and stopping. */
		save: string;
		unsave: string;
		saveFailed: string;
		/** What the keeping control says instead when there is no room left to keep anything. */
		saveFull: string;
		/**
		 * That a post is being kept, for a reader who cannot see the mark it is kept with.
		 * The glyph carries it on screen; this carries it to a screen reader.
		 */
		saved: string;
		/** That one of the reader's rules picked this post out, which the mark stands for. */
		flagged: string;
		newer: string;
		older: string;
		/** Said where the list stops, so it is known to have an end rather than to go on. */
		end: string;
	}

	/** What a list drawing labels needs beyond the chips on each row. */
	export interface Tagging {
		copy: TagChips.Copy;
		/** The names the field offers, so a second spelling of one label takes effort. */
		options: string[];
		/** The `id` those names are listed under, which every row's field points at. */
		optionsId: string;
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
		/**
		 * Whether a row carries the mark that keeps a post. Off, the list is what it was
		 * before keeping existed, which is the state its way back is a return to.
		 */
		saving?: boolean;
		/**
		 * The copy the strip of labels prints and the list of names its field offers, or
		 * `null` on a list that draws no labels — which is every list of a river, since a
		 * label belongs to a post somebody kept.
		 */
		tagging?: Timeline.Tagging | null;
		continueSrc?: string | null;
		/**
		 * Where the page above this one is fetched from as the reader scrolls back up to it,
		 * read the same way as {@link continueSrc} and holding the newer-posts link the same
		 * way the lower frame holds the older-posts one.
		 */
		resumeSrc?: string | null;
		/**
		 * Whether the rows below this page are already on screen. That is true of a piece
		 * fetched to continue a list upward: the page it was fetched for sits directly under
		 * it, so this one prints nothing after its rows — neither the way onward nor the
		 * sentence saying the list has none.
		 */
		joinsBelow?: boolean;
		/**
		 * This page's own address, which the address bar carries while the reader is reading
		 * it, so reloading resumes here rather than at the top of a list already walked.
		 */
		pageUrl?: string;
	}
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

		/**
		 * A post whose feed gave it no address is words rather than a link, so it goes out
		 * unmarked and keeps the row's own foreground.
		 */
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
				{...{ [ROW_TITLE]: "" }}
				mix={[
					inlineFlex(),
					items("center"),
					maxIs("100%"),
					verticalAlign("bottom"),
					textDecoration("none"),
					/** Already brand, so pointing at it has only the underline left to add. */
					hover(textDecoration({ line: "underline", thickness: 1, offset: 3 })),
				]}
			>
				<span mix={[minIs(0), truncate()]}>{title}</span>
				<OutboundMark mix={[shrink(0), mis(1)]} />
			</a>
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
	return () => <EndLink href={handle.props.href} rel="next" label={handle.props.label} />;
}

/**
 * The way back to the page above this one, which only a page below the newest has. It sits
 * above the rows, where the posts it leads to are, and is what the upper frame replaces.
 */
function NewerLink(handle: Handle<{ href: string; label: string }>) {
	return () => <EndLink href={handle.props.href} rel="prev" label={handle.props.label} />;
}

/**
 * One end of a list, as a link a reader follows themselves. Compact, and centred at both
 * ends so the way up and the way down are read as the same control in two places.
 *
 * Drawn with inline styles rather than with the app's own mixins, which is the one place
 * in this app that is true: both links travel to the browser inside a client entry's
 * serialized props, and the runtime accepts only plain values there. Everything they need
 * is a declaration, so nothing is lost but the underline a pointer would draw.
 */
function EndLink(handle: Handle<{ href: string; label: string; rel: string }>) {
	return () => (
		<nav style={`display: flex; justify-content: center; padding-block: ${LINK_ROOM};`}>
			<a
				href={handle.props.href}
				rel={handle.props.rel}
				style="padding: 0.5rem 0.75rem; border-radius: var(--ui-radius-md, 0.375rem); color: var(--ui-brand-fg); text-decoration: none;"
			>
				{handle.props.label}
			</a>
		</nav>
	);
}

/** Renders one page of posts, and whatever carries the reader on from the end of it. */
export default function Timeline(handle: Handle<Timeline.Props>) {
	return () => {
		let {
			continueSrc = null,
			saving = true,
			copy,
			cursors,
			entries,
			joinsBelow = false,
			pageUrl,
			resumeSrc = null,
			returnTo,
			start,
			tagging = null,
		} = handle.props;

		/**
		 * One row without a source would pull its time out of the column every other row's
		 * time sits in, so the cell is drawn for the whole list or for none of it.
		 */
		let hasSource = entries.some((entry) => entry.source !== null);

		return (
			<div>
				{/**
				 * The way back up, held by a frame of its own so the page above arrives under the
				 * reader as they scroll to it rather than waiting to be asked for. The link is that
				 * frame's children exactly as the older-posts link is the lower frame's, so a
				 * browser running no script keeps a way through the list at both ends.
				 *
				 * The frame is told it sits above the rows, which is what has it wait to be
				 * scrolled back to and hold the reader's place when the page lands.
				 */}
				{resumeSrc && cursors.prev ? (
					<LazyFrame
						src={resumeSrc}
						url={cursors.prev}
						parentUrl={pageUrl}
						rootMargin={NEWER_REACH}
						sitsAbove
					>
						<NewerLink href={cursors.prev} label={copy.newer} />
					</LazyFrame>
				) : (
					cursors.prev && <NewerLink href={cursors.prev} label={copy.newer} />
				)}

				{/**
				 * The list takes the page's gutter back and each row spends it inside itself, so the
				 * words keep their place while the rules between rows and the fill under the pointer
				 * run the full width of the pane.
				 */}
				{/**
				 * The labels already in use, offered to every field on the page, so a second
				 * spelling of one label is something a reader goes out of their way to type. It
				 * is one list for the page rather than one per row, which is the whole reason the
				 * field points at it by name.
				 */}
				{tagging && (
					<datalist id={tagging.optionsId}>
						{tagging.options.map((name) => (
							<option key={name} value={name} />
						))}
					</datalist>
				)}

				<ol start={start ?? undefined} mix={[p(0), listBleed()]}>
					{entries.map((entry) => (
						<li
							key={entry.id}
							{...{ [ROW_READ]: entry.isRead ? "" : undefined }}
							mix={[
								pb(1),
								listRowGutter(),
								borderEdge("block-end", { color: "neutral.border", width: 1 }),
								hover(bg(ROW_HOVER)),
								readState(),
							]}
						>
							<article mix={[flex(), items("center"), gap(2)]}>
								<ReadToggle
									action={routes.items.read.href({ itemId: entry.id })}
									isRead={entry.isRead}
									returnTo={returnTo}
									markRead={copy.markRead}
									markUnread={copy.markUnread}
									failed={copy.markFailed}
								/>

								{/**
								 * The title takes the line and the two quiet columns follow it, until the
								 * line is too narrow to hold all three and they drop underneath. Where a
								 * post carries labels they take a line of their own beneath all three, so
								 * a row is still one line until there is a second thing to say.
								 */}
								<div mix={[grow(), minIs(0)]}>
									<div mix={[media(WIDE_ROW, [flex(), items("baseline"), gap(3)])]}>
										{/**
										 * What the row's own words take when they are not a link: a post whose feed
										 * gave it no address, and the note a screen reader hears. A linked title
										 * wears the brand pair instead, which sorts read from unread the same way.
										 *
										 * The weight is deliberately not one of those differences. A heavier face
										 * is a wider one, so switching it rewrites every glyph on the line and the
										 * title reflows under the reader's eye at the moment they mark a post.
										 */}
										<div
											{...{ [ROW_WORDS]: "" }}
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
											]}
										>
											{/**
											 * Ahead of the words, so a reader scanning the column meets the rule's
											 * pick before the title rather than after a summary they may not read.
											 */}
											{entry.isFlagged && (
												<span mix={[mie(2), text("xs"), weight("medium"), fg("brand")]}>
													{copy.flagged}
												</span>
											)}

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
											{entry.isSaved && <Text mix={[visuallyHidden()]}>{copy.saved}</Text>}
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

									{/**
									 * Why the post was kept, under the words saying what it is. It is drawn
									 * only on the lists whose posts are kept by definition, so no row of a
									 * river carries a strip — or the read behind one.
									 */}
									{tagging && entry.applyTagAction && (
										<TagStrip
											chips={entry.tags ?? []}
											applyAction={entry.applyTagAction}
											returnTo={returnTo}
											optionsId={tagging.optionsId}
											copy={tagging.copy}
										/>
									)}
								</div>

								{/**
								 * At the end of the row, where the other mark leads it: the mark at the head
								 * moves a post through the queue, and this one takes it out of everything that
								 * empties the queue. Two decisions about the same post, at either end of it,
								 * so neither is pressed while reaching for the other.
								 */}
								{saving && (
									<SaveToggle
										action={routes.items.save.href({ itemId: entry.id })}
										isSaved={entry.isSaved}
										returnTo={returnTo}
										save={copy.save}
										unsave={copy.unsave}
										failed={copy.saveFailed}
										full={copy.saveFull}
									/>
								)}
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
				{!joinsBelow &&
					(continueSrc && cursors.next ? (
						/**
						 * The frame carries both addresses: the page it holds, which the reader is in
						 * once they pass its first row, and this one, which they are back in when they
						 * scroll above it.
						 */
						<LazyFrame src={continueSrc} url={cursors.next} parentUrl={pageUrl}>
							<OlderLink href={cursors.next} label={copy.older} />
						</LazyFrame>
					) : (
						cursors.next && <OlderLink href={cursors.next} label={copy.older} />
					))}

				{/**
				 * Where the list stops, said in words and given the room to be read as a moment
				 * rather than as one more row. A reader scrolling reaches it the way they reach any
				 * other row, and one listening is told the list has an end rather than being left
				 * to keep asking.
				 *
				 * One panel at the foot of a list of flat rows, which is the whole of the contrast:
				 * it stops the list rather than continuing it. Getting to the bottom of everything
				 * you follow is worth marking, and this is the only thing saying there is nothing
				 * further to scroll for.
				 *
				 * A block rather than the run of copy this used to be. Centring and vertical room
				 * are laid out on a block and merely painted on an inline box, so the words sat in
				 * the corner of a space they never actually took.
				 */}
				{!joinsBelow && cursors.next === null && entries.length > 0 && (
					<div
						role="status"
						mix={[
							vstack({ gap: 2 }),
							items("center"),
							textAlign("center"),
							p(6, 4),
							mbs(6),
							rounded("xl"),
							border({ color: "neutral.border", width: 1 }),
							bg(END_FILL),
							fg("neutral"),
						]}
					>
						{/**
						 * A flag, which is a course finished rather than an answer marked right. The
						 * ticked ring this app draws already means a post has been read, and one glyph
						 * doing two jobs on a screen holding both teaches neither.
						 */}
						<FlagIcon size={END_ICON_SIZE} />

						<Text mix={[text("sm"), weight("medium"), fg("neutral")]}>{copy.end}</Text>
					</div>
				)}
			</div>
		);
	};
}
