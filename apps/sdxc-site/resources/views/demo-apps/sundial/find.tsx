/**
 * Find a time: the visitor and the teammates they pick, side by side over one day on the
 * visitor's clock. Busy blocks come from the shared calendar and each teammate's own day, their
 * working hours are read in their own zone (DST included), and the times everyone can make are offered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ChevronLeftIcon, ChevronRightIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { LinkButton } from "@sdxc/ui";
import { FreeBusy } from "@sdxc/ui/app/free-busy";

import type { Person } from "./data";
import type { Entry } from "./model";
import type { ViewContext } from "./views";

import { LOCALE, ME, PEOPLE, findPerson, href, shiftDate } from "./data";
import { PersonDot } from "./event";
import { guestsOf, organizerOf, rsvpOf } from "./model";
import { clockAt, formatDay, formatMinute, instantAt, instancesIn, zoneName } from "./time";
import { viewHref } from "./views";

/** The part of the day the comparison shows, in minutes of the visitor's day. */
const RANGE = { start: 6 * 60, end: 22 * 60 };

/** The meeting lengths a visitor can look for. */
export const LENGTHS = [30, 45, 60] as const;

/** Who the comparison opens with. */
export const DEFAULT_WITH = ["mara", "tomas"];

/** A busy or free stretch, in minutes of the visitor's day. */
interface Span {
	start: number;
	end: number;
	title?: string;
	tentative?: boolean;
}

/** A small number from a string, the same every time, for a teammate's invented day. */
function seed(text: string): number {
	let hash = 2166136261;
	for (let index = 0; index < text.length; index += 1) {
		hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
	}
	return Math.abs(hash);
}

/** Clips a span of instants to the visitor's day, as minutes, or `null` when it misses it. */
function onDay(start: number, end: number, day: string, zone: string): Span | null {
	let dayStart = instantAt(day, 0, zone);
	let dayEnd = instantAt(shiftDate(day, 1), 0, zone);
	if (end <= dayStart || start >= dayEnd) return null;
	let from = start <= dayStart ? 0 : clockAt(start, zone).minute;
	let to = end >= dayEnd ? 1440 : clockAt(end, zone).minute;
	return to > from ? { start: from, end: to } : null;
}

/**
 * A teammate's working hours on the visitor's day: each of their own working days that
 * overlaps it, read in their zone, so a London workday moves an hour on a New York clock in the
 * weeks only one side has changed its clocks.
 */
export function workingSpans(person: Person, day: string, zone: string): Span[] {
	let spans: Span[] = [];
	for (let offset = -1; offset <= 1; offset += 1) {
		let theirs = shiftDate(clockAt(instantAt(day, 720, zone), person.zone).date, offset);
		let weekday = new Date(`${theirs}T00:00:00Z`).getUTCDay();
		if (weekday === 0 || weekday === 6) continue;
		let span = onDay(
			instantAt(theirs, person.hours.start, person.zone),
			instantAt(theirs, person.hours.end, person.zone),
			day,
			zone,
		);
		if (span) spans.push(span);
	}
	return spans;
}

/** The complement of the working hours inside the shown range, drawn hatched. */
function outsideOf(working: Span[]): Span[] {
	let outside: Span[] = [];
	let cursor = RANGE.start;
	for (let span of [...working].sort((a, b) => a.start - b.start)) {
		if (span.start > cursor) outside.push({ start: cursor, end: Math.min(span.start, RANGE.end) });
		cursor = Math.max(cursor, span.end);
	}
	if (cursor < RANGE.end) outside.push({ start: cursor, end: RANGE.end });
	return outside.filter((span) => span.end > span.start);
}

/** A teammate's busy blocks: shared events they are invited to, and two of their own. */
function busyOf(person: Person, day: string, zone: string, events: Entry[]): Span[] {
	let shared = instancesIn(events, day, 1, zone)
		.filter(
			(instance) =>
				instance.days === undefined &&
				(guestsOf(instance.event).includes(person.id) ||
					organizerOf(instance.event) === person.id ||
					(person.id === ME && guestsOf(instance.event).length === 0)),
		)
		.flatMap((instance): Span[] => {
			let span = onDay(instance.start.getTime(), instance.end.getTime(), day, zone);
			return span === null
				? []
				: [
						{
							...span,
							title: instance.event.title ?? "",
							tentative: person.id === ME && rsvpOf(instance.event) === "maybe",
						},
					];
		});
	if (person.id === ME) return shared;
	let theirs = clockAt(instantAt(day, 720, zone), person.zone).date;
	let weekday = new Date(`${theirs}T00:00:00Z`).getUTCDay();
	if (weekday === 0 || weekday === 6) return shared;
	let hash = seed(`${person.id}:${theirs}`);
	let own = [
		{ at: person.hours.start + 60 + (hash % 4) * 30, length: 60, title: "Busy" },
		{
			at: person.hours.start + 240 + ((hash >> 3) % 4) * 30,
			length: 30 + ((hash >> 5) % 2) * 30,
			title: "Busy",
		},
	]
		.map((block) =>
			onDay(
				instantAt(theirs, block.at, person.zone),
				instantAt(theirs, block.at + block.length, person.zone),
				day,
				zone,
			),
		)
		.filter((span): span is Span => span !== null);
	return [...shared, ...own];
}

/**
 * The stretches every chosen person is working and free for at least `length` minutes, in
 * steps of 15, merged into runs.
 */
export function freeSlots(
	people: Array<{ working: Span[]; busy: Span[] }>,
	length: number,
): Span[] {
	let slots: Span[] = [];
	let fits = (minute: number) =>
		people.every(
			(person) =>
				person.working.some((span) => span.start <= minute && span.end >= minute + 15) &&
				!person.busy.some((span) => span.start < minute + 15 && span.end > minute),
		);
	let run: Span | null = null;
	for (let minute = RANGE.start; minute < RANGE.end; minute += 15) {
		if (fits(minute)) {
			run = { start: run === null ? minute : run.start, end: minute + 15 };
		} else if (run) {
			slots.push(run);
			run = null;
		}
	}
	if (run) slots.push(run);
	return slots.filter((slot) => slot.end - slot.start >= length);
}

namespace FindScreen {
	export interface Props {
		context: ViewContext;
		/** Teammate ids to compare with. */
		with: string[];
		length: number;
		/** Every event on the shared calendar, hidden calendars included. */
		everything: Entry[];
	}
}

/** Find a time: whom to compare, how long, the grid of everyone's day, and the times that fit. */
export function FindScreen(handle: Handle<FindScreen.Props>) {
	return () => {
		let { context, length, everything } = handle.props;
		let chosen = handle.props.with;
		let day = context.anchor;
		let rows = [ME, ...chosen]
			.map((id) => findPerson(id))
			.filter((person): person is Person => person !== undefined);
		let data = rows.map((person) => {
			let working = workingSpans(person, day, context.zone);
			return { person, working, busy: busyOf(person, day, context.zone, everything) };
		});
		let slots = freeSlots(data, length);
		let query = (people: string[]) => `with=${people.join(",")}&length=${length}`;
		let localTime = (person: Person) => {
			let at = instantAt(day, context.now.date === day ? context.now.minute : 720, context.zone);
			return new Intl.DateTimeFormat(LOCALE, {
				hour: "numeric",
				minute: "2-digit",
				timeZone: person.zone,
			}).format(at);
		};
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gap: "1.25rem",
						alignContent: "start",
						padding: "1rem",
						overflowY: "auto",
						flex: "1 1 auto",
						minBlockSize: "0",
					}),
				]}
			>
				<header
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							gap: "0.75rem",
							alignItems: "center",
							justifyContent: "space-between",
						}),
					]}
				>
					<div mix={[raw({ display: "grid", gap: "0.25rem" })]}>
						<h2
							mix={[
								raw({
									margin: "0",
									fontSize: "1.25rem",
									fontWeight: "650",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							Find a time
						</h2>
						<p
							mix={[
								raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" }),
							]}
						>
							{`${formatDay(day)} · shown in ${zoneName(context.zone, day)}. Hatched hours are outside someone's working day.`}
						</p>
					</div>
					<div mix={[raw({ display: "flex", gap: "0.25rem" })]}>
						<LinkButton
							href={viewHref("find", shiftDate(day, -1), query(chosen))}
							size="sm"
							variant="outline"
							color="neutral"
							aria-label="Previous day"
						>
							<ChevronLeftIcon size={16} aria-hidden="true" />
						</LinkButton>
						<LinkButton
							href={viewHref("find", shiftDate(day, 1), query(chosen))}
							size="sm"
							variant="outline"
							color="neutral"
							aria-label="Next day"
						>
							<ChevronRightIcon size={16} aria-hidden="true" />
						</LinkButton>
					</div>
				</header>
				<form
					method="get"
					action={href("find")}
					mix={[
						raw({ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem", alignItems: "center" }),
					]}
				>
					<input type="hidden" name="d" value={day} />
					<fieldset
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								gap: "0.375rem",
								margin: "0",
								padding: "0",
								border: "none",
							}),
						]}
					>
						<legend
							mix={[
								raw({
									padding: "0",
									marginBlockEnd: "0.375rem",
									fontSize: "0.8125rem",
									fontWeight: "600",
								}),
							]}
						>
							Compare with
						</legend>
						{PEOPLE.filter((person) => person.id !== ME).map((person) => (
							<label
								mix={[
									raw({
										display: "inline-flex",
										alignItems: "center",
										gap: "0.375rem",
										paddingInline: "0.375rem 0.625rem",
										blockSize: "2rem",
										borderRadius: "999px",
										border: "1px solid var(--ui-neutral-border)",
										fontSize: "0.8125rem",
										cursor: "pointer",
										"&:has(input:checked)": {
											borderColor: "var(--ui-brand-bg-solid)",
											backgroundColor:
												"color-mix(in oklch, var(--ui-brand-bg-solid) 10%, transparent)",
										},
										"&:has(input:focus-visible)": { boxShadow: "0 0 0 2px var(--ui-brand-ring)" },
									}),
								]}
							>
								<input
									type="checkbox"
									name="with"
									value={person.id}
									checked={chosen.includes(person.id)}
									mix={[
										raw({
											position: "absolute",
											opacity: "0",
											inlineSize: "1px",
											blockSize: "1px",
										}),
									]}
								/>
								<PersonDot id={person.id} size={20} />
								{person.name.split(" ")[0]}
							</label>
						))}
					</fieldset>
					<label
						mix={[
							raw({ display: "grid", gap: "0.375rem", fontSize: "0.8125rem", fontWeight: "600" }),
						]}
					>
						Length
						<select
							name="length"
							mix={[
								raw({
									blockSize: "2rem",
									paddingInline: "0.5rem",
									borderRadius: "0.5rem",
									border: "1px solid var(--ui-neutral-border)",
									backgroundColor: "var(--ui-bg, Canvas)",
									color: "inherit",
									font: "inherit",
									fontWeight: "400",
								}),
							]}
						>
							{LENGTHS.map((minutes) => (
								<option
									value={String(minutes)}
									selected={minutes === length}
								>{`${minutes} minutes`}</option>
							))}
						</select>
					</label>
					<button
						type="submit"
						mix={[
							raw({
								alignSelf: "end",
								blockSize: "2rem",
								paddingInline: "0.875rem",
								borderRadius: "0.5rem",
								border: "none",
								backgroundColor: "var(--ui-brand-bg-solid)",
								color: "var(--ui-brand-fg-on-solid, white)",
								font: "inherit",
								fontSize: "0.8125rem",
								fontWeight: "600",
								cursor: "pointer",
							}),
						]}
					>
						Compare
					</button>
				</form>
				<FreeBusy
					label={`Availability on ${formatDay(day)}`}
					start={RANGE.start}
					end={RANGE.end}
					hours={Array.from({ length: (RANGE.end - RANGE.start) / 60 + 1 }, (_, index) => {
						let minute = RANGE.start + index * 60;
						return { minute, label: formatMinute(minute).replace(":00", "") };
					})}
					now={context.now.date === day ? context.now.minute : undefined}
					formatTime={formatMinute}
					labels={{ busy: "Busy {times}", free: "Free all day" }}
					people={data.map(({ person, working, busy }) => ({
						id: person.id,
						name: person.id === ME ? `${person.name} (you)` : person.name,
						detail: `${person.city} · ${localTime(person)}`,
						avatar: <PersonDot id={person.id} size={28} />,
						busy,
						outside: outsideOf(working),
					}))}
					slots={slots.map((slot) => ({
						start: slot.start,
						end: slot.end,
						label: `${formatMinute(slot.start)}`,
						href: href(
							`?d=${day}&date=${day}&start=${slot.start}&end=${slot.start + length}&guests=${chosen.join(",")}`,
						),
					}))}
				/>
				<section
					aria-labelledby="sundial-find-suggestions"
					mix={[raw({ display: "grid", gap: "0.5rem" })]}
				>
					<h3
						id="sundial-find-suggestions"
						mix={[
							raw({
								margin: "0",
								fontSize: "0.9375rem",
								fontWeight: "650",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{slots.length === 0 ? "No time works for everyone" : "Times that work for everyone"}
					</h3>
					{slots.length === 0 ? (
						<p
							mix={[
								raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" }),
							]}
						>
							Try a shorter meeting, fewer people, or the next day.
						</p>
					) : (
						<ul
							mix={[
								raw({
									display: "flex",
									flexWrap: "wrap",
									gap: "0.5rem",
									margin: "0",
									padding: "0",
									listStyle: "none",
								}),
							]}
						>
							{slots.map((slot) => (
								<li>
									<LinkButton
										href={href(
											`?d=${day}&date=${day}&start=${slot.start}&end=${slot.start + length}&guests=${chosen.join(",")}`,
										)}
										size="sm"
										variant="outline"
										color="neutral"
									>
										{`${formatMinute(slot.start)} – ${formatMinute(slot.end)}`}
									</LinkButton>
								</li>
							))}
						</ul>
					)}
					<p mix={[raw({ margin: "0", fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>
						{`Picking a time opens a new ${length}-minute event with everyone invited.`}
					</p>
				</section>
			</div>
		);
	};
}
