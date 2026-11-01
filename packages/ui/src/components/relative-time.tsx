/**
 * A `<time>` that reads "2m ago" for the last week and a date after it, with the absolute local
 * time and UTC in its title. The server renders it from an explicit `now` and zone, and an
 * optional island rewrites it in the viewer's own zone, the one thing a server cannot know.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps } from "remix/component";

import { mergeMix } from "@sdxc/u/general";
import { tabularNums } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import type { RelativeTimeFormat } from "../utils/relative-time.js";

import { viewerTime } from "../mixins/viewer-time.js";
import { formatRelativeTime } from "../utils/relative-time.js";

export { formatRelativeTime } from "../utils/relative-time.js";

/**
 * Prop types for {@link RelativeTime} and its island.
 */
export namespace RelativeTime {
	/** A moment as a `Date`, an ISO 8601 string or epoch milliseconds. */
	export type DateInput = RelativeTimeFormat.DateInput;

	/**
	 * Every native `<time>` attribute but `dateTime`, which the component writes, plus the
	 * moment and how to format it.
	 */
	export interface Props extends Omit<TagProps<"time">, "dateTime" | "children"> {
		/** The moment to show. */
		date: DateInput;
		/** The reference moment; pass the request's time so server and tests render the same text. */
		now?: DateInput;
		/** BCP 47 locale for the text and the title. */
		locale?: string;
		/** IANA zone the server formats in. Defaults to UTC. */
		timeZone?: string;
		/**
		 * Hydrates the {@link RelativeTimeLocal} island, which rewrites the date and title in the
		 * viewer's zone and locale, counting from `now` when given and their clock otherwise.
		 * Needs `@sdxc/ui/relative-time#RelativeTimeLocal` in the app's browser entry.
		 */
		local?: boolean;
	}

	/** Props {@link RelativeTimeLocal} serializes for hydration, so they stay plain JSON. */
	export type LocalProps = {
		/** The moment, as an ISO 8601 string or epoch milliseconds. */
		date: string | number;
		/** The reference moment the text counts from; unset counts from the viewer's clock. */
		now?: string | number;
		/** BCP 47 locale for the text and the title. */
		locale?: string;
		/** IANA zone the server rendered in. */
		timeZone?: string;
		/** Accessible description, passed through to the `<time>`. */
		"aria-label"?: string;
		/** Element id, passed through to the `<time>`. */
		id?: string;
	};
}

/**
 * Renders the moment as `<time datetime>` with its text and absolute title. With `local` it
 * hands the same props to {@link RelativeTimeLocal}, so the server HTML is identical and the
 * viewer's zone replaces the server's once the island hydrates.
 *
 * @param handle Runtime handle carrying the `<time>`'s props.
 * @returns The render function producing the element.
 * @example <RelativeTime date={check.at} now={ctx.requestTime} locale={locale} />
 * @example <RelativeTime date={deploy.createdAt} now={now} locale={locale} local />
 */
export function RelativeTime(handle: Handle<RelativeTime.Props>) {
	return () => {
		let { date, now, locale, timeZone, local, mix, ...rest } = handle.props;

		if (local) {
			return (
				<RelativeTimeLocal
					date={serializable(date)}
					now={now === undefined ? undefined : serializable(now)}
					locale={locale}
					timeZone={timeZone}
					aria-label={rest["aria-label"]}
					id={rest.id}
				/>
			);
		}

		let formatted = formatRelativeTime(date, { now, locale, timeZone });

		return (
			<time
				title={formatted.title || undefined}
				{...rest}
				dateTime={formatted.dateTime || undefined}
				data-slot="relative-time"
				mix={mergeMix(tabularNums(), mix)}
			>
				{formatted.text}
			</time>
		);
	};
}

/** Turns a `Date` into its ISO string so an island prop survives serialization. */
function serializable(value: RelativeTime.DateInput): string | number {
	return value instanceof Date ? value.toISOString() : value;
}

/**
 * Client island behind {@link RelativeTime}'s `local` prop: the same `<time>` the server renders,
 * rewritten in the viewer's zone on hydration, still counting from `now` when one is given.
 * Until the island loads the server's text stands, so the moment is always readable.
 *
 * @example <RelativeTimeLocal date="2026-10-30T14:00:00Z" locale="en" />
 */
export const RelativeTimeLocal: EntryComponent<RelativeTime.LocalProps> = clientEntry(
	"@sdxc/ui/relative-time#RelativeTimeLocal",
	function RelativeTimeLocal(handle: Handle<RelativeTime.LocalProps>) {
		return () => {
			let { date, now, locale, timeZone, ...rest } = handle.props;
			let formatted = formatRelativeTime(date, { now, locale, timeZone });

			return (
				<time
					{...rest}
					title={formatted.title || undefined}
					dateTime={formatted.dateTime || undefined}
					data-slot="relative-time"
					mix={[tabularNums(), viewerTime(locale, now)]}
				>
					{formatted.text}
				</time>
			);
		};
	},
);
