/**
 * "Auto-refresh: 30s ▾" for a live list: a menu of intervals whose choice lives in the URL (or
 * wherever `hrefFor` points, such as a cookie endpoint), and the time the list was last
 * fetched, which an island advances while it reloads a frame or the page on that interval.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps } from "remix/component";

import { ChevronDownIcon, RefreshCwIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { mergeMix } from "@sdxc/u/general";
import { flex, flexWrap, gap, items, shrink } from "@sdxc/u/layout";
import { when } from "@sdxc/u/state";
import { nowrap, tabularNums, text, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { Button } from "../components/button.js";
import { Menu } from "../components/menu.js";

import { autoRefresh } from "./mixins/auto-refresh.js";
import { paramValues, setParamHref } from "./utils/search-params.js";

/** The search parameter holding the interval, in seconds, when `name` is unset. */
const DEFAULT_PARAM = "refresh";

/** The interval in seconds while the URL names none: off. */
const DEFAULT_VALUE = 0;

/** The intervals offered when `options` is unset: none, leaving the last-updated time. */
const DEFAULT_OPTIONS: AutoRefresh.Option[] = [];

/** The URL read when `url` is unset: a page with nothing chosen. */
const DEFAULT_URL = "/";

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
		/** Before the last-fetched time, such as "Updated". */
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
		/** The named frame to reload; unset reloads the page through its top frame. */
		frame?: string;
		/** When the list on screen was fetched. Defaults to the time of rendering. */
		refreshedAt?: Date;
		/** Locale for the time. Defaults to the runtime's. */
		locale?: string;
		/** Time zone the server writes the first time in. Defaults to the runtime's. */
		timeZone?: string;
		labels: Labels;
	}

	/** Props {@link AutoRefreshStatus} serializes for hydration, which is why they are a `type`. */
	export type StatusProps = {
		/** Milliseconds between reloads; 0 never reloads. */
		every: number;
		frame?: string;
		/** The lead before the time. */
		label: string;
		/** ISO timestamp of the content on screen. */
		refreshedAt: string;
		/** That time as the server wrote it. */
		text: string;
		locale?: string;
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
 * 	labels={{ trigger: "Auto-refresh", updated: "Updated" }}
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
				<AutoRefreshStatus
					every={current * 1000}
					frame={frame}
					label={labels.updated}
					refreshedAt={time.toISOString()}
					text={new Intl.DateTimeFormat(locale, { timeStyle: "medium", timeZone }).format(time)}
					locale={locale}
				/>
			</div>
		);
	};
}

/**
 * The island naming when the list was fetched. Once hydrated it reloads the `frame` it names,
 * or the page, every `every` milliseconds while the tab is visible, and rewrites the time after
 * each reload. Load `@sdxc/ui/app/auto-refresh` in the browser entry.
 *
 * @example <AutoRefreshStatus every={30_000} label="Updated" refreshedAt={iso} text="10:42:07" />
 */
export const AutoRefreshStatus: EntryComponent<AutoRefresh.StatusProps> = clientEntry(
	"@sdxc/ui/app/auto-refresh#AutoRefreshStatus",
	function AutoRefreshStatus(handle: Handle<AutoRefresh.StatusProps>) {
		/** Reloads the named frame, or the page when none is named or found. */
		let reload = async () => {
			let target = handle.props.frame ? handle.frames.get(handle.props.frame) : undefined;
			await (target ?? handle.frames.top).reload();
		};

		return () => {
			let { every, label, refreshedAt, text: written, locale } = handle.props;
			return (
				<span data-slot="auto-refresh-status" mix={[fg("neutral.muted"), nowrap(), tabularNums()]}>
					{label}{" "}
					<time dateTime={refreshedAt} mix={[autoRefresh({ every, reload, locale })]}>
						{written}
					</time>
				</span>
			);
		};
	},
);
