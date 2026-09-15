/**
 * Turns the posts a store answered with into the rows a timeline prints, and the short
 * times that run down the column beside them.
 *
 * The queue, a single feed and a search show the same row and differ only in where their
 * posts came from, so the mapping lives here and each controller says whether its posts
 * come from more than one feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@sdxc/i18n";

import type { UserStore } from "~/database/user-do";
import type { Timeline } from "~/resources/views/timeline";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How recent a post has to be for the column to say how long ago it arrived. Inside a
 * week "two days ago" places a post against the reader's own morning; past it, the day
 * it was published is the thing they remember it by.
 */
const RELATIVE_WINDOW = 7 * DAY;

/** What building a row needs off the request. */
export interface TimelineContext {
	i18next: i18n;
	locale: string;
}

/**
 * How long ago something happened, in the largest unit that still counts something:
 * minutes inside the hour, hours inside the day, days beyond that. Anything under a
 * minute reads as a minute, which is the smallest amount of time worth naming here.
 *
 * @param elapsed - Milliseconds since the moment being described.
 * @param locale - The request's language, which words and orders the phrase.
 */
function ago(elapsed: number, locale: string): string {
	let relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

	if (elapsed < HOUR) return relative.format(-Math.max(1, Math.round(elapsed / MINUTE)), "minute");
	if (elapsed < DAY) return relative.format(-Math.round(elapsed / HOUR), "hour");
	return relative.format(-Math.round(elapsed / DAY), "day");
}

/**
 * The date as a column of a list carries it: how long ago it was while that still places
 * it, then the day it fell on, and the year as well once the year is a different one.
 *
 * @param moment - Epoch milliseconds of the thing being dated.
 * @param locale - The request's language, which words and orders the result.
 * @param now - The moment the page is being rendered at, which the date is read against.
 * @returns A phrase short enough to scan down a column, such as `3 hours ago` or `Jan 2`.
 * @example shortDate(item.publishedAt, ctx.locale, Date.now());
 */
export function shortDate(moment: number, locale: string, now: number): string {
	let elapsed = now - moment;
	if (elapsed >= 0 && elapsed < RELATIVE_WINDOW) return ago(elapsed, locale);

	let isThisYear = new Date(now).getFullYear() === new Date(moment).getFullYear();

	return new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
		year: isThisYear ? undefined : "numeric",
	}).format(moment);
}

/**
 * The full date, which is what a short one stands for and what its tooltip spells out.
 *
 * @param moment - Epoch milliseconds of the thing being dated.
 * @param locale - The request's language, which words and orders the result.
 * @example exactDate(feed.lastFetchedAt, ctx.locale);
 */
export function exactDate(moment: number, locale: string): string {
	return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(moment);
}

/**
 * Builds one page of timeline rows from the posts a store answered with.
 *
 * @param ctx - The request's dictionary and language, which every label is resolved through.
 * @param items - The posts to print, in the order they are printed.
 * @param feedTitles - Feed titles by id for a surface holding posts from many feeds; `null`
 * on a surface showing one feed, whose every row would otherwise name the same source.
 * @example timelineEntries(ctx, page.items, new Map(page.feeds.map((f) => [f.id, f.title])));
 */
export function timelineEntries(
	ctx: TimelineContext,
	items: UserStore.Item[],
	feedTitles: Map<string, string> | null,
): Timeline.Entry[] {
	let now = Date.now();

	return items.map((item) => {
		/**
		 * Inside one feed the source is the same word on every row, so the author is what
		 * tells one post from the next there.
		 */
		let source: string | null = null;
		if (feedTitles) source = feedTitles.get(item.feedId) ?? null;
		else if (item.author) source = ctx.i18next.t("timeline.byAuthor", { author: item.author });

		return {
			id: item.id,
			title: item.title,
			url: item.url,
			source,
			summary: item.summary,
			time: shortDate(item.publishedAt, ctx.locale, now),
			timeLabel: ctx.i18next.t("timeline.publishedOn", {
				date: exactDate(item.publishedAt, ctx.locale),
			}),
			dateTime: new Date(item.publishedAt).toISOString(),
			isRead: item.readAt !== null,
		};
	});
}
