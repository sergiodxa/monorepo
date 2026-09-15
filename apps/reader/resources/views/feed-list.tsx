/**
 * The list of followed feeds, the form that follows another one, the control that checks
 * them all, and the links that walk the list a page at a time. Both the feed index and the
 * failed follow render it: a refused URL is answered with the page it was submitted from,
 * carrying the reason, so the list and the form stay one piece of markup.
 *
 * Every string arrives translated and every date arrives formatted, so the dictionary and
 * the request's language stay with the controller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, flexWrap, gap, grow, items, vstack } from "@sdxc/u/layout";
import { maxIs, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { leading, text, textDecoration, weight } from "@sdxc/u/typography";
import { Badge, Button, Card, Empty, Text, TextField } from "@sdxc/ui";

import routes from "~/routes/web";

/**
 * The follow form's own id, which its submit names from outside it. Fixed rather than
 * generated: one page renders one follow form.
 */
const FOLLOW_FORM_ID = "follow-feed";

export namespace FeedList {
	/** One followed feed, with every label already resolved to the text that is printed. */
	export interface Entry {
		id: string;
		title: string;
		description: string | null;
		/** Unread count or the all-read note, whichever this feed has earned. */
		unreadLabel: string;
		/** Whether anything in this feed is unread, which decides how the count reads. */
		hasUnread: boolean;
		/** When it was last checked, or that it has not been. */
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
				<Card mix={[p(4)]}>
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
								<Button type="submit" color="neutral" variant="ghost" size="sm">
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
					<ul mix={[vstack({ gap: 3 }), p(0)]}>
						{entries.map((entry) => (
							<li key={entry.id}>
								<Card mix={[p(4)]}>
									<div mix={[vstack({ gap: 2 })]}>
										<div mix={[flex(), items("center"), flexWrap("wrap"), gap(2)]}>
											<a
												href={routes.feeds.show.href({ feedId: entry.id })}
												mix={[
													text("base"),
													weight("semibold"),
													fg("neutral.emphasis"),
													textDecoration("none"),
													hover(textDecoration("underline")),
												]}
											>
												{entry.title}
											</a>

											<Badge color={entry.hasUnread ? "brand" : "neutral"} variant="secondary">
												{entry.unreadLabel}
											</Badge>
										</div>

										{entry.description && (
											<Text mix={[text("sm"), leading("relaxed"), maxIs("42rem")]}>
												{entry.description}
											</Text>
										)}

										<div mix={[flex(), items("center"), flexWrap("wrap"), gap(2)]}>
											<Text mix={[text("xs"), fg("neutral.muted")]}>{entry.checkedLabel}</Text>

											{entry.failureLabel && (
												<Badge color="danger" variant="secondary">
													{entry.failureLabel}
												</Badge>
											)}
										</div>
									</div>
								</Card>
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
