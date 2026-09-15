/**
 * The list of posts both reading surfaces render, and the pair of links that walk it. The
 * queue and a single feed differ in which posts they hold and in nothing about how one is
 * shown, so the markup lives here and each controller supplies the page it is showing.
 *
 * Every string arrives translated and every date arrives formatted: interpolation and
 * locale-aware formatting belong to the controller, which is where the dictionary and the
 * request's language are.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { CheckIcon, CircleCheckIcon, CircleIcon, Undo2Icon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { borderEdge, fg } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { flex, gap, grow, items, justify, shrink, vstack } from "@sdxc/u/layout";
import { bs, is, maxIs, minIs, mis, p, pb, pi } from "@sdxc/u/size";
import { focusWithin, hover } from "@sdxc/u/state";
import { leading, nowrap, overflowWrap, text, textDecoration, weight } from "@sdxc/u/typography";
import { Button, Card, Text } from "@sdxc/ui";

import OutboundMark from "~/resources/views/outbound-mark";
import routes from "~/routes/web";

/**
 * How much of its contrast a read post keeps. Low enough that a page of posts sorts into
 * read and unread at a glance, high enough that the title of a read one is still body
 * copy rather than a watermark.
 */
const READ_OPACITY = 70;

/**
 * The marker down a card's leading edge. It is the card's own border thickened, so a read
 * card carries it too in the card's border colour: transparent would leave the outline
 * open on that side, and dropping the width would move every word on the card.
 */
const UNREAD_EDGE_WIDTH = 3;

/** Edge of the read mark, sized to the label a small button would have carried instead. */
const ICON_SIZE = 16;

/**
 * Edge of the square the mark sits in. Comfortably past the mark itself, so a thumb on a
 * phone has a target rather than a glyph.
 */
const TOGGLE_SIZE = "2.25rem";

export namespace Timeline {
	/**
	 * What the mark on a post card stands for on this surface.
	 *
	 * `"toggle"` is a state a post is in and can be put back into: a feed's page holds
	 * read and unread posts alike, so its mark says which of the two a post is.
	 *
	 * `"complete"` is a step a post is carried through: the queue holds what is left to
	 * read, so its mark says finish this rather than naming a state one post shares with
	 * every other post on the page.
	 */
	export type ReadAction = "toggle" | "complete";

	/** One post, with every piece of it already resolved to the text that is printed. */
	export interface Entry {
		id: string;
		title: string;
		/** Where the post lives, or `null` for a feed that published none. */
		url: string | null;
		summary: string | null;
		/**
		 * The byline, in the order it reads: the feed, the author, the date. Already
		 * translated and formatted, so the list prints the parts and joins them.
		 */
		meta: string[];
		isRead: boolean;
	}

	/** The list's translated copy. */
	export interface Copy {
		markRead: string;
		markUnread: string;
		/**
		 * That a post has been read, for a reader who cannot see the card dim. Color and
		 * contrast carry the state on screen; this carries it to a screen reader.
		 */
		read: string;
		newer: string;
		older: string;
	}

	export interface Props {
		entries: Entry[];
		copy: Copy;
		/** Which mark the cards wear, which is what the surface does with a post. */
		readAction: ReadAction;
		/** The page the mark-read form returns to, which is the page being rendered. */
		returnTo: string;
		/** The URL of the page holding older and newer posts, or `null` at either end. */
		cursors: { next: string | null; prev: string | null };
	}
}

/**
 * The mark the control wears, which is one glyph of the app's icon set so every mark on a
 * page belongs together.
 *
 * A toggling surface draws the state: an empty ring for a post still to read, a ticked
 * one for a post already read, so the two differ in outline rather than in shade alone. A
 * completing surface draws the move instead: a tick to carry a post out of the queue, and
 * the arrow that brings one back.
 */
function ReadMark(handle: Handle<{ action: Timeline.ReadAction; isRead: boolean }>) {
	return () => {
		let { action, isRead } = handle.props;

		if (action === "toggle") {
			return isRead ? <CircleCheckIcon size={ICON_SIZE} /> : <CircleIcon size={ICON_SIZE} />;
		}

		return isRead ? <Undo2Icon size={ICON_SIZE} /> : <CheckIcon size={ICON_SIZE} />;
	};
}

/**
 * A post's title, and the link out to it for a post whose feed gave it an address. The
 * link is underlined from the start, since a title that only looks like a link under a
 * pointer looks like plain text on a touch screen; pointing at it thickens the rule and
 * takes the brand color.
 *
 * The last word and the outbound mark share one unbreakable span, so a title that wraps
 * carries the mark down with the word it belongs to. A title of one word leaves that span
 * breakable, since the heading's freedom to break inside a word is what keeps a single
 * long one inside a phone's width.
 */
function PostTitle(handle: Handle<{ title: string; url: string | null }>) {
	return () => {
		let { title, url } = handle.props;

		if (!url) return title;

		let lastBreak = title.lastIndexOf(" ");
		let head = title.slice(0, lastBreak + 1);
		let tail = title.slice(lastBreak + 1);

		return (
			<a
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				mix={[
					fg("neutral.emphasis"),
					textDecoration({ line: "underline", thickness: 1, offset: 3 }),
					hover([fg("brand"), textDecoration({ thickness: 2 })]),
				]}
			>
				{head}
				<span mix={[head ? nowrap() : undefined]}>
					{tail}
					<OutboundMark mix={[mis(1)]} />
				</span>
			</a>
		);
	};
}

/**
 * The mark-read control, in the corner of the card it belongs to. A form rather than a
 * link, since following it changes what the reader has read, and a link is what a
 * prefetcher and a mail scanner follow on their own.
 *
 * The mark is the whole control, so `label` is what names it: it reaches a screen reader
 * through `aria-label` and a pointer through the native tooltip `title` gives.
 */
function ReadToggle(
	handle: Handle<{
		id: string;
		action: Timeline.ReadAction;
		isRead: boolean;
		label: string;
		returnTo: string;
	}>,
) {
	return () => {
		let { action, id, isRead, label, returnTo } = handle.props;

		return (
			<form method="post" action={routes.items.read.href({ itemId: id })} mix={[shrink()]}>
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
					<ReadMark action={action} isRead={isRead} />
				</Button>
			</form>
		);
	};
}

/** Renders one page of posts and the links to the pages either side of it. */
export default function Timeline(handle: Handle<Timeline.Props>) {
	return () => {
		let { copy, cursors, entries, readAction, returnTo } = handle.props;

		return (
			<div mix={[vstack({ gap: 4 })]}>
				<ol mix={[vstack({ gap: 4 }), p(0)]}>
					{entries.map((entry) => (
						<li key={entry.id} mix={[vstack({ gap: 0 })]}>
							{/**
							 * A read card dims whole — title, byline, summary, border and control
							 * together — and gives up the accent edge that marks an unread one, so the
							 * two states differ everywhere rather than in one shade of heading. Pointing
							 * at a read card or tabbing into it restores its full contrast, which is
							 * when a reader is reading it rather than scanning past it.
							 */}
							<Card
								mix={[
									p(4),
									borderEdge("inline-start", {
										color: entry.isRead ? "neutral.border" : "brand.solid",
										width: UNREAD_EDGE_WIDTH,
									}),
									entry.isRead && [
										opacity(READ_OPACITY),
										hover(opacity(100)),
										focusWithin(opacity(100)),
									],
								]}
							>
								<article mix={[vstack({ gap: 2 })]}>
									{/** The title takes the row and the mark keeps its corner, whatever the width. */}
									<div mix={[flex(), items("start"), gap(2)]}>
										<h2
											mix={[
												grow(),
												minIs(0),
												overflowWrap("anywhere"),
												text("lg"),
												weight(entry.isRead ? "normal" : "semibold"),
												leading("snug"),
											]}
										>
											<PostTitle title={entry.title} url={entry.url} />
										</h2>

										<ReadToggle
											id={entry.id}
											action={readAction}
											isRead={entry.isRead}
											label={entry.isRead ? copy.markUnread : copy.markRead}
											returnTo={returnTo}
										/>
									</div>

									{entry.isRead && <Text mix={[visuallyHidden()]}>{copy.read}</Text>}

									{entry.meta.length > 0 && (
										<Text mix={[text("xs"), fg("neutral.muted")]}>{entry.meta.join(" · ")}</Text>
									)}

									{entry.summary && (
										<Text mix={[text("sm"), leading("relaxed"), maxIs("42rem")]}>
											{entry.summary}
										</Text>
									)}
								</article>
							</Card>
						</li>
					))}
				</ol>

				{(cursors.prev ?? cursors.next) && (
					<nav mix={[flex(), items("center"), gap(3), p(2, 0)]}>
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
