/**
 * The list of followed feeds, and the form that follows another one. Both the feed index
 * and the failed follow render it: a refused URL is answered with the page it was
 * submitted from, carrying the reason, so the list and the form stay one piece of markup.
 *
 * Every string arrives translated and every date arrives formatted, so the dictionary and
 * the request's language stay with the controller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { flex, flexWrap, gap, items, self, vstack } from "@sdxc/u/layout";
import { maxIs, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { leading, text, textDecoration, weight } from "@sdxc/u/typography";
import { Badge, Button, Card, Empty, Text, TextField } from "@sdxc/ui";

import routes from "~/routes/web";

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

	export interface Props {
		entries: Entry[];
		follow: FollowCopy;
		empty: EmptyCopy;
	}
}

/** Renders the follow form, then either the followed feeds or the note that there are none. */
export default function FeedList(handle: Handle<FeedList.Props>) {
	return () => {
		let { empty, entries, follow } = handle.props;

		return (
			<div mix={[vstack({ gap: 6 })]}>
				{/**
				 * The field spans the card so its hint and its refusal are the width of the input
				 * they belong to, and the submit sits at the end of the row under it, where a form
				 * puts the thing that finishes it.
				 */}
				<Card mix={[p(4)]}>
					<form
						method="post"
						action={routes.feeds.follow.href()}
						mix={[vstack({ gap: 3, align: "stretch" })]}
					>
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

						<Button type="submit" mix={[self("end")]}>
							{follow.submit}
						</Button>
					</form>
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
			</div>
		);
	};
}
