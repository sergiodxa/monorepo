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

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, flexWrap, gap, grow, items, justify, vstack } from "@sdxc/u/layout";
import { maxIs, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { leading, text, textDecoration, weight } from "@sdxc/u/typography";
import { Button, Card, Text } from "@sdxc/ui";

import routes from "~/routes/web";

export namespace Timeline {
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
		read: string;
		newer: string;
		older: string;
	}

	export interface Props {
		entries: Entry[];
		copy: Copy;
		/** The page the mark-read form returns to, which is the page being rendered. */
		returnTo: string;
		/** The URL of the page holding older and newer posts, or `null` at either end. */
		cursors: { next: string | null; prev: string | null };
	}
}

/**
 * The mark-read control. A form rather than a link, since following it changes what the
 * reader has read, and a link is what a prefetcher and a mail scanner follow on their own.
 */
function ReadToggle(
	handle: Handle<{ id: string; isRead: boolean; label: string; returnTo: string }>,
) {
	return () => {
		let { id, isRead, label, returnTo } = handle.props;

		return (
			<form method="post" action={routes.items.read.href({ itemId: id })}>
				<input type="hidden" name="returnTo" value={returnTo} />
				<input type="hidden" name="read" value={isRead ? "false" : "true"} />
				<Button type="submit" color="neutral" variant="outline" size="sm">
					{label}
				</Button>
			</form>
		);
	};
}

/** Renders one page of posts and the links to the pages either side of it. */
export default function Timeline(handle: Handle<Timeline.Props>) {
	return () => {
		let { copy, cursors, entries, returnTo } = handle.props;

		return (
			<div mix={[vstack({ gap: 4 })]}>
				<ol mix={[vstack({ gap: 4 }), p(0)]}>
					{entries.map((entry) => (
						<li key={entry.id} mix={[vstack({ gap: 0 })]}>
							<Card mix={[p(4), entry.isRead ? fg("neutral.muted") : bg("neutral.bg")]}>
								<article mix={[vstack({ gap: 2 })]}>
									<h2 mix={[text("base"), weight("semibold"), leading("snug")]}>
										{entry.url ? (
											<a
												href={entry.url}
												rel="noreferrer"
												mix={[
													fg(entry.isRead ? "neutral.muted" : "neutral.emphasis"),
													textDecoration("none"),
													hover(textDecoration("underline")),
												]}
											>
												{entry.title}
											</a>
										) : (
											entry.title
										)}
									</h2>

									{entry.meta.length > 0 && (
										<Text mix={[text("xs"), fg("neutral.muted")]}>{entry.meta.join(" · ")}</Text>
									)}

									{entry.summary && (
										<Text mix={[text("sm"), leading("relaxed"), maxIs("42rem")]}>
											{entry.summary}
										</Text>
									)}

									<div mix={[flex(), items("center"), flexWrap("wrap"), gap(2)]}>
										<ReadToggle
											id={entry.id}
											isRead={entry.isRead}
											label={entry.isRead ? copy.markUnread : copy.markRead}
											returnTo={returnTo}
										/>

										{entry.isRead && (
											<Text mix={[text("xs"), fg("neutral.muted")]}>{copy.read}</Text>
										)}
									</div>
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
