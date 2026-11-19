/**
 * Sundial, an invented calendar: day, three-day, week and month views and an agenda, events
 * dragged, resized and created on the grid, a second time zone, and a "find a time" view across
 * a team in five zones. Chalk paper, slate ink, dial blue and a marigold now line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Toast } from "@sdxc/ui/app";
import type { RemixNode } from "remix/component";

import { iife } from "@sdxc/iife";
import { raw } from "@sdxc/u/general";
import { LinkButton } from "@sdxc/ui";
import { readAppShellCookie } from "@sdxc/ui/app/app-shell";

import type {
	DemoApp,
	DemoAppRedirect,
	DemoAppRequest,
	DemoAppScreen,
} from "~/resources/views/demo-apps";

import { DEMO_APP_TOAST_PARAM, readToastParam } from "~/resources/views/demo-apps";
import {
	MAIN_FRAME,
	MainFrame,
	MainScreen,
	mainSource,
} from "~/resources/views/demo-apps/main-frame";
import { MainFrameSync } from "~/resources/views/demo-apps/main-frame-sync";

import type { CalendarEvent } from "./data";
import type { Draft, DraftIssues } from "./event";
import type { Changes, Visitor } from "./state";
import type { ViewContext, ViewId } from "./views";

import { CALENDARS, ZONES, actionHref, findPerson, href, seedEvents, shiftDate } from "./data";
import { EventDialog, blankDraft, draftOf, eventFields, readDraft } from "./event";
import { DEFAULT_WITH, FindScreen, LENGTHS } from "./find";
import { SundialShell, rangeTitle } from "./shell";
import {
	SHELL_COOKIE,
	changesCookies,
	eventsOf,
	hiddenCookie,
	isPersonal,
	readVisitor,
	resetCookies,
	undoCookies,
	zonesCookie,
} from "./state";
import { SundialThumbnail } from "./thumbnail";
import { clockAt, instancesIn, instantAt, nowIn } from "./time";
import { AgendaScreen, DaysView, MonthScreen, VIEW_PATHS, WeekView, viewPage } from "./views";

/** Dial blue at hue 245: the shadow a gnomon casts on a bright morning. */
const BRAND = [
	"oklch(0.97 0.015 245)",
	"oklch(0.93 0.035 245)",
	"oklch(0.86 0.07 245)",
	"oklch(0.77 0.1 245)",
	"oklch(0.67 0.13 245)",
	"oklch(0.57 0.14 245)",
	"oklch(0.49 0.13 247)",
	"oklch(0.42 0.11 248)",
	"oklch(0.35 0.09 250)",
	"oklch(0.28 0.07 252)",
	"oklch(0.21 0.05 255)",
] as const;

/** Chalk to slate: warm paper on the light end, blue-grey ink on the dark. */
const NEUTRAL = [
	"oklch(0.985 0.005 85)",
	"oklch(0.965 0.007 85)",
	"oklch(0.92 0.009 85)",
	"oklch(0.86 0.011 80)",
	"oklch(0.72 0.013 250)",
	"oklch(0.58 0.016 250)",
	"oklch(0.46 0.018 250)",
	"oklch(0.37 0.018 250)",
	"oklch(0.28 0.016 250)",
	"oklch(0.21 0.014 250)",
	"oklch(0.155 0.012 250)",
] as const;

/** A grotesk for the interface, compact radii, and the marigold now line. */
const TOKENS = {
	"--ui-font-sans":
		"'Inter Variable', Inter, 'Segoe UI Variable Text', 'Segoe UI', ui-sans-serif, system-ui, -apple-system, sans-serif",
	"--ui-radius-sm": "0.25rem",
	"--ui-radius-md": "0.375rem",
	"--ui-radius-lg": "0.625rem",
	"--ui-time-grid-now": "oklch(0.72 0.16 70)",
	"--ui-time-grid-hour": "3.25rem",
} as const;

/** The pages a post may return to, so a post can never send the visitor elsewhere. */
const BACK = /^(|days|day|month|agenda|find)\?[\w=&%.,~-]*$/;

/** The calendar screens every path answers with. */
const PAGES: Record<string, ViewId | "find"> = {
	"": "week",
	[VIEW_PATHS.days]: "days",
	[VIEW_PATHS.day]: "day",
	[VIEW_PATHS.month]: "month",
	[VIEW_PATHS.agenda]: "agenda",
	find: "find",
};

/** The Undo every change's toast offers, posting to the action that restores the last change. */
const UNDO: Toast.FlashAction = { label: "Undo", form: { action: actionHref("undo"), fields: {} } };

/** Every toast a Sundial redirect can name. */
const TOASTS: DemoApp["toasts"] = {
	created: { color: "neutral", title: "Event created", action: UNDO },
	moved: { color: "neutral", title: "Event moved", action: UNDO },
	saved: { color: "neutral", title: "Event saved", action: UNDO },
	deleted: { color: "neutral", title: "Event deleted", action: UNDO },
	rsvp: { color: "neutral", title: "Answer sent", action: UNDO },
	undone: { color: "neutral", title: "Change undone" },
	zones: { color: "neutral", title: "Time zones saved" },
	reset: {
		color: "neutral",
		title: "Demo reset",
		description: "Your calendar is back to how it started.",
	},
};

/** Reads a field as text. */
function field(form: FormData, name: string): string {
	let value = form.get(name);
	return typeof value === "string" ? value : "";
}

/** Whether a value is a `YYYY-MM-DD` day. */
function isDate(value: string | null): value is string {
	return (
		value !== null &&
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		!Number.isNaN(Date.parse(`${value}T00:00:00Z`))
	);
}

/** Everything a screen reads from a request. */
interface Scene {
	visitor: Visitor;
	context: ViewContext;
	/** Every event, hidden calendars included, for the people comparison. */
	everything: CalendarEvent[];
}

/** Reads the visitor, the clock and the screen's day from a request. */
function sceneOf(request: DemoAppRequest, view: ViewId | "find"): Scene {
	let visitor = readVisitor(request.cookie);
	let at = Date.now();
	let now = nowIn(visitor.zone, at);
	let wanted = request.url.searchParams.get("d");
	let anchor = isDate(wanted) ? wanted : now.date;
	let everything = eventsOf(visitor, now.date);
	let extra =
		view === "find"
			? `with=${readWith(request.url).join(",")}&length=${readLength(request.url)}`
			: "";
	return {
		visitor,
		everything,
		context: {
			view,
			anchor,
			today: now.date,
			now: { ...now, at },
			zone: visitor.zone,
			second: visitor.second,
			events: everything.filter((event) => !visitor.hidden.includes(event.calendar)),
			back: viewPage(view, anchor, extra),
		},
	};
}

/** The teammates a find-a-time address compares. */
function readWith(url: URL): string[] {
	let picked = url.searchParams.getAll("with").flatMap((value) => value.split(","));
	let valid = picked.filter((id) => findPerson(id) !== undefined && id !== "noor");
	return url.searchParams.has("with") ? [...new Set(valid)] : DEFAULT_WITH;
}

/** The meeting length a find-a-time address looks for. */
function readLength(url: URL): number {
	let value = Number(url.searchParams.get("length"));
	return (LENGTHS as readonly number[]).includes(value) ? value : 30;
}

/** An occurrence by its key, `id~day`, or `undefined` when it is not on the calendar. */
function findInstance(events: CalendarEvent[], key: string, zone: string) {
	let [id = "", day = ""] = key.split("~");
	let event = events.find((entry) => entry.id === id);
	if (!event || !isDate(day)) return undefined;
	return instancesIn([event], shiftDate(day, -2), 5, zone).find(
		(instance) => instance.key === `${id}~${day}`,
	);
}

/** The dialog the address asks for: an event's edit form, or a new event's. */
function dialogOf(
	request: DemoAppRequest,
	scene: Scene,
	refused?: { target: string; draft: Draft; issues: DraftIssues },
): RemixNode {
	let { context } = scene;
	let closeHref = href(context.back);
	if (refused) {
		let instance =
			refused.target === "new"
				? undefined
				: findInstance(scene.everything, refused.target, context.zone);
		return (
			<EventDialog
				target={refused.target}
				draft={refused.draft}
				issues={refused.issues}
				recurring={instance !== undefined && instance.event.repeat !== "none"}
				back={context.back}
				closeHref={closeHref}
			/>
		);
	}
	let params = request.url.searchParams;
	let edit = params.get("edit");
	if (edit !== null) {
		let instance = findInstance(scene.everything, edit, context.zone);
		if (
			!instance ||
			CALENDARS.find((calendar) => calendar.id === instance.event.calendar)?.subscribed
		)
			return null;
		return (
			<EventDialog
				target={instance.key}
				draft={draftOf(instance)}
				recurring={instance.event.repeat !== "none"}
				back={context.back}
				closeHref={closeHref}
			/>
		);
	}
	let date = params.get("date");
	if (params.has("new") || isDate(date)) {
		let start = Number(params.get("start"));
		let end = Number(params.get("end"));
		let day = isDate(date) ? date : context.anchor;
		let validStart = Number.isInteger(start) && start >= 0 && start < 1440 && params.has("start");
		let from = iife(() => {
			if (validStart) return start;
			if (day === context.today)
				return Math.min(1380, (Math.floor(context.now.minute / 60) + 1) * 60);
			return 540;
		});
		let to = Number.isInteger(end) && end > from && end <= 1440 ? end : from + 60;
		let guests = (params.get("guests") ?? "").split(",").filter((id) => findPerson(id));
		return (
			<EventDialog
				target="new"
				draft={blankDraft(day, from, to, context.zone, guests)}
				recurring={false}
				back={context.back}
				closeHref={closeHref}
			/>
		);
	}
	return null;
}

/** One rendered screen: its document title and its content inside the shell. */
interface Screen {
	title: string;
	status?: number;
	content: RemixNode;
}

/** The app's own 404, inside its shell. */
function notFound(scene: Scene): Screen {
	return {
		title: "Not found",
		status: 404,
		content: (
			<div mix={[raw({ display: "grid", gap: "0.75rem", justifyItems: "start", padding: "2rem" })]}>
				<h2 mix={[raw({ margin: "0", fontSize: "1.25rem" })]}>There's no such page in Sundial</h2>
				<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>
					The address may have a typo. Your week is one click away.
				</p>
				<LinkButton href={href(`?d=${scene.context.today}`)}>Back to this week</LinkButton>
			</div>
		),
	};
}

/** Picks the screen a page path names, with the dialog its address opens. */
function route(
	request: DemoAppRequest,
	refused?: { target: string; draft: Draft; issues: DraftIssues },
): { scene: Scene; screen: Screen } {
	let view = Object.hasOwn(PAGES, request.page) ? PAGES[request.page]! : null;
	let scene = sceneOf(request, view ?? "week");
	if (view === null) return { scene, screen: notFound(scene) };
	let { context } = scene;
	let body = (() => {
		if (view === "week") return <WeekView context={context} />;
		if (view === "days") return <DaysView context={context} count={3} />;
		if (view === "day") return <DaysView context={context} count={1} />;
		if (view === "month") return <MonthScreen context={context} />;
		if (view === "agenda") return <AgendaScreen context={context} />;
		return (
			<FindScreen
				context={context}
				with={readWith(request.url)}
				length={readLength(request.url)}
				everything={scene.everything}
			/>
		);
	})();
	return {
		scene,
		screen: {
			title: view === "find" ? "Find a time" : rangeTitle(context),
			status: refused ? 400 : undefined,
			content: (
				<>
					{body}
					{dialogOf(request, scene, refused)}
				</>
			),
		},
	};
}

/** The main frame's content: the screen in its shell, with the toast a post named. */
function mainContent(request: DemoAppRequest, scene: Scene, screen: Screen): RemixNode {
	let param = request.url.searchParams.get(DEMO_APP_TOAST_PARAM);
	let key = param === null ? null : readToastParam(param).key;
	return (
		<MainScreen
			title={screen.title}
			url={request.url}
			toast={key !== null && Object.hasOwn(TOASTS, key) ? TOASTS[key] : undefined}
		>
			<SundialShell
				context={scene.context}
				hidden={scene.visitor.hidden}
				collapsed={readAppShellCookie(request.cookie, SHELL_COOKIE)}
			>
				{screen.content}
			</SundialShell>
		</MainScreen>
	);
}

/** The page a post returns to, if it is one of Sundial's. */
function backOf(form: FormData): string {
	let back = field(form, "back");
	return BACK.test(back) ? back : "";
}

/** A copy of changes with one event stored: patched when it is a seed, else in the visitor's list. */
function putEvent(changes: Changes, seedIds: Set<string>, event: CalendarEvent): Changes {
	if (seedIds.has(event.id)) {
		let { id: _id, ...fields } = event;
		return { ...changes, patched: { ...changes.patched, [event.id]: fields } };
	}
	let added = changes.added.filter((entry) => entry.id !== event.id);
	return { ...changes, added: [...added, event] };
}

/** A fresh id for a visitor's event, unique among their events. */
function newId(changes: Changes): string {
	let used = new Set(changes.added.map((event) => event.id));
	let index = changes.added.length + 1;
	while (used.has(`mine-${index}`)) index += 1;
	return `mine-${index}`;
}

/**
 * Stores an event's new time. A repeating event moved by one occurrence skips that day and
 * gains a one-off copy at the new time, so the rest of the series stays where it was.
 */
function reschedule(
	changes: Changes,
	seedIds: Set<string>,
	event: CalendarEvent,
	day: string,
	fields: Partial<CalendarEvent>,
	scope: "this" | "all",
): Changes {
	if (event.repeat === "none" || scope === "all")
		return putEvent(changes, seedIds, { ...event, ...fields });
	let series = { ...event, exceptions: [...new Set([...(event.exceptions ?? []), day])] };
	let copy: CalendarEvent = {
		...event,
		...fields,
		id: `${event.id}-${day.replaceAll("-", "")}`,
		repeat: "none",
		exceptions: undefined,
	};
	return putEvent(putEvent(changes, seedIds, series), seedIds, copy);
}

/** Answers a refused edit with the screen and its dialog showing what was typed. */
function refusedScreen(
	request: DemoAppRequest,
	back: string,
	target: string,
	draft: Draft,
	issues: DraftIssues,
): DemoAppScreen {
	let [path = "", query = ""] = back.split("?");
	let url = new URL(href(`${path}?${query}`), request.url);
	let shown = { ...request, page: path, url };
	let { scene, screen } = route(shown, { target, draft, issues });
	let content = mainContent(shown, scene, screen);
	return {
		title: screen.title,
		status: 400,
		body: (
			<>
				<div data-main-region="">{content}</div>
				<MainFrameSync root={href()} />
			</>
		),
		frames: { [MAIN_FRAME]: content },
	};
}

/** Saves the edit dialog's post, or answers with the dialog and what to fix. */
function submitEvent(
	target: string,
	form: FormData,
	request: DemoAppRequest,
	scene: Scene,
): DemoAppRedirect | DemoAppScreen | null {
	let back = backOf(form);
	let draft = readDraft(form);
	let checked = eventFields(draft);
	if ("issues" in checked) return refusedScreen(request, back, target, draft, checked.issues);
	let { visitor } = scene;
	let seedIds = new Set(seedEvents(scene.context.today).map((event) => event.id));
	if (target === "new") {
		let event: CalendarEvent = { ...checked.fields, id: newId(visitor.changes) };
		let next = putEvent(visitor.changes, seedIds, event);
		return { page: back, toast: "created", cookies: changesCookies(visitor, next, back) };
	}
	let instance = findInstance(scene.everything, target, scene.context.zone);
	if (!instance) return null;
	let { event } = instance;
	let fields: Partial<CalendarEvent> = { ...checked.fields };
	if (event.repeat !== "none" && draft.scope === "all")
		fields = { ...fields, date: event.date, exceptions: event.exceptions };
	if (event.organizer !== undefined) fields.organizer = event.organizer;
	if (event.rsvp !== undefined) fields.rsvp = event.rsvp;
	let next = reschedule(visitor.changes, seedIds, event, instance.day, fields, draft.scope);
	return { page: back, toast: "saved", cookies: changesCookies(visitor, next, back) };
}

/** Moves or resizes an occurrence to a day and minutes on the viewer's clock, as the grid posts. */
function submitMove(form: FormData, scene: Scene): DemoAppRedirect | null {
	let back = backOf(form);
	let key = field(form, "id").split("~").slice(0, 2).join("~");
	let date = field(form, "date");
	let start = Number(field(form, "start"));
	let end = Number(field(form, "end"));
	if (
		!isDate(date) ||
		!Number.isInteger(start) ||
		!Number.isInteger(end) ||
		start < 0 ||
		end > 1440 ||
		end <= start
	)
		return null;
	let instance = findInstance(scene.everything, key, scene.context.zone);
	if (!instance || instance.event.start === null) return null;
	if (CALENDARS.find((calendar) => calendar.id === instance.event.calendar)?.subscribed)
		return null;
	let at = clockAt(instantAt(date, start, scene.context.zone), instance.event.zone);
	let seedIds = new Set(seedEvents(scene.context.today).map((event) => event.id));
	let next = reschedule(
		scene.visitor.changes,
		seedIds,
		instance.event,
		instance.day,
		{ date: at.date, start: at.minute, length: end - start },
		"this",
	);
	return { page: back, toast: "moved", cookies: changesCookies(scene.visitor, next, back) };
}

/** Deletes an occurrence: a one-off goes, a repeat skips that day. */
function submitDelete(key: string, form: FormData, scene: Scene): DemoAppRedirect | null {
	let back = backOf(form);
	let instance = findInstance(scene.everything, key, scene.context.zone);
	if (!instance) return null;
	let { event } = instance;
	let seedIds = new Set(seedEvents(scene.context.today).map((entry) => entry.id));
	let changes = scene.visitor.changes;
	let next = iife(() => {
		if (event.repeat !== "none")
			return putEvent(changes, seedIds, {
				...event,
				exceptions: [...(event.exceptions ?? []), instance.day],
			});
		if (seedIds.has(event.id)) return { ...changes, deleted: [...changes.deleted, event.id] };
		return { ...changes, added: changes.added.filter((entry) => entry.id !== event.id) };
	});
	return { page: back, toast: "deleted", cookies: changesCookies(scene.visitor, next, back) };
}

/** Records the visitor's answer to an invitation. */
function submitRsvp(key: string, form: FormData, scene: Scene): DemoAppRedirect | null {
	let answer = field(form, "rsvp");
	if (answer !== "yes" && answer !== "maybe" && answer !== "no") return null;
	let instance = findInstance(scene.everything, key, scene.context.zone);
	if (!instance) return null;
	let back = backOf(form);
	let seedIds = new Set(seedEvents(scene.context.today).map((event) => event.id));
	let next = putEvent(scene.visitor.changes, seedIds, { ...instance.event, rsvp: answer });
	return { page: back, toast: "rsvp", cookies: changesCookies(scene.visitor, next, back) };
}

/** Every screen a visitor reaches by clicking, so a test can walk them all. */
const SCREENS = [
	"",
	"days",
	"day",
	"month",
	"agenda",
	"find",
	"find?with=priya,aiko&length=60",
	"?new=1",
	"?date=2026-11-18&start=600&end=660",
];

export default {
	name: "Sundial",
	kind: "Calendar",
	tagline: "Your week, in every time zone.",
	artDirection: "Chalk paper, slate ink, dial blue, a marigold now line.",
	description:
		"Sundial, an invented calendar: day, week and month views, an agenda, events you drag, resize and create on the grid, a second time zone, and a find-a-time view across a team in five zones.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: () => <SundialThumbnail />,
	screens: SCREENS,
	cookies: [SHELL_COOKIE],
	isPersonal,
	toasts: TOASTS,
	render(request) {
		let { screen } = route(request);
		return {
			title: screen.title,
			status: screen.status,
			body: (
				<>
					<MainFrame src={mainSource(request.url)} />
					<MainFrameSync root={href()} />
				</>
			),
		};
	},
	target(name, request) {
		if (name !== MAIN_FRAME) return null;
		let { scene, screen } = route(request);
		return mainContent(request, scene, screen);
	},
	submit(page, form, request) {
		let view = PAGES[backOf(form).split("?")[0] ?? ""] ?? "week";
		let scene = sceneOf(request, view);
		let back = backOf(form);
		if (page === "reset")
			return { page: "", toast: "reset", cookies: resetCookies(request.cookie) };
		if (page === "undo") {
			let target = scene.visitor.undo?.back ?? "";
			return {
				page: BACK.test(target) ? target : "",
				toast: "undone",
				cookies: undoCookies(scene.visitor),
			};
		}
		if (page === "move") return submitMove(form, scene);
		if (page === "calendars") {
			let shown = form.getAll("show").map(String);
			let hidden = CALENDARS.map((calendar) => calendar.id).filter((id) => !shown.includes(id));
			return { page: back, cookies: [hiddenCookie(hidden)] };
		}
		if (page === "zones") {
			let zone = ZONES.find((entry) => entry.id === field(form, "zone"))?.id;
			let second = field(form, "second");
			if (!zone) return null;
			let secondZone =
				second === "none" ? null : (ZONES.find((entry) => entry.id === second)?.id ?? null);
			return { page: back, toast: "zones", cookies: [zonesCookie(zone, secondZone)] };
		}
		let [first, key, action, extra] = page.split("/");
		if (first !== "events" || key === undefined || extra !== undefined) return null;
		let decoded = decodeURIComponent(key);
		if (action === undefined) return submitEvent(decoded, form, request, scene);
		if (action === "delete") return submitDelete(decoded, form, scene);
		if (action === "rsvp") return submitRsvp(decoded, form, scene);
		return null;
	},
} satisfies DemoApp;
