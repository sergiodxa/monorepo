/**
 * One event up close: the card its popover shows (time on the viewer's clock and the event's own,
 * repeat, place, guests and answers), and the dialog that edits or creates it, which the address
 * opens so it reloads, links and posts without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import {
	CalendarIcon,
	ClockIcon,
	MapPinIcon,
	PencilIcon,
	RepeatIcon,
	TrashIcon,
	UsersIcon,
} from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { raw } from "@sdxc/u/general";
import {
	Button,
	DateField,
	HeadingScope,
	Label,
	LinkButton,
	Select,
	TextArea,
	TextField,
	TimeField,
} from "@sdxc/ui";
import { RouteDialog } from "@sdxc/ui/app/route-dialog";
import { Dialog } from "@sdxc/ui/dialog";

import type { RepeatId, Rsvp } from "./data";
import type { Instance } from "./time";

import {
	CALENDARS,
	COLORS,
	ME,
	PEOPLE,
	REPEATS,
	ZONES,
	actionHref,
	colorValue,
	findCalendar,
	findPerson,
} from "./data";
import {
	durationOf,
	eventColor,
	guestsOf,
	isAllDay,
	localDateTime,
	locationOf,
	organizerOf,
	repeatOf,
	rsvpOf,
	rulesOf,
} from "./model";
import { clockAt, formatDay, formatMinute, formatTimes, zoneName } from "./time";

/** What the edit form holds, every field as typed, so a refused post shows it back unchanged. */
export interface Draft {
	title: string;
	date: string;
	start: string;
	endDate: string;
	end: string;
	allDay: boolean;
	/** `custom` keeps rules the dialog cannot express, such as an imported RRULE. */
	repeat: RepeatId | "custom";
	zone: string;
	calendar: string;
	color: string;
	guests: string[];
	location: string;
	notes: string;
	/** For a repeat: change this occurrence alone, or every one. */
	scope: "this" | "all";
}

/** Why a draft was refused, by field. */
export interface DraftIssues {
	title?: string;
	end?: string;
}

/** A minute of the day as the `HH:MM` a time input takes. */
export function clockValue(minute: number): string {
	let wrapped = ((minute % 1440) + 1440) % 1440;
	return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** An `HH:MM` value as minutes, or `null` when it is not one. */
export function minuteOf(value: string): number | null {
	let match = /^(\d{2}):(\d{2})$/.exec(value);
	if (!match) return null;
	let minute = Number(match[1]) * 60 + Number(match[2]);
	return minute < 1440 ? minute : null;
}

/** The colour id a stored `#rrggbb` value is, or `""` for the calendar's own. */
function colorIdOf(value: string | undefined): string {
	return COLORS.find((color) => color.value === value)?.id ?? "";
}

/**
 * The draft an occurrence opens with: its times on its own zone's clock, or on the viewer's for
 * an event with floating times.
 */
export function draftOf(instance: Instance, viewer: string): Draft {
	let { event } = instance;
	let allDay = isAllDay(event);
	let zone = event.timeZone ?? viewer;
	let start = clockAt(instance.start.getTime(), allDay ? "UTC" : zone);
	let end = clockAt(instance.end.getTime() - (allDay ? 86_400_000 : 0), allDay ? "UTC" : zone);
	let repeat = repeatOf(instance.series);
	return {
		title: event.title ?? "",
		date: start.date,
		start: clockValue(allDay ? 540 : start.minute),
		endDate: end.date,
		end: clockValue(allDay ? 600 : end.minute),
		allDay,
		repeat,
		zone: ZONES.some((entry) => entry.id === zone) ? zone : viewer,
		calendar: instance.calendar,
		color: colorIdOf(event.color),
		guests: guestsOf(event),
		location: locationOf(event) ?? "",
		notes: event.description ?? "",
		scope: repeat === "none" ? "all" : "this",
	};
}

/** A blank draft at a day and time on the viewer's clock, with guests already picked. */
export function blankDraft(
	date: string,
	start: number,
	end: number,
	zone: string,
	guests: string[] = [],
): Draft {
	let crosses = end >= 1440;
	return {
		title: "",
		date,
		start: clockValue(start),
		endDate: crosses
			? new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
			: date,
		end: clockValue(end),
		allDay: false,
		repeat: "none",
		zone,
		calendar: "work",
		color: "",
		guests: [ME, ...guests.filter((guest) => guest !== ME && findPerson(guest))],
		location: "",
		notes: "",
		scope: "all",
	};
}

/** Reads a posted form into a draft, keeping whatever was typed. */
export function readDraft(form: FormData): Draft {
	let text = (name: string) => {
		let value = form.get(name);
		return typeof value === "string" ? value : "";
	};
	let repeat: Draft["repeat"] =
		text("repeat") === "custom"
			? "custom"
			: (REPEATS.find((entry) => entry.id === text("repeat"))?.id ?? "none");
	let zone = ZONES.find((entry) => entry.id === text("zone"))?.id ?? ZONES[0].id;
	let calendar =
		CALENDARS.find((entry) => entry.id === text("calendar") && !entry.subscribed)?.id ?? "work";
	let color = COLORS.find((entry) => entry.id === text("color"))?.id ?? "";
	let date = /^\d{4}-\d{2}-\d{2}$/.test(text("date")) ? text("date") : "";
	let endDate = /^\d{4}-\d{2}-\d{2}$/.test(text("endDate")) ? text("endDate") : date;
	return {
		title: text("title").trim().slice(0, 120),
		date,
		start: text("start"),
		endDate,
		end: text("end"),
		allDay: form.get("allDay") === "on",
		repeat,
		zone,
		calendar,
		color,
		guests: [...new Set(form.getAll("guests").map(String))].filter((id) => findPerson(id)),
		location: text("location").trim().slice(0, 120),
		notes: text("notes").trim().slice(0, 600),
		scope: text("scope") === "this" ? "this" : "all",
	};
}

/** The JSCalendar properties a checked draft sets on an event. */
export interface EventFields {
	calendar: string;
	title: string;
	start: string;
	duration: string;
	timeZone: string | null;
	showWithoutTime: boolean;
	/** `undefined` keeps the event's own rules, for a `custom` repeat. */
	recurrenceRules: ReturnType<typeof rulesOf> | "keep";
	guests: string[];
	location?: string;
	description?: string;
	color?: string;
}

/**
 * Checks a draft and turns it into the JSCalendar properties it sets, or says what to fix. An
 * event with no title is saved as "(No title)", the way a quick add expects.
 *
 * @returns The fields, or the issues to show beside the form.
 */
export function eventFields(draft: Draft): { fields: EventFields } | { issues: DraftIssues } {
	if (draft.date === "") return { issues: { end: "Pick a start date." } };
	let base = {
		calendar: draft.calendar,
		title: draft.title === "" ? "(No title)" : draft.title,
		recurrenceRules: draft.repeat === "custom" ? ("keep" as const) : rulesOf(draft.repeat),
		guests: draft.guests,
		location: draft.location === "" ? undefined : draft.location,
		description: draft.notes === "" ? undefined : draft.notes,
		color: draft.color === "" ? undefined : colorValue(draft.color),
	};
	let days = Math.round(
		(Date.parse(`${draft.endDate}T00:00:00Z`) - Date.parse(`${draft.date}T00:00:00Z`)) / 86_400_000,
	);
	if (draft.allDay) {
		if (days < 0) return { issues: { end: "The end date is before the start date." } };
		return {
			fields: {
				...base,
				start: localDateTime(draft.date, 0),
				duration: durationOf((days + 1) * 1440, true),
				timeZone: null,
				showWithoutTime: true,
			},
		};
	}
	let start = minuteOf(draft.start);
	let end = minuteOf(draft.end);
	if (start === null || end === null) return { issues: { end: "Enter a start and end time." } };
	let length = days * 1440 + end - start;
	if (length <= 0) return { issues: { end: "The event has to end after it starts." } };
	if (length > 14 * 1440) return { issues: { end: "Keep an event under two weeks." } };
	return {
		fields: {
			...base,
			start: localDateTime(draft.date, start),
			duration: durationOf(length),
			timeZone: draft.zone,
			showWithoutTime: false,
		},
	};
}

/** A small round avatar with initials, tinted by the person's hue. */
export function PersonDot(handle: Handle<{ id: string; size?: number }>) {
	return () => {
		let person = findPerson(handle.props.id);
		let size = handle.props.size ?? 22;
		let initials = (person?.name ?? "?")
			.split(" ")
			.map((part) => part[0])
			.join("")
			.slice(0, 2);
		return (
			<span
				aria-hidden="true"
				style={`--hue: ${person?.hue ?? 250}; inline-size: ${size}px; block-size: ${size}px; font-size: ${Math.round(size * 0.42)}px`}
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						flex: "none",
						borderRadius: "999px",
						fontWeight: "600",
						color: "oklch(0.3 0.08 var(--hue))",
						backgroundColor: "oklch(0.88 0.07 var(--hue))",
						boxShadow: "0 0 0 2px var(--ui-bg, Canvas)",
					}),
				]}
			>
				{initials}
			</span>
		);
	};
}

/** The answers a guest can give, as the card's buttons show them. */
const ANSWERS: Array<{ id: Exclude<Rsvp, "pending">; label: string }> = [
	{ id: "yes", label: "Yes" },
	{ id: "maybe", label: "Maybe" },
	{ id: "no", label: "No" },
];

/** One labelled line of the card, with its icon. */
function Line(
	handle: Handle<{
		icon: JSX.Element;
		children: JSX.Element | string | Array<JSX.Element | string | null>;
	}>,
) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "1rem 1fr",
					gap: "0.625rem",
					alignItems: "start",
					fontSize: "0.8125rem",
					lineHeight: "1.25rem",
					color: "var(--ui-neutral-fg)",
					"& > svg": {
						inlineSize: "1rem",
						blockSize: "1rem",
						marginBlockStart: "0.125rem",
						color: "var(--ui-neutral-fg-muted)",
					},
				}),
			]}
		>
			{handle.props.icon}
			<div>{handle.props.children}</div>
		</div>
	);
}

namespace EventCard {
	export interface Props {
		instance: Instance;
		/** The viewer's zone. */
		zone: string;
		/** The address of the dialog editing this occurrence. */
		editHref: string;
		/** The page the card's posts return to. */
		back: string;
	}
}

/**
 * The popover's content: when it happens on the viewer's clock (and the event's own, when they
 * differ), how it repeats, where, who is coming and the visitor's answer, with Edit and Delete.
 */
export function EventCard(handle: Handle<EventCard.Props>) {
	return () => {
		let { instance, zone, editHref, back } = handle.props;
		let { event } = instance;
		let calendar = findCalendar(instance.calendar);
		let readOnly = calendar?.subscribed === true;
		let organizer = organizerOf(event);
		let invited = organizer !== undefined && organizer !== ME;
		let guests = guestsOf(event);
		let location = locationOf(event);
		let repeat = repeatOf(instance.series);
		let rsvp = rsvpOf(event);
		let eventZone = event.timeZone ?? zone;
		let when = iife(() => {
			let days = instance.days;
			if (days === undefined)
				return `${formatDay(clockAt(instance.start.getTime(), zone).date)} · ${formatTimes(instance, zone)}`;
			if (days.first === days.last) return `${formatDay(days.first)} · All day`;
			return `${formatDay(days.first, "short")} – ${formatDay(days.last, "short")} · All day`;
		});
		let otherZone =
			instance.days === undefined && eventZone !== zone
				? `${formatTimes(instance, eventZone)} ${zoneName(eventZone, clockAt(instance.start.getTime(), eventZone).date)} in ${ZONES.find((entry) => entry.id === eventZone)?.label ?? eventZone}`
				: null;
		return (
			<div
				data-slot="sundial-card"
				mix={[
					raw({
						display: "grid",
						gap: "0.75rem",
						inlineSize: "min(20rem, calc(100vw - 2rem))",
						padding: "1rem",
						boxSizing: "border-box",
					}),
				]}
			>
				<div mix={[raw({ display: "flex", gap: "0.625rem", alignItems: "start" })]}>
					<span
						aria-hidden="true"
						style={`background-color: ${eventColor(instance)}`}
						mix={[
							raw({
								flex: "none",
								inlineSize: "0.75rem",
								blockSize: "0.75rem",
								borderRadius: "0.25rem",
								marginBlockStart: "0.3125rem",
							}),
						]}
					/>
					<div mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
						<strong
							mix={[
								raw({
									fontSize: "1rem",
									lineHeight: "1.375rem",
									color: "var(--ui-neutral-fg-emphasis)",
									overflowWrap: "anywhere",
								}),
							]}
						>
							{event.title}
						</strong>
						<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{when}
						</span>
					</div>
				</div>
				{otherZone === null ? null : <Line icon={<ClockIcon />}>{otherZone}</Line>}
				{repeat === "none" ? null : (
					<Line icon={<RepeatIcon />}>
						{REPEATS.find((entry) => entry.id === repeat)?.name ?? "Repeats on a custom rule"}
					</Line>
				)}
				{location === undefined ? null : <Line icon={<MapPinIcon />}>{location}</Line>}
				{guests.length > 1 ? (
					<Line icon={<UsersIcon />}>
						<div mix={[raw({ display: "grid", gap: "0.375rem" })]}>
							<span>{`${guests.length} guests`}</span>
							<ul
								mix={[
									raw({
										display: "grid",
										gap: "0.3125rem",
										margin: "0",
										padding: "0",
										listStyle: "none",
									}),
								]}
							>
								{guests.map((guest) => {
									let person = findPerson(guest);
									return (
										<li mix={[raw({ display: "flex", gap: "0.5rem", alignItems: "center" })]}>
											<PersonDot id={guest} size={20} />
											<span>
												{person?.name ?? guest}
												{guest === organizer ? (
													<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
														{" "}
														· Organizer
													</span>
												) : null}
											</span>
										</li>
									);
								})}
							</ul>
						</div>
					</Line>
				) : null}
				{event.description === undefined ? null : (
					<p
						mix={[
							raw({
								margin: "0",
								fontSize: "0.8125rem",
								lineHeight: "1.25rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						{event.description}
					</p>
				)}
				<Line icon={<CalendarIcon />}>{calendar?.name ?? ""}</Line>
				{invited ? (
					<form
						method="post"
						action={actionHref(`events/${encodeURIComponent(instance.key)}/rsvp`)}
						mix={[
							raw({ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }),
						]}
					>
						<input type="hidden" name="back" value={back} />
						<span
							mix={[
								raw({
									fontSize: "0.8125rem",
									marginInlineEnd: "auto",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							Going?
						</span>
						{ANSWERS.map((answer) => (
							<Button
								type="submit"
								name="rsvp"
								value={answer.id}
								size="sm"
								variant={rsvp === answer.id ? "solid" : "outline"}
								color={rsvp === answer.id ? "brand" : "neutral"}
								aria-pressed={rsvp === answer.id ? "true" : "false"}
							>
								{answer.label}
							</Button>
						))}
					</form>
				) : null}
				{readOnly ? null : (
					<div mix={[raw({ display: "flex", gap: "0.5rem", justifyContent: "flex-end" })]}>
						<form
							method="post"
							action={actionHref(`events/${encodeURIComponent(instance.key)}/delete`)}
						>
							<input type="hidden" name="back" value={back} />
							<Button type="submit" size="sm" variant="ghost" color="neutral">
								<TrashIcon size={14} aria-hidden="true" />
								{repeat === "none" ? "Delete" : "Delete this one"}
							</Button>
						</form>
						<LinkButton href={editHref} size="sm" variant="outline" color="neutral">
							<PencilIcon size={14} aria-hidden="true" />
							Edit
						</LinkButton>
					</div>
				)}
			</div>
		);
	};
}

namespace Choice {
	export interface Props {
		id: string;
		name: string;
		label: string;
		value: string;
		options: Array<{ value: string; label: string }>;
	}
}

/** One labelled native select. */
function Choice(handle: Handle<Choice.Props>) {
	return () => {
		let { id, name, label, value, options } = handle.props;
		return (
			<div mix={[raw({ display: "grid", gap: "0.375rem", minInlineSize: "0" })]}>
				<Label htmlFor={id}>{label}</Label>
				<Select id={id} name={name}>
					{options.map((option) => (
						<Select.Option value={option.value} selected={option.value === value}>
							{option.label}
						</Select.Option>
					))}
				</Select>
			</div>
		);
	};
}

namespace EventDialog {
	export interface Props {
		/** `new` for a fresh event, or the occurrence key being edited. */
		target: string;
		draft: Draft;
		issues?: DraftIssues;
		/** Whether the event repeats, which offers "this one" or "all of them". */
		recurring: boolean;
		/** The page the dialog sits on, which closing returns to and the post answers with. */
		back: string;
		/** The page address without the dialog. */
		closeHref: string;
	}
}

/** The dialog's id; one dialog is open at a time, so it needs no other part. */
export const EVENT_DIALOG_ID = "sundial-event";

/**
 * The edit dialog: title, when (with an all-day switch and the zone the times are in), repeat,
 * calendar and colour, guests, place and notes. It posts to the event, or to `events/new`.
 */
export function EventDialog(handle: Handle<EventDialog.Props>) {
	return () => {
		let { target, draft, issues = {}, recurring, back, closeHref } = handle.props;
		let id = EVENT_DIALOG_ID;
		let isNew = target === "new";
		return (
			<HeadingScope level={2}>
				<RouteDialog
					id={id}
					closeHref={closeHref}
					closeLabel="Close"
					aria-labelledby={`${id}-title`}
					mix={[raw({ inlineSize: "min(38rem, calc(100vw - 2rem))", maxInlineSize: "none" })]}
				>
					<form
						method="post"
						action={actionHref(isNew ? "events/new" : `events/${encodeURIComponent(target)}`)}
						mix={[raw({ display: "grid", gap: "1rem" })]}
					>
						<input type="hidden" name="back" value={back} />
						<Dialog.Header>
							<Dialog.Title id={`${id}-title`}>{isNew ? "New event" : "Edit event"}</Dialog.Title>
						</Dialog.Header>
						<TextField
							label="Title"
							name="title"
							defaultValue={draft.title}
							placeholder="Add a title"
							maxLength={120}
							errorMessage={issues.title}
						/>
						<fieldset
							mix={[
								raw({
									display: "grid",
									gap: "0.75rem",
									margin: "0",
									padding: "0",
									border: "none",
									minInlineSize: "0",
								}),
							]}
						>
							<legend
								mix={[
									raw({
										padding: "0",
										marginBlockEnd: "0.5rem",
										fontSize: "0.8125rem",
										fontWeight: "600",
									}),
								]}
							>
								When
							</legend>
							{[
								{
									date: "date",
									time: "start",
									label: "Starts",
									dateValue: draft.date,
									timeValue: draft.start,
									issue: undefined,
								},
								{
									date: "endDate",
									time: "end",
									label: "Ends",
									dateValue: draft.endDate,
									timeValue: draft.end,
									issue: issues.end,
								},
							].map((row) => (
								<div
									mix={[
										raw({
											display: "grid",
											gap: "0.75rem",
											gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
											alignItems: "start",
										}),
									]}
								>
									<DateField
										label={row.label}
										name={row.date}
										defaultValue={row.dateValue}
										required={row.date === "date"}
									/>
									<TimeField
										label="Time"
										name={row.time}
										defaultValue={row.timeValue}
										errorMessage={row.issue}
									/>
								</div>
							))}
							<label
								mix={[
									raw({
										display: "inline-flex",
										alignItems: "center",
										gap: "0.5rem",
										fontSize: "0.875rem",
									}),
								]}
							>
								<input type="checkbox" name="allDay" checked={draft.allDay} />
								All day (the times are ignored)
							</label>
							<div
								mix={[
									raw({
										display: "grid",
										gap: "0.75rem",
										gridTemplateColumns: "repeat(auto-fit, minmax(min(12rem, 100%), 1fr))",
									}),
								]}
							>
								<Choice
									id={`${id}-zone`}
									name="zone"
									label="Time zone"
									value={draft.zone}
									options={ZONES.map((zone) => ({ value: zone.id, label: zone.label }))}
								/>
								<Choice
									id={`${id}-repeat`}
									name="repeat"
									label="Repeat"
									value={draft.repeat}
									options={[
										...REPEATS.map((repeat) => ({ value: repeat.id, label: repeat.name })),
										...(draft.repeat === "custom"
											? [{ value: "custom", label: "Custom rule (kept)" }]
											: []),
									]}
								/>
							</div>
							{recurring ? (
								<div
									role="radiogroup"
									aria-label="Change"
									mix={[
										raw({ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.875rem" }),
									]}
								>
									<label
										mix={[raw({ display: "inline-flex", gap: "0.375rem", alignItems: "center" })]}
									>
										<input
											type="radio"
											name="scope"
											value="this"
											checked={draft.scope === "this"}
										/>
										This event
									</label>
									<label
										mix={[raw({ display: "inline-flex", gap: "0.375rem", alignItems: "center" })]}
									>
										<input type="radio" name="scope" value="all" checked={draft.scope === "all"} />
										All events in the series
									</label>
								</div>
							) : null}
						</fieldset>
						<div
							mix={[
								raw({
									display: "grid",
									gap: "0.75rem",
									gridTemplateColumns: "repeat(auto-fit, minmax(min(12rem, 100%), 1fr))",
								}),
							]}
						>
							<Choice
								id={`${id}-calendar`}
								name="calendar"
								label="Calendar"
								value={draft.calendar}
								options={CALENDARS.filter((calendar) => !calendar.subscribed).map((calendar) => ({
									value: calendar.id,
									label: calendar.name,
								}))}
							/>
							<fieldset
								mix={[raw({ margin: "0", padding: "0", border: "none", minInlineSize: "0" })]}
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
									Color
								</legend>
								<div mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.375rem" })]}>
									{[
										{
											id: "",
											name: "Calendar's colour",
											value: colorValue(findCalendar(draft.calendar)?.color),
										},
										...COLORS,
									].map((color) => (
										<label
											title={color.name}
											mix={[
												raw({
													position: "relative",
													display: "inline-grid",
													placeItems: "center",
													inlineSize: "1.75rem",
													blockSize: "1.75rem",
													cursor: "pointer",
												}),
											]}
										>
											<input
												type="radio"
												name="color"
												value={color.id}
												checked={draft.color === color.id}
												aria-label={color.name}
												mix={[
													raw({
														position: "absolute",
														inset: "0",
														margin: "0",
														opacity: "0",
														cursor: "pointer",
													}),
												]}
											/>
											<span
												aria-hidden="true"
												style={`background-color: ${color.value}`}
												mix={[
													raw({
														inlineSize: "1.25rem",
														blockSize: "1.25rem",
														borderRadius: "999px",
														boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.1)",
														":checked + &": {
															boxShadow: "0 0 0 2px var(--ui-bg, Canvas), 0 0 0 4px currentColor",
														},
														":focus-visible + &": {
															outline: "2px solid var(--ui-brand-ring)",
															outlineOffset: "3px",
														},
													}),
												]}
											/>
										</label>
									))}
								</div>
							</fieldset>
						</div>
						<fieldset
							mix={[raw({ margin: "0", padding: "0", border: "none", minInlineSize: "0" })]}
						>
							<legend
								mix={[
									raw({
										padding: "0",
										marginBlockEnd: "0.5rem",
										fontSize: "0.8125rem",
										fontWeight: "600",
									}),
								]}
							>
								Guests
							</legend>
							<div
								mix={[
									raw({
										display: "grid",
										gap: "0.375rem",
										gridTemplateColumns: "repeat(auto-fill, minmax(min(11rem, 100%), 1fr))",
									}),
								]}
							>
								{PEOPLE.map((person) => (
									<label
										mix={[
											raw({
												display: "flex",
												alignItems: "center",
												gap: "0.5rem",
												fontSize: "0.875rem",
												minInlineSize: "0",
											}),
										]}
									>
										<input
											type="checkbox"
											name="guests"
											value={person.id}
											checked={draft.guests.includes(person.id)}
										/>
										<PersonDot id={person.id} size={20} />
										<span
											mix={[
												raw({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
											]}
										>
											{person.id === ME ? `${person.name} (you)` : person.name}
										</span>
									</label>
								))}
							</div>
						</fieldset>
						<TextField
							label="Location"
							name="location"
							defaultValue={draft.location}
							placeholder="Add a room or a link"
							maxLength={120}
						/>
						<div mix={[raw({ display: "grid", gap: "0.375rem" })]}>
							<Label htmlFor={`${id}-notes`}>Notes</Label>
							<TextArea
								id={`${id}-notes`}
								name="notes"
								rows={3}
								defaultValue={draft.notes}
								maxLength={600}
							/>
						</div>
						<Dialog.Footer>
							<LinkButton href={closeHref} variant="outline" color="neutral">
								Cancel
							</LinkButton>
							<Button type="submit" color="brand">
								{isNew ? "Create event" : "Save"}
							</Button>
						</Dialog.Footer>
					</form>
				</RouteDialog>
			</HeadingScope>
		);
	};
}

/** Formats a draft's span for a toast, such as "Wed, Nov 18 · 9:00 AM". */
export function draftWhen(draft: Draft): string {
	let minute = minuteOf(draft.start);
	return `${formatDay(draft.date, "short")}${draft.allDay || minute === null ? "" : ` · ${formatMinute(minute)}`}`;
}
