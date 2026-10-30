/**
 * Rooftree's screens as live markup in the phone mock: today at home, the shared
 * grocery list, the chore rota, the household calendar and the week's meals. One
 * household (Maya, Jonah, Ari and Leo) runs through all of them so the tour reads as one day.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { FlameIcon, MapPinIcon, PlusIcon, ShoppingCartIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { leading, tabularNums, text, tracking, weight } from "@sdxc/u/typography";

import type { Person } from "~/resources/views/demos/app/phone";

import { Card, Initials, PEOPLE, Phone, Row } from "~/resources/views/demos/app/phone";

namespace ScreenTitle {
	/** Props of a screen's large title. */
	export interface Props {
		/** The small line over the title, such as the date. */
		kicker: string;
		/** The screen's title. */
		title: string;
		/** People shown at the trailing edge, overlapping. */
		people?: readonly Person[];
	}
}

/**
 * The large title an app screen opens with, the household's faces at its trailing edge.
 *
 * @param handle Runtime handle carrying the kicker, title and faces.
 * @returns The render function producing the title row.
 */
function ScreenTitle(handle: Handle<ScreenTitle.Props>) {
	return () => {
		let { kicker, people, title } = handle.props;
		return (
			<div mix={[hstack({ gap: 2, align: "end", justify: "between" })]}>
				<span mix={[vstack({ gap: 0.5, align: "start" })]}>
					<span mix={[fg("neutral.muted"), weight("medium")]}>{kicker}</span>
					<span mix={[text("xl"), weight("bold"), tracking("tight"), leading("tight")]}>
						{title}
					</span>
				</span>
				{people ? (
					<span mix={[hstack({ gap: 0, align: "center" }), raw({ paddingInlineStart: "0.25rem" })]}>
						{people.map((person) => (
							<span key={person} mix={[raw({ marginInlineStart: "-0.3rem" })]}>
								<Initials person={person} size={1.375} />
							</span>
						))}
					</span>
				) : null}
			</div>
		);
	};
}

/**
 * Today at home: tonight's dinner, what is left to buy, and the chores due, the screen
 * the hero leads with because it shows every part of the app at once.
 *
 * @returns The render function producing the screen.
 */
export function TodayScreen() {
	return () => (
		<Phone
			tab="home"
			label="Rooftree's Home screen: tonight's dinner, the grocery list with one item bought, and two chores due today."
		>
			<ScreenTitle
				kicker="Thursday, Nov 14"
				title="Tonight at home"
				people={["maya", "jonah", "ari", "leo"]}
			/>
			<div
				mix={[
					vstack({ gap: 1, align: "start" }),
					raw({
						padding: "0.75rem",
						borderRadius: "0.875rem",
						color: "white",
						backgroundImage:
							"linear-gradient(135deg, var(--ui-color-brand-500), var(--ui-color-brand-700))",
						boxShadow: "0 8px 20px -10px var(--ui-color-brand-600)",
					}),
				]}
			>
				<span
					mix={[
						raw({
							fontSize: "0.625rem",
							opacity: "0.85",
							letterSpacing: "0.06em",
							textTransform: "uppercase",
						}),
						weight("semibold"),
					]}
				>
					Dinner · 7:30
				</span>
				<span mix={[text("base"), weight("semibold"), leading("tight")]}>
					Lemon orzo with greens
				</span>
				<span mix={[hstack({ gap: 1.5, align: "center" }), raw({ opacity: "0.9" })]}>
					<Initials person="jonah" size={1} />
					Jonah is cooking · serves 4
				</span>
			</div>
			<Card title="Groceries" meta="4 left">
				<Row done person="jonah">
					Orzo
				</Row>
				<Row note="3 · unwaxed" person="jonah">
					Lemons
				</Row>
				<Row person="maya">Baby spinach</Row>
				<Row note="Ari asked for the aged one">Parmesan</Row>
			</Card>
			<Card title="Chores due" meta="Today">
				<Row person="leo" note="Bins go out before 8">
					Take out recycling
				</Row>
				<Row person="ari">Water the balcony plants</Row>
			</Card>
		</Phone>
	);
}

/**
 * The grocery list grouped by aisle while one person is at the shop, with the live
 * presence line that tells everyone else the list is being bought right now.
 *
 * @returns The render function producing the screen.
 */
export function ListsScreen() {
	return () => (
		<Phone
			tab="lists"
			staged
			maxWidth="16.5rem"
			label="The shared grocery list grouped by aisle, with Jonah shown live at the corner market checking items off."
		>
			<ScreenTitle kicker="Shared with 4" title="Groceries" />
			<span
				mix={[
					hstack({ gap: 2, align: "center" }),
					raw({
						padding: "0.5rem 0.625rem",
						borderRadius: "0.75rem",
						backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 12%, transparent)",
					}),
				]}
			>
				<Initials person="jonah" size={1.25} />
				<span mix={[vstack({ gap: 0, align: "start" }), raw({ flex: "1" })]}>
					<span mix={[weight("semibold")]}>Jonah is shopping</span>
					<span
						mix={[
							fg("neutral.muted"),
							hstack({ gap: 1, align: "center" }),
							raw({ fontSize: "0.625rem" }),
						]}
					>
						<MapPinIcon size={10} /> Corner Market · 3 min ago
					</span>
				</span>
				<ShoppingCartIcon size={16} />
			</span>
			<Card title="Produce" meta="2 of 4">
				<Row done>Lemons</Row>
				<Row done>Baby spinach</Row>
				<Row note="Ripe for Saturday">Avocados</Row>
				<Row person="ari">Fresh basil</Row>
			</Card>
			<Card title="Dairy & pantry" meta="1 of 3">
				<Row done>Orzo</Row>
				<Row note="Aged, 200 g">Parmesan</Row>
				<Row person="leo">Oat milk</Row>
			</Card>
		</Phone>
	);
}

/** The chore rota the chores screen draws: chore, whose turn, when, and the next in line. */
const CHORES: readonly { chore: string; who: Person; next: Person; when: string }[] = [
	{ chore: "Take out recycling", who: "leo", next: "ari", when: "Today" },
	{ chore: "Clean the bathroom", who: "maya", next: "jonah", when: "Sat" },
	{ chore: "Water the plants", who: "ari", next: "leo", when: "Today" },
	{ chore: "Vacuum the hallway", who: "jonah", next: "maya", when: "Sun" },
];

/**
 * The chore rota: whose turn each chore is, and who it passes to next, with the week's
 * streak so the fairness is visible rather than argued about.
 *
 * @returns The render function producing the screen.
 */
export function ChoresScreen() {
	return () => (
		<Phone
			tab="chores"
			staged
			maxWidth="16.5rem"
			label="The chore rota: four chores, whose turn each is and who it passes to next, above a household streak of nine weeks."
		>
			<ScreenTitle kicker="This week" title="Chores" />
			<span
				mix={[
					hstack({ gap: 2, align: "center" }),
					raw({
						padding: "0.625rem 0.75rem",
						borderRadius: "0.875rem",
						backgroundColor: "var(--ui-surface-raised)",
						boxShadow: "var(--ui-shadow-surface)",
					}),
				]}
			>
				<span mix={[fg("brand")]}>
					<FlameIcon size={18} />
				</span>
				<span mix={[vstack({ gap: 0, align: "start" })]}>
					<span mix={[weight("semibold")]}>9-week streak</span>
					<span mix={[fg("neutral.muted"), raw({ fontSize: "0.625rem" })]}>
						Every chore done on time since September
					</span>
				</span>
			</span>
			<Card title="Rota" meta="Rotates Mondays">
				{CHORES.map((entry) => (
					<span
						key={entry.chore}
						mix={[hstack({ gap: 2, align: "center" }), raw({ paddingBlock: "0.125rem" })]}
					>
						<Initials person={entry.who} size={1.5} />
						<span
							mix={[vstack({ gap: 0, align: "start" }), raw({ flex: "1", minInlineSize: "0" })]}
						>
							<span mix={[weight("medium")]}>{entry.chore}</span>
							<span mix={[fg("neutral.muted"), raw({ fontSize: "0.625rem" })]}>
								Next: {PEOPLE[entry.next].name}
							</span>
						</span>
						<span mix={[fg("neutral.muted"), weight("medium"), tabularNums()]}>{entry.when}</span>
					</span>
				))}
			</Card>
		</Phone>
	);
}

/** The week strip the calendar screen draws: weekday letter, date, and whether it is today. */
const WEEK = [
	["M", 11],
	["T", 12],
	["W", 13],
	["T", 14],
	["F", 15],
	["S", 16],
	["S", 17],
] as const;

/** Today's entries on the calendar screen, in time order. */
const AGENDA: readonly { time: string; title: string; note: string; who: Person }[] = [
	{ time: "8:15", title: "School run", note: "Leo · bring the permission slip", who: "maya" },
	{ time: "12:30", title: "Boiler service", note: "Someone home 12–2", who: "jonah" },
	{ time: "17:00", title: "Swim practice", note: "Leisure centre, lane 4", who: "leo" },
	{ time: "19:30", title: "Dinner at home", note: "Lemon orzo · Jonah cooks", who: "jonah" },
];

/**
 * The household calendar: a week strip over today's agenda, each entry tinted in the
 * colour of the person it belongs to.
 *
 * @returns The render function producing the screen.
 */
export function CalendarScreen() {
	return () => (
		<Phone
			tab="calendar"
			staged
			maxWidth="16.5rem"
			label="The household calendar for Thursday: school run, a boiler service, swim practice and dinner, each in its person's colour."
		>
			<ScreenTitle kicker="November" title="Calendar" />
			<div mix={[hstack({ gap: 1, align: "stretch", justify: "between" })]}>
				{WEEK.map(([day, date]) => {
					let isToday = date === 14;
					return (
						<span
							key={date}
							mix={[
								vstack({ gap: 0.5, align: "center" }),
								tabularNums(),
								raw({
									flex: "1",
									paddingBlock: "0.375rem",
									borderRadius: "0.625rem",
									backgroundColor: isToday ? "var(--ui-brand-bg-solid)" : "transparent",
									color: isToday ? "white" : "inherit",
								}),
							]}
						>
							<span mix={[raw({ fontSize: "0.5625rem", opacity: "0.7" })]}>{day}</span>
							<span mix={[weight("semibold")]}>{date}</span>
						</span>
					);
				})}
			</div>
			<Card title="Thursday" meta="4 events">
				{AGENDA.map((entry) => (
					<span key={entry.time} mix={[hstack({ gap: 2, align: "stretch" })]}>
						<span
							mix={[
								fg("neutral.muted"),
								tabularNums(),
								raw({ inlineSize: "2.25rem", flexShrink: "0", paddingBlockStart: "0.125rem" }),
							]}
						>
							{entry.time}
						</span>
						<span
							mix={[
								vstack({ gap: 0, align: "start" }),
								raw({
									flex: "1",
									minInlineSize: "0",
									padding: "0.375rem 0.5rem",
									borderRadius: "0.5rem",
									borderInlineStart: `3px solid oklch(0.62 0.13 ${PEOPLE[entry.who].hue})`,
									backgroundColor: `oklch(0.62 0.13 ${PEOPLE[entry.who].hue} / 0.1)`,
								}),
							]}
						>
							<span mix={[weight("semibold")]}>{entry.title}</span>
							<span mix={[fg("neutral.muted"), raw({ fontSize: "0.625rem" })]}>{entry.note}</span>
						</span>
					</span>
				))}
			</Card>
		</Phone>
	);
}

/** The week's dinners the meals screen plans, by day. */
const MEALS: readonly { day: string; dish: string; who: Person }[] = [
	{ day: "Thu", dish: "Lemon orzo with greens", who: "jonah" },
	{ day: "Fri", dish: "Homemade pizza night", who: "ari" },
	{ day: "Sat", dish: "Black bean tacos", who: "maya" },
	{ day: "Sun", dish: "Roast squash & farro", who: "leo" },
];

/**
 * The meal plan: a dinner and a cook per night, and the one action that turns the plan's
 * ingredients into grocery rows.
 *
 * @returns The render function producing the screen.
 */
export function MealsScreen() {
	return () => (
		<Phone
			tab="meals"
			staged
			maxWidth="16.5rem"
			label="The week's meal plan, four dinners each with a cook, and a button adding nine ingredients to the grocery list."
		>
			<ScreenTitle kicker="Nov 14 – 17" title="Meals" />
			<Card title="Dinners" meta="4 planned">
				{MEALS.map((meal) => (
					<span
						key={meal.day}
						mix={[hstack({ gap: 2, align: "center" }), raw({ paddingBlock: "0.25rem" })]}
					>
						<span
							mix={[
								raw({
									display: "inline-grid",
									placeItems: "center",
									inlineSize: "2.25rem",
									blockSize: "2.25rem",
									flexShrink: "0",
									borderRadius: "0.625rem",
									backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 12%, transparent)",
									fontSize: "0.625rem",
								}),
								fg("brand"),
								weight("bold"),
							]}
						>
							{meal.day}
						</span>
						<span mix={[raw({ flex: "1", minInlineSize: "0" }), weight("medium"), leading("snug")]}>
							{meal.dish}
						</span>
						<Initials person={meal.who} size={1.125} />
					</span>
				))}
			</Card>
			<span
				mix={[
					hstack({ gap: 1.5, align: "center", justify: "center" }),
					weight("semibold"),
					raw({
						padding: "0.625rem",
						borderRadius: "9999px",
						color: "white",
						backgroundColor: "var(--ui-brand-bg-solid)",
					}),
				]}
			>
				<PlusIcon size={14} strokeWidth={2.5} /> Add 9 ingredients to Groceries
			</span>
			<span mix={[fg("neutral.muted"), raw({ fontSize: "0.625rem", textAlign: "center" })]}>
				Skips the 3 you already have in the pantry
			</span>
		</Phone>
	);
}
