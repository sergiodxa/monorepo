/**
 * A stay's check-in and check-out as two fields that open one calendar of two months. Every
 * day is a link carrying the dates, so without script a pick reloads the page with them; with
 * script, picks stay in the form, and a booking card re-prices once both ends are chosen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Popover } from "@sdxc/ui";
import { RangeMonths } from "@sdxc/ui/range-months";
import { clientEntry, on } from "remix/component";

import { addDays, formatDay, nightsBetween } from "./days";

/** The calendar's copy for its month links and a selected day's name. */
const LABELS = {
	previous: "Previous month",
	next: "Next month",
	start: "check-in",
	end: "check-out",
};

/** The field names a stay's dates post as. */
const DEFAULT_NAMES = { start: "checkin", end: "checkout" };

/** The captions over a stay's two dates. */
const DEFAULT_CAPTIONS = { start: "Check in", end: "Check out" };

/** How far ahead the calendar reaches, matching what a stay can be booked for. */
const HORIZON_DAYS = 330;

namespace DatesField {
	export interface Props {
		/** A prefix for the field's element ids, unique on the page. */
		id: string;
		start?: string;
		end?: string;
		/** Today's key; nothing earlier can be picked. */
		today: string;
		/**
		 * The page a day link loads without script: its path and query without `checkin`,
		 * `checkout` and `month`, which each link adds.
		 */
		base: string;
		/** Nights already taken, which the calendar strikes through and a range never crosses. */
		booked?: string[];
		/** Submits the enclosing form once both ends are picked, so the page re-prices the stay. */
		submitOnRange?: boolean;
		/** Draws the two fields as a bordered pair, as a booking card does, rather than bar segments. */
		boxed?: boolean;
		/** The form field names the two ends post as. Default: `checkin` and `checkout`. */
		names?: { start: string; end: string };
		/** The captions over the two ends. Default: "Check in" and "Check out". */
		captions?: { start: string; end: string };
		/** Picks one day only, such as a one-way flight's departure. */
		single?: boolean;
		/** How many months the calendar shows side by side. Default: `2`. */
		months?: number;
	}
}

/** What the calendar asks for next: the check-in, then the check-out, then the nights picked. */
function panelHeading(start: string | undefined, nights: number): string {
	if (nights > 0) return `${nights} ${nights === 1 ? "night" : "nights"}`;
	return start === undefined ? "Pick your check-in" : "Now pick your check-out";
}

/** A day-or-placeholder value under a field's label. */
function dayText(day: string | undefined): string {
	return day === undefined ? "Add date" : formatDay(day, { weekday: true });
}

/**
 * The check-in and check-out fields and their calendar. Hidden inputs carry the dates, so the
 * enclosing form submits them whichever way they were picked.
 */
export const DatesField = clientEntry(
	import.meta.url,
	function DatesField(handle: Handle<DatesField.Props>) {
		let start = handle.props.start;
		let end = handle.props.end;
		let month = (start ?? handle.props.today).slice(0, 7);
		let seen = `${handle.props.start}|${handle.props.end}`;

		/**
		 * Takes the server's dates when a swap redraws the field with new ones, so the field shows
		 * what the address says rather than what was picked before the swap.
		 */
		function follow() {
			let next = `${handle.props.start}|${handle.props.end}`;
			if (next === seen) return;
			seen = next;
			start = handle.props.start;
			end = handle.props.end;
			month = (start ?? handle.props.today).slice(0, 7);
		}

		/** The address a day or month link loads without script. */
		function link(next: { start?: string; end?: string; month: string }): string {
			let [path = "", query = ""] = handle.props.base.split("?", 2);
			let params = new URLSearchParams(query);
			let names = handle.props.names ?? DEFAULT_NAMES;
			params.delete(names.start);
			params.delete(names.end);
			if (next.start !== undefined) params.set(names.start, next.start);
			if (next.end !== undefined) params.set(names.end, next.end);
			params.set("month", next.month);
			return `${path}?${params}`;
		}

		/**
		 * Takes a calendar link's dates into the field instead of loading it, and hands the form
		 * a finished range when the field is set to re-price.
		 */
		function pick(event: MouseEvent) {
			if (!(event.target instanceof Element)) return;
			let anchor = event.target.closest("a[href]");
			if (anchor === null || event.metaKey || event.ctrlKey || event.shiftKey) return;
			event.preventDefault();
			let params = new URL(anchor.getAttribute("href") ?? "", location.href).searchParams;
			let names = handle.props.names ?? DEFAULT_NAMES;
			start = params.get(names.start) ?? undefined;
			end = handle.props.single === true ? undefined : (params.get(names.end) ?? undefined);
			month = params.get("month") ?? month;
			void handle.update().then(() => {
				let form = document.getElementById(`${handle.props.id}-checkin`)?.closest("form");
				form
					?.querySelector<HTMLInputElement>(`#${handle.props.id}-checkin`)
					?.dispatchEvent(new Event("change", { bubbles: true }));
				let done = start !== undefined && (end !== undefined || handle.props.single === true);
				if (handle.props.submitOnRange === true && done) {
					document.getElementById(`${handle.props.id}-panel`)?.hidePopover();
					form?.requestSubmit();
				}
			});
		}

		/** Empties both ends, for a fresh pick. */
		function clear(event: MouseEvent) {
			event.preventDefault();
			start = undefined;
			end = undefined;
			void handle.update();
		}

		return () => {
			follow();
			let { boxed = false, booked = [], id, months = 2, single = false, today } = handle.props;
			let names = handle.props.names ?? DEFAULT_NAMES;
			let captions = handle.props.captions ?? DEFAULT_CAPTIONS;
			let taken = new Set(booked);
			let nights = start !== undefined && end !== undefined ? nightsBetween(start, end) : 0;
			let field = [
				raw({
					display: "grid",
					alignContent: "center",
					gap: "0.125rem",
					minInlineSize: "0",
					paddingInline: boxed ? "0.875rem" : "1.25rem",
					paddingBlock: boxed ? "0.625rem" : "0.5rem",
					border: "0",
					borderRadius: boxed ? "0" : "999px",
					background: "transparent",
					color: "var(--ui-neutral-fg-emphasis)",
					textAlign: "start",
					font: "inherit",
					cursor: "pointer",
				}),
				when(
					"&:hover",
					raw({
						backgroundColor: boxed
							? "var(--ui-neutral-bg-tint)"
							: "var(--ui-neutral-bg-tint-hover)",
					}),
				),
				when(
					"&:focus-visible",
					raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
				),
			];
			let caption = raw({
				fontSize: "0.75rem",
				fontWeight: "700",
				letterSpacing: "0.02em",
				color: "var(--ui-neutral-fg-emphasis)",
			});
			let value = raw({
				fontSize: "0.875rem",
				color: "var(--ui-neutral-fg-muted)",
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis",
			});
			return (
				<div
					data-dates-field=""
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: single ? "1fr" : "1fr 1fr",
							minInlineSize: "0",
							...(boxed ? {} : { gap: "0" }),
						}),
					]}
				>
					<input type="hidden" id={`${id}-checkin`} name={names.start} value={start ?? ""} />
					{single ? null : (
						<input type="hidden" id={`${id}-checkout`} name={names.end} value={end ?? ""} />
					)}
					<button
						type="button"
						popovertarget={`${id}-panel`}
						mix={[
							...field,
							boxed && !single
								? raw({ borderInlineEnd: "1px solid var(--ui-neutral-border)" })
								: raw({}),
						]}
					>
						<span mix={[caption]}>{captions.start}</span>
						<span mix={[value]}>{dayText(start)}</span>
					</button>
					{single ? null : (
						<button type="button" popovertarget={`${id}-panel`} mix={field}>
							<span mix={[caption]}>{captions.end}</span>
							<span mix={[value]}>{dayText(end)}</span>
						</button>
					)}
					<Popover
						id={`${id}-panel`}
						placement="bottom"
						aria-label="Choose dates"
						mix={[
							raw({
								padding: "1.25rem",
								inlineSize:
									months > 1 ? "min(46rem, calc(100vw - 1rem))" : "min(24rem, calc(100vw - 1rem))",
								maxBlockSize: "calc(100dvh - 2rem)",
								overflow: "auto",
								borderRadius: "1.25rem",
							}),
							on<HTMLDivElement, "click">("click", pick),
						]}
					>
						<p
							mix={[
								raw({
									margin: "0 0 0.75rem",
									fontSize: "1rem",
									fontWeight: "650",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{single ? "Pick a day" : panelHeading(start, nights)}
						</p>
						<RangeMonths
							headingLevel={3}
							month={month}
							months={months}
							start={start}
							end={end}
							single={single}
							today={today}
							min={today}
							max={addDays(today, HORIZON_DAYS)}
							locale="en-US"
							label="Stay dates"
							labels={LABELS}
							isUnavailable={(day) => taken.has(day)}
							href={link}
						/>
						<div
							mix={[
								raw({
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									marginBlockStart: "0.75rem",
								}),
							]}
						>
							<a
								href={link({ month })}
								mix={[
									on<HTMLAnchorElement, "click">("click", clear),
									raw({
										fontSize: "0.875rem",
										fontWeight: "600",
										color: "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								Clear dates
							</a>
							<button
								type="button"
								popovertarget={`${id}-panel`}
								popovertargetaction="hide"
								mix={[
									raw({
										paddingInline: "1rem",
										blockSize: "2.5rem",
										border: "0",
										borderRadius: "var(--ui-radius-md)",
										backgroundColor: "var(--ui-neutral-bg-solid)",
										color: "var(--ui-neutral-fg-on-solid)",
										font: "inherit",
										fontWeight: "600",
										cursor: "pointer",
									}),
								]}
							>
								Done
							</button>
						</div>
					</Popover>
				</div>
			);
		};
	},
);
