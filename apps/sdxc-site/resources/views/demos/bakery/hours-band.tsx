/**
 * The hours band: the next seven days as the bakery's calendar has them, holidays already
 * applied and today marked with the door sign, beside the holidays still ahead drawn as
 * tear-off calendar pages, all reckoned from the moment the page was asked for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { dark } from "@sdxc/u/responsive";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import type { LocalDay } from "~/resources/views/demos/bakery/hours";

import { OpenSign } from "~/resources/views/demos/bakery/hero";
import {
	dayAfter,
	formatOpening,
	localClock,
	openingStatus,
	TIME_ZONE,
	upcomingExceptions,
	WEEK,
} from "~/resources/views/demos/bakery/hours";
import { renderNearView } from "~/resources/views/demos/near-view";

/** Short month names for the calendar pages, January first. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A day's row label: "Today", "Tomorrow", or its weekday, with the date beside it. */
function dayLabel(day: LocalDay, offset: number): { name: string; date: string } {
	let month = MONTHS[Number(day.date.slice(5, 7)) - 1] ?? "";
	let date = `${month} ${Number(day.date.slice(8, 10))}`;
	if (offset === 0) return { name: "Today", date };
	if (offset === 1) return { name: "Tomorrow", date };
	return { name: WEEK[day.weekday]?.name ?? "", date };
}

/**
 * The hours band: a header that names the bakery's time zone, the week ahead as a table,
 * and the holidays coming up.
 *
 * @param handle Runtime handle carrying the instant the page was asked for.
 * @returns The render function producing the band.
 */
export function Hours(handle: Handle<{ now: Date }>) {
	return () => {
		let { now } = handle.props;
		let { date } = localClock(now);
		let week = Array.from({ length: 7 }, (_, offset) => dayAfter(date, offset));
		let holidays = upcomingExceptions(now, 4);
		let status = openingStatus(now);

		return (
			<LandingSection id="hours" tone="tinted" mix={[renderNearView(720, 1300)]}>
				<LandingHeader
					eyebrow="Opening hours"
					description={
						<>
							The times below are Alder Street time, wherever you're reading this.{" "}
							<strong>Holidays are already counted in.</strong>
						</>
					}
				>
					The week ahead, holidays included
				</LandingHeader>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))",
							gap: "1.5rem",
							alignItems: "start",
						}),
					]}
				>
					<div
						mix={[
							raw({
								display: "flex",
								flexDirection: "column",
								gap: "1rem",
								padding: "1.5rem",
								borderRadius: "var(--ui-landing-card-radius-outer)",
								backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
								boxShadow: "var(--ui-shadow-surface)",
							}),
						]}
					>
						<OpenSign status={status} />
						<table
							data-slot="week-hours"
							mix={[
								raw({
									inlineSize: "100%",
									borderCollapse: "collapse",
									fontVariantNumeric: "tabular-nums",
								}),
							]}
						>
							<caption
								mix={[
									raw({
										position: "absolute",
										inlineSize: "1px",
										blockSize: "1px",
										overflow: "hidden",
										clipPath: "inset(50%)",
									}),
								]}
							>
								Opening hours for the next seven days, in the {TIME_ZONE.replace("_", " ")} time
								zone
							</caption>
							<tbody>
								{week.map((day, offset) => {
									let label = dayLabel(day, offset);
									return (
										<tr
											key={day.date}
											data-today={offset === 0 ? "true" : undefined}
											mix={[
												raw({
													borderBlockEnd: "1px solid var(--ui-landing-hairline)",
													backgroundColor: offset === 0 ? "var(--ui-brand-bg-tint)" : "transparent",
												}),
											]}
										>
											<th
												scope="row"
												mix={[
													raw({
														textAlign: "start",
														paddingBlock: "0.75rem",
														paddingInline: "0.75rem",
														fontWeight: offset === 0 ? "800" : "600",
														color: "var(--ui-neutral-fg-emphasis)",
													}),
												]}
											>
												{label.name}
												<span
													mix={[
														raw({
															marginInlineStart: "0.5rem",
															fontWeight: "400",
															fontSize: "0.875rem",
															color: "var(--ui-neutral-fg-muted)",
														}),
													]}
												>
													{label.date}
												</span>
											</th>
											<td
												mix={[
													raw({
														textAlign: "end",
														paddingBlock: "0.75rem",
														paddingInline: "0.75rem",
														color: day.opening
															? "var(--ui-neutral-fg-emphasis)"
															: "var(--ui-neutral-fg-muted)",
													}),
												]}
											>
												{day.opening ? formatOpening(day.opening) : "Closed"}
												{day.exception ? (
													<span
														mix={[
															raw({
																display: "block",
																fontSize: "0.8125rem",
																fontWeight: "700",
																color: "var(--ui-brand-fg)",
															}),
														]}
													>
														{day.exception.reason}
													</span>
												) : null}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					<div mix={[raw({ display: "flex", flexDirection: "column", gap: "0.75rem" })]}>
						<p
							mix={[
								raw({
									margin: "0",
									fontFamily: "var(--ui-font-display)",
									fontWeight: "700",
									fontSize: "1.375rem",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							Holidays coming up
						</p>
						<ul
							mix={[
								raw({
									listStyle: "none",
									margin: "0",
									padding: "0",
									display: "grid",
									gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 15rem), 1fr))",
									gap: "0.75rem",
								}),
							]}
						>
							{holidays.map((day) => (
								<CalendarPage key={day.date} day={day} />
							))}
							{holidays.length === 0 ? (
								<li mix={[raw({ color: "var(--ui-neutral-fg)" })]}>
									No holidays in the next few weeks: the usual hours all the way.
								</li>
							) : null}
						</ul>
						<p mix={[raw({ margin: "0", fontSize: "0.9375rem", color: "var(--ui-neutral-fg)" })]}>
							Every other week runs to the usual hours: Tuesday to Friday 7 am – 6 pm, Saturday 7 am
							– 4 pm, Sunday 8 am – 2 pm, and closed on Mondays so the bakers can sleep.
						</p>
					</div>
				</div>
			</LandingSection>
		);
	};
}

/**
 * One holiday as a tear-off calendar page: the month on a crust-coloured strip, the date
 * large, then the reason and the hours that day.
 *
 * @param handle Runtime handle carrying the day.
 * @returns The render function producing the list item.
 */
function CalendarPage(handle: Handle<{ day: LocalDay }>) {
	return () => {
		let { day } = handle.props;
		let month = MONTHS[Number(day.date.slice(5, 7)) - 1] ?? "";
		return (
			<li
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "3.5rem 1fr",
						gap: "0.875rem",
						alignItems: "center",
						padding: "0.75rem",
						borderRadius: "var(--ui-landing-card-radius-inner)",
						backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
						boxShadow: "var(--ui-shadow-surface)",
					}),
				]}
			>
				<span
					aria-hidden="true"
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							overflow: "hidden",
							borderRadius: "0.625rem",
							textAlign: "center",
							backgroundColor: "white",
							boxShadow: "0 0 0 2px var(--ui-color-brand-500)",
							color: "oklch(0.3 0.04 45)",
						}),
						dark(raw({ backgroundColor: "var(--ui-color-neutral-100)" })),
					]}
				>
					<span
						mix={[
							raw({
								fontSize: "0.6875rem",
								fontWeight: "800",
								textTransform: "uppercase",
								letterSpacing: "0.06em",
								paddingBlock: "0.125rem",
								backgroundColor: "var(--ui-color-brand-500)",
								color: "white",
							}),
						]}
					>
						{month}
					</span>
					<span
						mix={[
							raw({
								fontFamily: "var(--ui-font-display)",
								fontWeight: "700",
								fontSize: "1.5rem",
								lineHeight: "1.4",
							}),
						]}
					>
						{Number(day.date.slice(8, 10))}
					</span>
				</span>
				<span mix={[raw({ display: "flex", flexDirection: "column", gap: "0.125rem" })]}>
					<span mix={[raw({ fontWeight: "700", color: "var(--ui-neutral-fg-emphasis)" })]}>
						{day.exception?.reason}
					</span>
					<span mix={[raw({ fontSize: "0.9375rem", color: "var(--ui-neutral-fg)" })]}>
						{WEEK[day.weekday]?.name}, {month} {Number(day.date.slice(8, 10))} ·{" "}
						{day.opening ? formatOpening(day.opening) : "Closed all day"}
					</span>
				</span>
			</li>
		);
	};
}
