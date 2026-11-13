/**
 * "Auto-refresh: 30s ▾" for a live list: a menu of intervals whose choice lives in the URL (or
 * wherever `hrefFor` points, such as a cookie endpoint), and the time the list was last
 * fetched, which an island advances while it reloads a frame or the page on that interval.
 * Either half renders alone, so the intervals can sit in a View menu and the time beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps } from "remix/component";

import { ChevronDownIcon, RefreshCwIcon } from "@sdxc/icons";
import { bg, fg, outline } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { mergeMix } from "@sdxc/u/general";
import { flex, flexWrap, gap, inlineFlex, items, justify, shrink } from "@sdxc/u/layout";
import { bs, minIs, p, pi } from "@sdxc/u/size";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { nowrap, tabularNums, text, textDecoration, truncate, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { Button } from "../components/button.js";
import { Menu } from "../components/menu.js";
import { interactiveTransition } from "../styles/interactive-transition.js";

import { autoRefresh } from "./mixins/auto-refresh.js";
import { paramValues, setParamHref } from "./utils/search-params.js";

/** The search parameter holding the interval, in seconds, when `name` is unset. */
const DEFAULT_PARAM = "refresh";

/** The interval in seconds while the URL names none: off. */
const DEFAULT_VALUE = 0;

/** The intervals offered when `options` is unset: none, leaving the last-updated time. */
const DEFAULT_OPTIONS: AutoRefresh.Option[] = [];

/** What the control draws when `show` is unset: the interval menu and the time. */
const DEFAULT_SHOW = "all";

/** The URL read when `url` is unset: a page with nothing chosen. */
const DEFAULT_URL = "/";

/** The placeholder in `labels.updated` that the refreshed-at time replaces. */
const TIME_SLOT = "{time}";

/** Prop types for {@link AutoRefresh} and {@link AutoRefreshStatus}. */
export namespace AutoRefresh {
	/** An interval the menu offers. */
	export interface Option {
		/** Seconds between reloads; 0 is off. */
		value: number;
		/** Its name in the menu and on the trigger, such as "30s" or "Off". */
		label: string;
	}

	/** Every string the control shows. */
	export interface Labels {
		/** The trigger's lead and the menu's name, such as "Auto-refresh". */
		trigger: string;
		/**
		 * The status line, with `{time}` where the last-fetched time goes, such as
		 * "Updated {time}" or "{time} — last fetch"; text without `{time}` leads the time.
		 */
		updated: string;
	}

	/** Props accepted by {@link AutoRefresh}; the host is a `<div>`. */
	export interface Props extends Omit<TagProps<"div">, "children" | "id"> {
		/** Prefix for the menu id; unique on the page. */
		id: string;
		/** The page's current URL, which holds the choice. @default "/" */
		url?: URL | string;
		/** The search parameter holding the interval. @default "refresh" */
		name?: string;
		/** The interval in force, overriding the URL, for a choice stored in a cookie. */
		value?: number;
		/** The interval while neither `value` nor the URL names one. @default 0 */
		defaultValue?: number;
		/** The intervals offered, such as Off, 10s, 30s, 1m and 5m. */
		options?: Option[];
		/** Where choosing `value` leads; defaults to the URL with the parameter set (removed for the default). */
		hrefFor?: (value: number) => string;
		/** The named frame to reload; unset reloads the page through its top frame. A name not on the page reloads nothing. */
		frame?: string;
		/** When the list on screen was fetched. Defaults to the time of rendering. */
		refreshedAt?: Date;
		/** Locale for the time. Defaults to the runtime's. */
		locale?: string;
		/** Time zone the server writes the first time in. Defaults to the runtime's. */
		timeZone?: string;
		/**
		 * Which half to draw: `"all"`, the interval menu and the time; `"choices"`, the intervals
		 * as a row of links for a menu that already has a trigger; `"status"`, the time alone,
		 * which does the reloading, so a page drawing `"choices"` draws `"status"` too.
		 *
		 * @default "all"
		 */
		show?: Show;
		labels: Labels;
	}

	/** The halves {@link AutoRefresh} can draw; see `Props.show`. */
	export type Show = "all" | "choices" | "status";

	/** Props {@link AutoRefreshStatus} serializes for hydration, which is why they are a `type`. */
	export type StatusProps = {
		/** Milliseconds between reloads; 0 never reloads. */
		every: number;
		frame?: string;
		/** The status template; `{time}` marks where the time sits, else the text leads it. */
		label: string;
		/** ISO timestamp of the content on screen. */
		refreshedAt: string;
		/** That time as the server wrote it. */
		text: string;
		locale?: string;
		/** The zone the time is written in; the reader's own once hydrated when unset. */
		timeZone?: string;
	};
}

/**
 * Renders the interval menu and the last-updated time. Each menu item is a link, so a choice
 * works without script and lands in the URL; the time island does the reloading.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the control.
 * @example
 * <AutoRefresh
 * 	id="monitors-refresh"
 * 	url={request.url}
 * 	frame="monitor-list"
 * 	refreshedAt={new Date()}
 * 	options={[{ value: 0, label: "Off" }, { value: 30, label: "30s" }, { value: 60, label: "1m" }]}
 * 	labels={{ trigger: "Auto-refresh", updated: "Updated {time}" }}
 * />
 */
export function AutoRefresh(handle: Handle<AutoRefresh.Props>) {
	return () => {
		let {
			id,
			url = DEFAULT_URL,
			name = DEFAULT_PARAM,
			value,
			defaultValue = DEFAULT_VALUE,
			options = DEFAULT_OPTIONS,
			hrefFor,
			frame,
			refreshedAt,
			locale,
			timeZone,
			show = DEFAULT_SHOW,
			labels,
			mix,
			...rest
		} = handle.props;
		let menuId = `${id}-menu`;
		let fromUrl = Number(paramValues(url, name)[0]);
		let current =
			value ?? (options.some((option) => option.value === fromUrl) ? fromUrl : defaultValue);
		let currentLabel = options.find((option) => option.value === current)?.label ?? "";
		let linkFor =
			hrefFor ??
			((seconds: number) =>
				setParamHref(url, name, seconds === defaultValue ? null : String(seconds), []));
		let time = refreshedAt ?? new Date();

		let status = (
			<AutoRefreshStatus
				every={current * 1000}
				frame={frame}
				label={labels.updated}
				refreshedAt={time.toISOString()}
				text={new Intl.DateTimeFormat(locale, { timeStyle: "medium", timeZone }).format(time)}
				locale={locale}
				timeZone={timeZone}
			/>
		);

		if (show === "status") {
			return (
				<div
					{...rest}
					data-slot="auto-refresh"
					data-interval={current}
					mix={mergeMix([minIs(0), truncate()], mix)}
				>
					{status}
				</div>
			);
		}

		if (show === "choices") {
			return (
				<div {...rest} data-slot="auto-refresh" data-interval={current} mix={mergeMix([], mix)}>
					<div
						role="group"
						aria-label={labels.trigger}
						data-slot="auto-refresh-choices"
						mix={[flex(), items("center"), justify("between"), gap(3), text("sm")]}
					>
						<span aria-hidden="true" mix={[fg("neutral"), nowrap()]}>
							{labels.trigger}
						</span>
						<span
							mix={[
								inlineFlex(),
								p(0.5),
								gap(0.5),
								rounded("md"),
								bg("neutral.bg-tint-hover"),
								minIs(0),
							]}
						>
							{options.map((option) => (
								<a
									href={linkFor(option.value)}
									aria-current={option.value === current ? "true" : undefined}
									mix={[
										interactiveTransition(),
										inlineFlex(),
										items("center"),
										bs(7),
										pi(2),
										rounded("sm"),
										fg("neutral"),
										textDecoration("none"),
										tabularNums(),
										nowrap(),
										hover(fg("neutral.emphasis")),
										focusVisible(outline({ color: "brand.ring", offset: 1 })),
										when('&[aria-current="true"]', [
											bg("neutral.tint"),
											fg("neutral.emphasis"),
											shadow("sm"),
										]),
									]}
								>
									{option.label}
								</a>
							))}
						</span>
					</div>
				</div>
			);
		}

		return (
			<div
				{...rest}
				data-slot="auto-refresh"
				data-interval={current}
				mix={mergeMix([flex(), flexWrap(), items("center"), gap(2), text("sm")], mix)}
			>
				<Button
					variant="ghost"
					size="sm"
					commandfor={menuId}
					command="toggle-popover"
					data-slot="auto-refresh-trigger"
					mix={[fg("neutral"), weight(400), shrink(0), when("& > svg", fg("neutral.muted"))]}
				>
					<RefreshCwIcon size={16} aria-hidden="true" />
					{labels.trigger}
					<span data-slot="value" mix={[fg("neutral.emphasis"), weight(500), tabularNums()]}>
						{currentLabel}
					</span>
					<ChevronDownIcon size={14} aria-hidden="true" />
				</Button>
				<Menu id={menuId} placement="bottom-end" aria-label={labels.trigger}>
					{options.map((option) => (
						<Menu.Item
							href={linkFor(option.value)}
							role="menuitemradio"
							aria-checked={option.value === current ? "true" : "false"}
						>
							{option.label}
						</Menu.Item>
					))}
				</Menu>
				{status}
			</div>
		);
	};
}

/**
 * The island naming when the list was fetched. Once hydrated it reloads the `frame` it names,
 * or the page, every `every` milliseconds while the tab is visible, and rewrites the time after
 * each reload. Load `@sdxc/ui/app/auto-refresh` in the browser entry.
 *
 * @example <AutoRefreshStatus every={30_000} label="Updated {time}" refreshedAt={iso} text="10:42:07" />
 */
export const AutoRefreshStatus: EntryComponent<AutoRefresh.StatusProps> = clientEntry(
	"@sdxc/ui/app/auto-refresh#AutoRefreshStatus",
	function AutoRefreshStatus(handle: Handle<AutoRefresh.StatusProps>) {
		/** Reloads the named frame, or the page when none is named; a named frame not on the page is left alone. */
		let reload = async () => {
			let name = handle.props.frame;
			if (name === undefined) await handle.frames.top.reload();
			else await handle.frames.get(name)?.reload();
		};

		return () => {
			let { every, label, refreshedAt, text: written, locale, timeZone } = handle.props;
			let [before, after] = aroundTime(label);
			return (
				<span data-slot="auto-refresh-status" mix={[fg("neutral.muted"), nowrap(), tabularNums()]}>
					{before}
					<time dateTime={refreshedAt} mix={[autoRefresh({ every, reload, locale, timeZone })]}>
						{written}
					</time>
					{after}
				</span>
			);
		};
	},
);

/**
 * Splits the status template at its first `{time}` into the text before and after the time, so
 * a translation can put the time anywhere; a template without `{time}` reads "<text> <time>",
 * and an unset one shows the time alone.
 *
 * @param label The `labels.updated` template.
 * @returns The text before the time and the text after it.
 */
function aroundTime(label: string | undefined): [before: string, after: string] {
	if (label === undefined) return ["", ""];
	let at = label.indexOf(TIME_SLOT);
	if (at === -1) return [`${label} `, ""];
	return [label.slice(0, at), label.slice(at + TIME_SLOT.length)];
}
