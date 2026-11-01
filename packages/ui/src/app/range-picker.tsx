/**
 * The time range for a dashboard, kept in the URL: preset ranges as a segmented control of
 * GET-form buttons with letter-key hints, a Custom entry that opens a date range in a
 * popover, and a native select in its place when the container is narrow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { CalendarIcon } from "@sdxc/icons";
import { bg, border } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { cursor, mergeMix, raw } from "@sdxc/u/general";
import { container, hstack, inlineFlex, items, vstack } from "@sdxc/u/layout";
import { bs, is, maxIs, minIs, mis, p, pi } from "@sdxc/u/size";
import { focusVisible } from "@sdxc/u/state";
import { nowrap, tabularNums, text, weight } from "@sdxc/u/typography";

import { Button } from "../components/button.js";
import { DateRangePicker } from "../components/date-range-picker.js";
import { Keyboard } from "../components/keyboard.js";
import { Popover } from "../components/popover.js";

/** Container the picker measures; below {@link WIDE_WIDTH} of its own width it becomes a select. */
const PICKER_CONTAINER = "ui-range-picker";

/** The picker's width in a row with room to spare, and the narrowest that still shows segments. */
const WIDE_WIDTH = "24rem";

/** Query parameter the picker writes when `name` is omitted. */
const DEFAULT_NAME = "range";

/** Value the custom range submits under `name`, beside its start and end dates. */
export const RANGE_PICKER_CUSTOM_VALUE = "custom";

/** Attribute naming the letter key that picks a preset, read by `rangePickerKeys()`. */
export const RANGE_PICKER_KEY_ATTRIBUTE = "data-range-key";

/** Attribute `rangePickerKeys()` sets on the picker once it submits the select on change. */
export const RANGE_PICKER_ENHANCED_ATTRIBUTE = "data-range-picker-enhanced";

/**
 * Prop types for {@link RangePicker}.
 */
export namespace RangePicker {
	/** One preset range. */
	export interface Preset {
		/** What the picker submits under `name` ("7d"). */
		value: string;
		/** The segment's short text ("7d"). */
		label: string;
		/** The full name, for the select option and the segment's accessible name ("Last 7 days"). */
		description?: string;
		/** A single letter that picks the preset once `rangePickerKeys()` is attached ("w"). */
		key?: string;
	}

	/** The custom range's fields; the picker renders a Custom entry only when this is set. */
	export interface Custom {
		/** Query parameter of the range's first day. */
		startName: string;
		/** Query parameter of the range's last day. */
		endName: string;
		/** First day of the range in effect, `YYYY-MM-DD`. */
		start?: string;
		/** Last day of the range in effect, `YYYY-MM-DD`. */
		end?: string;
		/** Earliest selectable day, `YYYY-MM-DD`. */
		min?: string;
		/** Latest selectable day, `YYYY-MM-DD`. */
		max?: string;
		/** Letter that opens the custom range once `rangePickerKeys()` is attached. */
		key?: string;
	}

	/** Every string the picker shows or announces. */
	export interface Labels {
		/** Accessible name of the preset group and the select ("Time range"). */
		group: string;
		/** Submits the select without script and the custom range ("Apply"). */
		apply: string;
		/** The Custom entry's text; required with `custom`. */
		custom?: string;
		/** The custom range's first-day field ("From"). */
		start?: string;
		/** The custom range's last-day field ("To"). */
		end?: string;
	}

	/** Props accepted by {@link RangePicker}. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		presets: readonly Preset[];
		/** The range in effect: a preset's `value`, or {@link RANGE_PICKER_CUSTOM_VALUE}. */
		value?: string;
		/** @default {@link DEFAULT_NAME} */
		name?: string;
		/** Where the forms submit; the current URL when omitted. */
		action?: string;
		/** Other query parameters to keep, submitted as hidden fields (filters, the open tab). */
		params?: Readonly<Record<string, string>>;
		custom?: Custom;
		labels: Labels;
		/**
		 * Shows each preset's key as a hint inside its segment.
		 *
		 * @default true
		 */
		keyHints?: boolean;
	}
}

namespace HiddenParams {
	export interface Props {
		params?: Readonly<Record<string, string>>;
	}
}

/** The query parameters every form of the picker carries through, so a range change keeps the rest. */
function HiddenParams(handle: Handle<HiddenParams.Props>) {
	return () =>
		Object.entries(handle.props.params ?? {}).map(([key, value]) => (
			<input key={key} type="hidden" name={key} value={value} />
		));
}

/**
 * Renders the picker. Each preset is a submit button of a GET form, pressed when it is the
 * range in effect; under a 24rem container the segments give way to a select with an Apply
 * button. Attach `rangePickerKeys()` for letter keys and to submit the select on change.
 *
 * @param handle Runtime handle carrying the picker's props.
 * @returns The render function producing the picker's markup.
 * @example
 * <RangePicker
 * 	value={range}
 * 	params={{ monitor: monitorId }}
 * 	presets={[
 * 		{ value: "24h", label: "24h", description: t("range.day"), key: "d" },
 * 		{ value: "7d", label: "7d", description: t("range.week"), key: "w" },
 * 	]}
 * 	custom={{ startName: "from", endName: "to", start: from, end: to, key: "c" }}
 * 	labels={{ group: t("range.label"), apply: t("range.apply"), custom: t("range.custom"), start: t("range.from"), end: t("range.to") }}
 * 	mix={rangePickerKeys()}
 * />
 */
export function RangePicker(handle: Handle<RangePicker.Props>) {
	return () => {
		let { presets, value, name, action, params, custom, labels, keyHints, mix, ...rest } =
			handle.props;
		let resolvedName = name ?? DEFAULT_NAME;
		let popoverId = `${rest.id ?? handle.id}-custom`;
		let isCustom = value === RANGE_PICKER_CUSTOM_VALUE;
		let showKeys = keyHints ?? true;
		let segment = [
			inlineFlex(),
			items("center"),
			bs("1.75rem"),
			pi(2.5),
			rounded("sm"),
			text("sm"),
			weight("medium"),
			nowrap(),
			tabularNums(),
			cursor("default"),
			/**
			 * Every state of a segment lives in one rule, so the pressed state always wins over
			 * the resting one whatever order the stylesheet layers land in.
			 */
			raw({
				gap: "0.375rem",
				border: "none",
				backgroundColor: "transparent",
				color: "var(--ui-neutral-fg-muted, inherit)",
				"&:hover": { color: "var(--ui-neutral-fg, inherit)" },
				'&[aria-pressed="true"]': {
					backgroundColor: "var(--ui-bg, Canvas)",
					color: "var(--ui-neutral-fg, inherit)",
					boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.08)",
				},
				"&:focus-visible": {
					outline: "2px solid var(--ui-brand-ring, Highlight)",
					outlineOffset: "-2px",
				},
			}),
		];

		return (
			<div
				data-slot="range-picker"
				{...rest}
				mix={mergeMix(
					[
						/**
						 * As a size container the picker has no content width of its own, so it
						 * claims the wide layout's breakpoint as its intrinsic width: an auto-width
						 * flex item gets room for the segments and shrinks into the select.
						 */
						raw({
							display: "flex",
							justifyContent: "flex-end",
							flex: "0 1 auto",
							containIntrinsicInlineSize: WIDE_WIDTH,
						}),
						maxIs("100%"),
						minIs(0),
						container(PICKER_CONTAINER),
					],
					mix,
				)}
			>
				<form
					method="get"
					action={action}
					data-slot="range-picker-segments"
					mix={[
						/**
						 * Both displays live in one rule, so the wide layout always wins at its width
						 * whatever order the stylesheet layers land in.
						 */
						raw({
							display: "none",
							[`@container ${PICKER_CONTAINER} (min-width: ${WIDE_WIDTH})`]: { display: "flex" },
						}),
					]}
				>
					<HiddenParams params={params} />
					<div
						role="group"
						aria-label={labels.group}
						mix={[
							inlineFlex(),
							items("center"),
							raw({ gap: "0.125rem" }),
							bs("2rem"),
							p(0.5),
							rounded("md"),
							bg("neutral.tint"),
							border({ color: "neutral", width: 1, style: "solid" }),
						]}
					>
						{presets.map((preset) => (
							<button
								key={preset.value}
								type="submit"
								name={resolvedName}
								value={preset.value}
								aria-label={preset.description}
								aria-pressed={preset.value === value ? "true" : "false"}
								aria-keyshortcuts={preset.key?.toUpperCase()}
								data-range-key={preset.key?.toLowerCase()}
								mix={segment}
							>
								{preset.label}
								{showKeys && preset.key ? (
									<Keyboard
										aria-hidden="true"
										mix={[mis(0), bs("1.125rem"), minIs("1.125rem"), opacity(80)]}
									>
										{preset.key.toUpperCase()}
									</Keyboard>
								) : null}
							</button>
						))}
						{custom ? (
							<button
								type="button"
								commandfor={popoverId}
								command="toggle-popover"
								aria-pressed={isCustom ? "true" : "false"}
								aria-keyshortcuts={custom.key?.toUpperCase()}
								data-range-key={custom.key?.toLowerCase()}
								mix={segment}
							>
								<CalendarIcon size={14} aria-hidden="true" />
								{labels.custom}
								{showKeys && custom.key ? (
									<Keyboard
										aria-hidden="true"
										mix={[mis(0), bs("1.125rem"), minIs("1.125rem"), opacity(80)]}
									>
										{custom.key.toUpperCase()}
									</Keyboard>
								) : null}
							</button>
						) : null}
					</div>
				</form>
				<form
					method="get"
					action={action}
					data-slot="range-picker-select"
					mix={[
						hstack({ gap: 2, align: "center" }),
						is("full"),
						minIs(0),
						raw({
							[`@container ${PICKER_CONTAINER} (min-width: ${WIDE_WIDTH})`]: { display: "none" },
						}),
					]}
				>
					<HiddenParams params={params} />
					<select
						name={resolvedName}
						aria-label={labels.group}
						mix={[
							raw({ flex: "1 1 auto" }),
							minIs(0),
							bs("2rem"),
							pi(2),
							rounded("md"),
							bg(),
							border({ color: "neutral", width: 1, style: "solid" }),
							text("sm"),
							focusVisible(
								raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" }),
							),
						]}
					>
						{presets.map((preset) => (
							<option
								key={preset.value}
								value={preset.value}
								selected={preset.value === value}
								data-range-key={preset.key?.toLowerCase()}
							>
								{preset.description ?? preset.label}
							</option>
						))}
						{isCustom && labels.custom ? (
							<option value={RANGE_PICKER_CUSTOM_VALUE} selected>
								{labels.custom}
							</option>
						) : null}
					</select>
					<span
						data-slot="range-picker-apply"
						mix={[
							raw({
								display: "contents",
								[`:where([${RANGE_PICKER_ENHANCED_ATTRIBUTE}]) &`]: { display: "none" },
							}),
						]}
					>
						<Button type="submit" size="sm" variant="outline" color="neutral">
							{labels.apply}
						</Button>
					</span>
					{custom ? (
						<Button
							type="button"
							size="sm"
							variant="outline"
							color="neutral"
							commandfor={popoverId}
							command="toggle-popover"
							aria-label={labels.custom}
							data-range-key={custom.key?.toLowerCase()}
						>
							<CalendarIcon size={14} aria-hidden="true" />
						</Button>
					) : null}
				</form>
				{custom ? (
					<Popover id={popoverId} placement="bottom-end">
						<form method="get" action={action} mix={[vstack({ gap: 3, align: "stretch" }), p(3)]}>
							<HiddenParams params={params} />
							<input type="hidden" name={resolvedName} value={RANGE_PICKER_CUSTOM_VALUE} />
							<DateRangePicker
								startLabel={labels.start}
								endLabel={labels.end}
								startName={custom.startName}
								endName={custom.endName}
								startDefaultValue={custom.start}
								endDefaultValue={custom.end}
								min={custom.min}
								max={custom.max}
								required
							/>
							<Button type="submit" size="sm" mix={[raw({ alignSelf: "flex-end" })]}>
								{labels.apply}
							</Button>
						</form>
					</Popover>
				) : null}
			</div>
		);
	};
}
