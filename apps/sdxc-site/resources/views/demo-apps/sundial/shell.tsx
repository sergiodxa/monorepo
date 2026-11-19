/**
 * Sundial's frame: a sidebar with the views, a month to jump by, the calendars to show and the
 * zones to read the day in; a top bar with Today, the arrows, the range's name, the view switch,
 * Find a time and New event; and the keyboard help every shortcut is listed in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	ArrowDownUpIcon,
	CalendarDaysIcon,
	CalendarRangeIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	Columns3Icon,
	KeyboardIcon,
	ListIcon,
	PlusIcon,
	RotateCwIcon,
	SquareIcon,
	UsersIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { media } from "@sdxc/u/responsive";
import { Button, Keyboard, LinkButton, Menu } from "@sdxc/ui";
import { AppShell } from "@sdxc/ui/app/app-shell";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import { SettingsInstantSave } from "@sdxc/ui/app/settings-section";
import { RangeMonths } from "@sdxc/ui/range-months";

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import { UserMenu, WorkspaceMenu } from "../account-menus";

import type { ViewContext, ViewId } from "./views";

import {
	CALENDARS,
	LOCALE,
	ME,
	SLUG,
	ZONES,
	actionHref,
	colorValue,
	href,
	mondayOf,
	shiftDate,
} from "./data";
import { PersonDot } from "./event";
import { SHELL_COOKIE } from "./state";
import { clockAt, instancesIn } from "./time";
import { viewHref, viewSpan } from "./views";

/** The keyboard help sheet's id. */
export const HELP_ID = "sundial-keys";

/** The shell's strings. */
const SHELL_LABELS: AppShell.Labels = {
	nav: "Sundial",
	skip: "Skip to calendar",
	menu: "Open navigation",
	close: "Close navigation",
	collapse: "Collapse sidebar",
};

/** The help sheet's strings. */
const HELP_LABELS: KeyboardHelp.Labels = {
	title: "Keyboard shortcuts",
	close: "Close",
	or: "or",
	open: "Show keyboard shortcuts",
	general: "General",
	other: "More",
};

/** The keys the sheet lists beside the ones the page declares with `data-shortcut`. */
const HELP_GROUPS: KeyboardHelp.Group[] = [
	{
		title: "Events",
		shortcuts: [
			{ keys: "c", label: "New event" },
			{ keys: "alt+arrowup", label: "Move the focused event 15 minutes earlier" },
			{ keys: "alt+arrowdown", label: "Move the focused event 15 minutes later" },
			{ keys: "alt+arrowleft", label: "Move the focused event a day earlier" },
			{ keys: "alt+arrowright", label: "Move the focused event a day later" },
			{ keys: "alt+shift+arrowdown", label: "End the focused event 15 minutes later" },
			{ keys: "alt+shift+arrowup", label: "End the focused event 15 minutes earlier" },
		],
	},
	{
		title: "Navigation",
		shortcuts: [
			{ keys: "t", label: "Go to today" },
			{ keys: "j", label: "Next range" },
			{ keys: "k", label: "Previous range" },
			{ keys: "d", label: "Day view" },
			{ keys: "x", label: "Three-day view" },
			{ keys: "w", label: "Week view" },
			{ keys: "m", label: "Month view" },
			{ keys: "a", label: "Agenda" },
			{ keys: "f", label: "Find a time" },
		],
	},
	{
		title: "General",
		shortcuts: [{ keys: "?", label: "Show keyboard shortcuts" }],
	},
];

/** The view switch's entries: name, key, and icon for the collapsed rail. */
const VIEWS: Array<{ id: ViewId; label: string; short: string; key: string; icon: RemixNode }> = [
	{ id: "day", label: "Day", short: "Day", key: "d", icon: <SquareIcon /> },
	{ id: "days", label: "3 days", short: "3D", key: "x", icon: <Columns3Icon /> },
	{ id: "week", label: "Week", short: "Week", key: "w", icon: <CalendarRangeIcon /> },
	{ id: "month", label: "Month", short: "Month", key: "m", icon: <CalendarDaysIcon /> },
	{ id: "agenda", label: "Agenda", short: "List", key: "a", icon: <ListIcon /> },
];

/** Content the collapsed rail has no room for. */
const FULL_SIDEBAR_ONLY = raw({
	'[data-slot="app-shell"]:has([data-app-shell-collapse]:checked) &': { display: "none" },
});

/** The small heading over a sidebar section. */
function SectionTitle(handle: Handle<{ children: string }>) {
	return () => (
		<h2
			mix={[
				raw({
					margin: "0",
					paddingInline: "0.5rem",
					fontSize: "0.6875rem",
					fontWeight: "600",
					letterSpacing: "0.05em",
					textTransform: "uppercase",
					color: "var(--ui-neutral-fg-muted)",
				}),
			]}
		>
			{handle.props.children}
		</h2>
	);
}

/** The Save button a form shows when no script submits it on change. */
function NoScriptSave(handle: Handle<{ children: string }>) {
	return () => (
		<noscript>
			<Button type="submit" size="sm" variant="outline" color="neutral">
				{handle.props.children}
			</Button>
		</noscript>
	);
}

/** The sidebar under the views: the month, the calendars, the zones. */
function SidebarExtras(handle: Handle<{ context: ViewContext; hidden: string[] }>) {
	return () => {
		let { context, hidden } = handle.props;
		let month = context.anchor.slice(0, 7);
		let first = mondayOf(`${month}-01`);
		let busy = new Set(
			instancesIn(context.events, shiftDate(first, -1), 43, context.zone).map(
				(instance) => instance.days?.first ?? clockAt(instance.start.getTime(), context.zone).date,
			),
		);
		let view: ViewId = context.view === "find" || context.view === "import" ? "week" : context.view;
		let back = context.back;
		return (
			<div
				mix={[FULL_SIDEBAR_ONLY, raw({ display: "grid", gap: "1.25rem", paddingBlock: "0.5rem" })]}
			>
				<RangeMonths
					single
					months={1}
					month={month}
					start={context.anchor}
					today={context.today}
					weekStartsOn={1}
					locale={LOCALE}
					label="Jump to a day"
					headingLevel={2}
					labels={{ previous: "Previous month", next: "Next month", selected: "shown" }}
					href={(next) =>
						next.start === undefined
							? viewHref(view, `${next.month}-01`)
							: viewHref(context.view === "find" ? "find" : view, next.start)
					}
					dayNote={(date) =>
						busy.has(date) ? (
							<span
								aria-hidden="true"
								mix={[
									raw({
										display: "block",
										inlineSize: "4px",
										blockSize: "4px",
										margin: "0 auto",
										borderRadius: "999px",
										backgroundColor: "currentColor",
										opacity: "0.55",
									}),
								]}
							/>
						) : null
					}
					mix={[raw({ "--ui-range-months-cell": "2rem", fontSize: "0.8125rem" })]}
				/>
				<form
					method="post"
					action={actionHref("calendars")}
					mix={[raw({ display: "grid", gap: "0.25rem" })]}
				>
					<input type="hidden" name="back" value={back} />
					{(["mine", "other"] as const).map((group) => (
						<fieldset
							mix={[
								raw({
									display: "grid",
									gap: "0.125rem",
									margin: "0 0 0.75rem",
									padding: "0",
									border: "none",
								}),
							]}
						>
							<legend mix={[raw({ padding: "0", marginBlockEnd: "0.375rem" })]}>
								<SectionTitle>{group === "mine" ? "My calendars" : "Other calendars"}</SectionTitle>
							</legend>
							{CALENDARS.filter(
								(calendar) => (group === "other") === (calendar.subscribed === true),
							).map((calendar) => (
								<label
									style={`--swatch: ${colorValue(calendar.color)}`}
									mix={[
										raw({
											display: "flex",
											alignItems: "center",
											gap: "0.625rem",
											minBlockSize: "2rem",
											paddingInline: "0.5rem",
											borderRadius: "0.375rem",
											fontSize: "0.875rem",
											color: "var(--ui-neutral-fg-emphasis)",
											cursor: "pointer",
											"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
											"&:has(:focus-visible)": {
												boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)",
											},
										}),
									]}
								>
									<input
										type="checkbox"
										name="show"
										value={calendar.id}
										checked={!hidden.includes(calendar.id)}
										mix={[
											raw({
												appearance: "none",
												flex: "none",
												display: "grid",
												placeItems: "center",
												inlineSize: "1rem",
												blockSize: "1rem",
												margin: "0",
												borderRadius: "0.25rem",
												border: "2px solid var(--swatch)",
												cursor: "pointer",
												"&:checked": { backgroundColor: "var(--swatch)" },
												"&:checked::after": {
													content: "''",
													inlineSize: "0.3125rem",
													blockSize: "0.5625rem",
													marginBlockStart: "-0.125rem",
													border: "solid white",
													borderWidth: "0 2px 2px 0",
													transform: "rotate(45deg)",
												},
												"&:focus-visible": { outline: "none" },
											}),
										]}
									/>
									{calendar.name}
								</label>
							))}
						</fieldset>
					))}
					<SettingsInstantSave />
					<NoScriptSave>Show calendars</NoScriptSave>
				</form>
				<form
					method="post"
					action={actionHref("zones")}
					mix={[raw({ display: "grid", gap: "0.5rem", paddingInline: "0.5rem" })]}
				>
					<input type="hidden" name="back" value={back} />
					<SectionTitle>Time zones</SectionTitle>
					{[
						{ name: "zone", label: "Primary", value: context.zone, none: false },
						{ name: "second", label: "Second column", value: context.second ?? "none", none: true },
					].map((field) => (
						<label
							mix={[
								raw({
									display: "grid",
									gap: "0.25rem",
									fontSize: "0.75rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{field.label}
							<select
								name={field.name}
								mix={[
									raw({
										blockSize: "2rem",
										paddingInline: "0.375rem",
										borderRadius: "0.375rem",
										border: "1px solid var(--ui-neutral-border)",
										backgroundColor: "var(--ui-bg, Canvas)",
										color: "var(--ui-neutral-fg)",
										font: "inherit",
										fontSize: "0.8125rem",
									}),
								]}
							>
								{field.none ? (
									<option value="none" selected={field.value === "none"}>
										None
									</option>
								) : null}
								{ZONES.map((zone) => (
									<option value={zone.id} selected={zone.id === field.value}>
										{zone.label}
									</option>
								))}
							</select>
						</label>
					))}
					<SettingsInstantSave />
					<NoScriptSave>Save zones</NoScriptSave>
				</form>
			</div>
		);
	};
}

/** The name of the range a view shows, such as "November 2026" or "Nov 30 – Dec 6, 2026". */
export function rangeTitle(context: ViewContext): string {
	let date = (value: string, options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" }).format(
			Date.parse(`${value}T00:00:00Z`),
		);
	if (context.view === "month") return date(context.anchor, { month: "long", year: "numeric" });
	if (context.view === "import") return "Import and export";
	if (context.view === "day" || context.view === "find")
		return date(context.anchor, { weekday: "long", month: "long", day: "numeric" });
	let span = viewSpan(context.view, context.anchor);
	let last = shiftDate(span.first, span.days - 1);
	if (span.first.slice(0, 7) === last.slice(0, 7))
		return date(span.first, { month: "long", year: "numeric" });
	return new Intl.DateTimeFormat(LOCALE, {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).formatRange(Date.parse(`${span.first}T00:00:00Z`), Date.parse(`${last}T00:00:00Z`));
}

/** Where the arrows lead: a view's previous and next range. */
function arrows(context: ViewContext): { previous: string; next: string } {
	if (context.view === "import")
		return {
			previous: viewHref("week", shiftDate(context.anchor, -7)),
			next: viewHref("week", shiftDate(context.anchor, 7)),
		};
	if (context.view === "find")
		return {
			previous: viewHref("find", shiftDate(context.anchor, -1)),
			next: viewHref("find", shiftDate(context.anchor, 1)),
		};
	if (context.view === "month") {
		let [year = 2026, month = 1] = context.anchor.split("-").map(Number);
		let at = (shift: number) =>
			new Date(Date.UTC(year, month - 1 + shift, 1)).toISOString().slice(0, 10);
		return { previous: viewHref("month", at(-1)), next: viewHref("month", at(1)) };
	}
	let { step } = viewSpan(context.view, context.anchor);
	return {
		previous: viewHref(context.view, shiftDate(context.anchor, -step)),
		next: viewHref(context.view, shiftDate(context.anchor, step)),
	};
}

namespace SundialShell {
	export interface Props {
		context: ViewContext;
		hidden: string[];
		collapsed: boolean;
		children: RemixNode;
	}
}

/**
 * Renders the shell around one screen. The calendar screens fill the height under the top bar
 * so the grid scrolls inside itself, and the top bar wraps onto a second row on a phone.
 */
export function SundialShell(handle: Handle<SundialShell.Props>) {
	return () => {
		let { context, hidden, collapsed, children } = handle.props;
		let { previous, next } = arrows(context);
		let currentView = context.view === "find" || context.view === "import" ? null : context.view;
		let newHref = viewHref(currentView ?? "week", context.anchor, "new=1");
		return (
			<AppShell
				id="sundial"
				labels={SHELL_LABELS}
				collapsed={collapsed}
				cookieName={SHELL_COOKIE}
				cookiePath={demoAppCookiePath(SLUG)}
				peek={false}
				fill
				sheetBelow="64rem"
				workspace={
					<>
						<AppShell.Identity
							avatar={<SundialMark />}
							name="Ridgeline"
							detail="Sundial workspace"
							commandfor="sundial-workspace-menu"
							command="toggle-popover"
						/>
						<WorkspaceMenu
							id="sundial-workspace-menu"
							label="Switch workspace"
							current={{ name: "Ridgeline", href: href() }}
							others={["Personal"]}
						/>
					</>
				}
				nav={
					<>
						<div
							mix={[raw({ paddingInline: "0.5rem", paddingBlockEnd: "0.5rem" }), FULL_SIDEBAR_ONLY]}
						>
							<LinkButton href={newHref} color="brand" mix={[raw({ inlineSize: "100%" })]}>
								<PlusIcon size={16} aria-hidden="true" />
								New event
							</LinkButton>
						</div>
						<AppShell.Group>
							{VIEWS.map((view) => (
								<AppShell.Item
									data-rmx-prefetch="intent"
									href={viewHref(view.id, context.anchor)}
									icon={view.icon}
									label={view.label}
									current={currentView === view.id}
								/>
							))}
							<AppShell.Item
								data-rmx-prefetch="intent"
								href={viewHref("find", context.anchor)}
								icon={<UsersIcon />}
								label="Find a time"
								current={context.view === "find"}
							/>
							<AppShell.Item
								data-rmx-prefetch="intent"
								href={viewHref("import", context.anchor)}
								icon={<ArrowDownUpIcon />}
								label="Import and export"
								current={context.view === "import"}
							/>
						</AppShell.Group>
						<SidebarExtras context={context} hidden={hidden} />
					</>
				}
				footer={
					<>
						<AppShell.Identity
							avatar={<PersonDot id={ME} size={24} />}
							name="Noor Haddad"
							detail="noor@ridgeline.studio"
							commandfor="sundial-user-menu"
							command="toggle-popover"
						/>
						<UserMenu
							id="sundial-user-menu"
							label="Account"
							helpId={HELP_ID}
							extra={
								<Menu.Item type="submit" form="sundial-reset">
									<RotateCwIcon />
									Reset the demo
								</Menu.Item>
							}
						/>
						<form id="sundial-reset" method="post" action={actionHref("reset")} hidden />
					</>
				}
				topbar={
					<div
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								flex: "1 1 auto",
								minInlineSize: "0",
							}),
						]}
					>
						<LinkButton
							href={viewHref(currentView ?? "find", context.today)}
							size="sm"
							variant="outline"
							color="neutral"
							data-shortcut="t"
							data-shortcut-label="Go to today"
							data-shortcut-group="Navigation"
						>
							Today
						</LinkButton>
						<div mix={[raw({ display: "flex" })]}>
							<LinkButton
								href={previous}
								data-rmx-prefetch="intent"
								size="sm"
								variant="ghost"
								color="neutral"
								aria-label="Previous"
								title="Previous (K)"
								data-shortcut="k"
								data-shortcut-label="Previous range"
								data-shortcut-group="Navigation"
							>
								<ChevronLeftIcon size={18} aria-hidden="true" />
							</LinkButton>
							<LinkButton
								href={next}
								data-rmx-prefetch="intent"
								size="sm"
								variant="ghost"
								color="neutral"
								aria-label="Next"
								title="Next (J)"
								data-shortcut="j"
								data-shortcut-label="Next range"
								data-shortcut-group="Navigation"
							>
								<ChevronRightIcon size={18} aria-hidden="true" />
							</LinkButton>
						</div>
						<h1
							mix={[
								raw({
									flex: "1 1 auto",
									minInlineSize: "0",
									margin: "0",
									fontSize: "1.0625rem",
									fontWeight: "650",
									letterSpacing: "-0.01em",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
								media("(max-width: 30rem)", raw({ fontSize: "0.9375rem" })),
							]}
						>
							{rangeTitle(context)}
						</h1>
						<nav
							aria-label="Views"
							mix={[
								raw({
									display: "flex",
									padding: "0.125rem",
									borderRadius: "0.5rem",
									backgroundColor: "var(--ui-neutral-bg-tint)",
								}),
								media("(max-width: 48rem)", raw({ display: "none" })),
							]}
						>
							{VIEWS.map((view) => (
								<a
									href={viewHref(view.id, context.anchor)}
									data-rmx-prefetch="intent"
									aria-current={currentView === view.id ? "page" : undefined}
									data-shortcut={view.key}
									data-shortcut-label={`${view.label} view`}
									data-shortcut-group="Navigation"
									mix={[
										raw({
											display: "inline-flex",
											alignItems: "center",
											blockSize: "1.75rem",
											paddingInline: "0.625rem",
											borderRadius: "0.375rem",
											fontSize: "0.8125rem",
											fontWeight: "500",
											color: "var(--ui-neutral-fg-muted)",
											textDecoration: "none",
											"&:hover": { color: "var(--ui-neutral-fg-emphasis)" },
											"&[aria-current='page']": {
												backgroundColor: "var(--ui-bg, Canvas)",
												color: "var(--ui-neutral-fg-emphasis)",
												boxShadow:
													"0 1px 2px rgb(0 0 0 / 0.08), 0 0 0 1px var(--ui-neutral-border)",
											},
											"&:focus-visible": {
												outline: "2px solid var(--ui-brand-ring)",
												outlineOffset: "1px",
											},
										}),
									]}
								>
									{view.label}
								</a>
							))}
						</nav>
						<LinkButton
							href={viewHref("find", context.anchor)}
							size="sm"
							variant="ghost"
							color="neutral"
							data-shortcut="f"
							data-shortcut-label="Find a time"
							data-shortcut-group="Navigation"
							mix={[media("(max-width: 64rem)", raw({ display: "none" }))]}
						>
							<UsersIcon size={16} aria-hidden="true" />
							Find a time
						</LinkButton>
						<LinkButton
							href={newHref}
							size="sm"
							color="brand"
							data-shortcut="c"
							data-shortcut-label="New event"
							data-shortcut-group="Events"
						>
							<PlusIcon size={16} aria-hidden="true" />
							<span mix={[media("(max-width: 40rem)", visuallyHidden())]}>New event</span>
							<Keyboard mix={[media("(max-width: 64rem)", raw({ display: "none" }))]}>C</Keyboard>
						</LinkButton>
						<Button
							type="button"
							variant="ghost"
							color="neutral"
							size="sm"
							commandfor={HELP_ID}
							command="show-modal"
							aria-label={HELP_LABELS.open}
							title={HELP_LABELS.open}
							mix={[media("(max-width: 64rem)", raw({ display: "none" }))]}
						>
							<KeyboardIcon size={16} aria-hidden="true" />
						</Button>
					</div>
				}
			>
				<div
					data-sundial-screen={context.view}
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							flex: "1 1 auto",
							minInlineSize: "0",
							minBlockSize: "0",
							"[data-slot='app-shell-content']:has(&)": { "--ui-app-content-padding": "0px" },
							"[data-main-region]:has(&), [data-main-screen]:has(&)": {
								display: "flex",
								flexDirection: "column",
								flex: "1 1 auto",
								minBlockSize: "0",
							},
						}),
						media("(max-width: 64rem)", raw({ blockSize: "calc(100dvh - 3.5rem)" })),
					]}
				>
					<nav
						aria-label="Views"
						mix={[
							raw({ display: "none" }),
							media(
								"(max-width: 48rem)",
								raw({
									display: "flex",
									gap: "0.25rem",
									padding: "0.375rem 0.5rem",
									overflowX: "auto",
									borderBlockEnd: "1px solid var(--ui-neutral-border)",
									flex: "none",
								}),
							),
						]}
					>
						{VIEWS.map((view) => (
							<a
								href={viewHref(view.id, context.anchor)}
								aria-current={currentView === view.id ? "page" : undefined}
								mix={[
									raw({
										flex: "none",
										display: "inline-flex",
										alignItems: "center",
										blockSize: "2rem",
										paddingInline: "0.75rem",
										borderRadius: "999px",
										fontSize: "0.8125rem",
										fontWeight: "500",
										color: "var(--ui-neutral-fg-muted)",
										textDecoration: "none",
										"&[aria-current='page']": {
											backgroundColor: "var(--ui-neutral-fg-emphasis)",
											color: "var(--ui-bg, Canvas)",
										},
									}),
								]}
							>
								{view.label}
							</a>
						))}
						<a
							href={viewHref("find", context.anchor)}
							aria-current={context.view === "find" ? "page" : undefined}
							mix={[
								raw({
									flex: "none",
									display: "inline-flex",
									alignItems: "center",
									blockSize: "2rem",
									paddingInline: "0.75rem",
									borderRadius: "999px",
									fontSize: "0.8125rem",
									fontWeight: "500",
									color: "var(--ui-neutral-fg-muted)",
									textDecoration: "none",
									"&[aria-current='page']": {
										backgroundColor: "var(--ui-neutral-fg-emphasis)",
										color: "var(--ui-bg, Canvas)",
									},
								}),
							]}
						>
							Find a time
						</a>
					</nav>
					{children}
				</div>
				<KeyboardHelp id={HELP_ID} labels={HELP_LABELS} groups={HELP_GROUPS} />
			</AppShell>
		);
	};
}

/** Sundial's mark: a dial with its gnomon's shadow, in the brand colour. */
export function SundialMark() {
	return () => (
		<svg
			viewBox="0 0 24 24"
			width="24"
			height="24"
			aria-hidden="true"
			mix={[
				raw({
					flex: "none",
					borderRadius: "0.375rem",
					backgroundColor: "var(--ui-brand-bg-solid)",
				}),
			]}
		>
			<circle cx="12" cy="13" r="6.5" fill="none" stroke="white" stroke-width="1.6" opacity="0.9" />
			<path d="M12 13 L12 5" stroke="white" stroke-width="1.8" stroke-linecap="round" />
			<path
				d="M12 13 L17 16"
				stroke="oklch(0.82 0.15 80)"
				stroke-width="1.8"
				stroke-linecap="round"
			/>
		</svg>
	);
}
