/**
 * The list of followed feeds, the form that follows another one, the control that checks
 * them all, and the links that walk the list a page at a time. Both the feed index and the
 * failed follow render it: a refused URL is answered with the page it was submitted from,
 * carrying the reason, so the list and the form stay one piece of markup.
 *
 * A feed is one row, the same row a post is, so a reader moving between the two lists
 * reads them the same way: the name, then what it has waiting, then when it was last
 * looked at.
 *
 * Every string arrives translated and every date arrives formatted, so the dictionary and
 * the request's language stay with the controller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { bg, borderEdge, colorMix, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, flexWrap, gap, grow, items, shrink, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { maxIs, mbs, minIs, mis, p, pb, pi } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { color } from "@sdxc/u/tokens";
import { nowrap, text, textAlign, textDecoration, truncate, weight } from "@sdxc/u/typography";
import { Badge, Button, Card, Empty, TextField } from "@sdxc/ui";

import { PAGE_COLUMN, pageBleed } from "~/resources/layouts/app";
import routes from "~/routes/web";

/**
 * The follow form's own id, which its submit names from outside it. Fixed rather than
 * generated: one page renders one follow form.
 */
const FOLLOW_FORM_ID = "follow-feed";

/**
 * The fill a row takes under the pointer: the rule between rows thinned until it reads as
 * a shade of the page rather than a band across it, which keeps it the same weight on a
 * light page and a dark one.
 */
const ROW_HOVER = colorMix("oklab", { color: color("neutral.border"), weight: 25 }, "transparent");

/**
 * Where a row has the width for its name, its count and its last check on one line. Below
 * it the name keeps the line to itself and the rest drops underneath.
 */
const WIDE_ROW = "(min-width: 34rem)";

/**
 * Least width of the column holding the last check, which is what lines the dates up. A
 * phrase longer than this takes the room it needs rather than reaching back over the name.
 */
const CHECKED_COLUMN = "6rem";

/** What a feed nobody has checked yet shows where a date would be. */
const NO_DATE = "—";

export namespace FeedList {
	/** One followed feed, with every label already resolved to the text that is printed. */
	export interface Entry {
		id: string;
		title: string;
		description: string | null;
		/**
		 * How many posts are waiting, or `null` for a feed with none. A count that says
		 * "nothing" on every row of a list somebody has read is a row of noise.
		 */
		unreadLabel: string | null;
		/** How long ago it was last checked, or `null` for a feed nobody has checked. */
		checked: string | null;
		/** The full date of that check, which the short one stands for. */
		checkedLabel: string;
		/** Why the last checks failed, or `null` for a feed that is fine. */
		failureLabel: string | null;
	}

	/** The follow form's translated copy, and the refusal it is re-rendered with. */
	export interface FollowCopy {
		label: string;
		description: string;
		placeholder: string;
		submit: string;
		/** Why the last submission was refused, shown against the field. */
		error: string | null;
		/** What was submitted, put back so a typo is corrected rather than retyped. */
		value: string | null;
	}

	/** The copy for an empty list, shown in place of it. */
	export interface EmptyCopy {
		title: string;
		description: string;
	}

	/** Where the subscriptions either side of this page live, and what the links to them read. */
	export interface Paging {
		/** The page of newer subscriptions, or `null` on the newest one. */
		newer: string | null;
		/** The page of older subscriptions, or `null` on the oldest one. */
		older: string | null;
		newerLabel: string;
		olderLabel: string;
	}

	export interface Props {
		entries: Entry[];
		follow: FollowCopy;
		empty: EmptyCopy;
		/** Names the sweep of every followed feed. */
		checkAll: string;
		paging: Paging;
	}
}

/**
 * Renders the follow form and the sweep of every feed, then either the followed feeds or
 * the note that there are none, then the links to the pages either side of this one.
 */
export default function FeedList(handle: Handle<FeedList.Props>) {
	return () => {
		let { checkAll, empty, entries, follow, paging } = handle.props;

		return (
			<div mix={[vstack({ gap: 6 })]}>
				{/**
				 * Both ways of acting on the collection sit above it, so neither costs a scroll past
				 * every feed the reader follows. The field spans the card so its hint and its
				 * refusal are the width of the input they belong to, and the submit sits at the end
				 * of the row under it, where a form puts the thing that finishes it.
				 */}
				{/** The rows take the window; one field asking for an address does not. */}
				<Card mix={[p(4), maxIs(PAGE_COLUMN)]}>
					<div mix={[vstack({ gap: 3, align: "stretch" })]}>
						<form id={FOLLOW_FORM_ID} method="post" action={routes.feeds.follow.href()}>
							<TextField
								type="url"
								name="url"
								label={follow.label}
								description={follow.description}
								placeholder={follow.placeholder}
								defaultValue={follow.value ?? undefined}
								errorMessage={follow.error ?? undefined}
								required
								autoComplete="url"
							/>
						</form>

						{/**
						 * Both actions on one row under the field, reading left to right in the order a
						 * reader wants them: following is why they opened this page, checking is the
						 * occasional errand, so the second is quiet against the first rather than
						 * stranded at the other end of the card.
						 *
						 * The submit sits outside its own form and names it, which is what lets the two
						 * share a row: a form cannot nest inside another.
						 *
						 * A sweep reaches out to every origin the reader follows, so it is submitted
						 * rather than followed — a prefetcher and a mail scanner walk links of their
						 * own accord.
						 */}
						<div mix={[flex(), items("center"), flexWrap("wrap"), gap(2)]}>
							<Button type="submit" form={FOLLOW_FORM_ID}>
								{follow.submit}
							</Button>

							<form method="post" action={routes.feeds.refreshAll.href()}>
								{/** Same size as the submit it sits beside; the quiet fill is what ranks it. */}
								<Button type="submit" color="neutral" variant="ghost">
									{checkAll}
								</Button>
							</form>
						</div>
					</div>
				</Card>

				{entries.length === 0 ? (
					<Empty>
						<Empty.Title>{empty.title}</Empty.Title>
						<Empty.Description>{empty.description}</Empty.Description>
					</Empty>
				) : (
					/**
					 * A row carries its own inline padding, so on a screen no wider than the page's
					 * column the list takes the gutter back: the names keep their place and the rules
					 * between rows run the full width of the screen.
					 */
					<ul mix={[p(0), pageBleed()]}>
						{entries.map((entry) => (
							<li
								key={entry.id}
								mix={[
									pb(2),
									pi(2),
									rounded("md"),
									borderEdge("block-end", { color: "neutral.border", width: 1 }),
									hover(bg(ROW_HOVER)),
								]}
							>
								<div mix={[media(WIDE_ROW, [flex(), items("baseline"), gap(3)])]}>
									{/**
									 * A feed with posts waiting wears the page's strongest foreground and one
									 * that is read through settles back to body copy, which is the rule the
									 * posts themselves follow.
									 */}
									<div
										mix={[
											grow(),
											minIs(0),
											truncate(),
											text("sm"),
											fg(entry.unreadLabel ? "neutral.emphasis" : "neutral"),
										]}
									>
										<a
											href={routes.feeds.show.href({ feedId: entry.id })}
											mix={[
												weight("medium"),
												fg("inherit"),
												textDecoration("none"),
												hover([fg("brand"), textDecoration("underline")]),
											]}
										>
											{entry.title}
										</a>

										{/** What the feed says it is, carried on the name's own line and clipped
										 * with it, so a list of fifty feeds stays a list of fifty lines. */}
										{entry.description && (
											<span mix={[mis(2), fg("neutral.muted")]}>{entry.description}</span>
										)}
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
										{entry.failureLabel && (
											<Badge color="danger" variant="secondary">
												{entry.failureLabel}
											</Badge>
										)}

										{entry.unreadLabel && (
											<Badge color="brand" variant="secondary">
												{entry.unreadLabel}
											</Badge>
										)}

										<span
											title={entry.checkedLabel}
											mix={[nowrap(), media(WIDE_ROW, [minIs(CHECKED_COLUMN), textAlign("end")])]}
										>
											{entry.checked ?? NO_DATE}
										</span>
									</div>
								</div>
							</li>
						))}
					</ul>
				)}

				{(paging.newer ?? paging.older) && (
					<nav mix={[flex(), items("center"), gap(3), p(2, 0)]}>
						{paging.newer && (
							<a
								href={paging.newer}
								rel="prev"
								mix={[
									p(2, 3),
									rounded("md"),
									fg("brand"),
									textDecoration("none"),
									hover(textDecoration("underline")),
								]}
							>
								{paging.newerLabel}
							</a>
						)}

						<span aria-hidden="true" mix={[grow()]} />

						{paging.older && (
							<a
								href={paging.older}
								rel="next"
								mix={[
									p(2, 3),
									rounded("md"),
									fg("brand"),
									textDecoration("none"),
									hover(textDecoration("underline")),
								]}
							>
								{paging.olderLabel}
							</a>
						)}
					</nav>
				)}
			</div>
		);
	};
}
