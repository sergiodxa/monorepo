/**
 * Bills, subscriptions, income and saving that repeat every month: what they cost a month, a
 * strip of the next two weeks with each day's total, and every one with its next date. A day
 * picked on the strip marks the payments due on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { DayStrip } from "@sdxc/ui/app/day-strip";

import type { Recurring } from "./data";
import type { Upcoming } from "./figures";
import type { Wallet } from "./state";

import {
	HOME,
	LOCALE,
	RECURRING,
	TODAY,
	addDays,
	findAccount,
	findMerchant,
	href,
	toHome,
} from "./data";
import { monthlyTotal, upcoming } from "./figures";
import {
	MerchantMark,
	Money,
	Panel,
	SERIF,
	Screen,
	ScreenTitle,
	dayTitle,
	longDate,
} from "./parts";

/** The groups the list is split into, in order. */
const GROUPS: ReadonlyArray<{ kind: Recurring["kind"]; title: string }> = [
	{ kind: "bill", title: "Bills" },
	{ kind: "subscription", title: "Subscriptions" },
	{ kind: "saving", title: "Saving" },
	{ kind: "income", title: "Coming in" },
];

/** "1st", "2nd", "12th" for a day of the month. */
function ordinal(day: number): string {
	let rule = new Intl.PluralRules("en", { type: "ordinal" }).select(day);
	let suffix = { one: "st", two: "nd", few: "rd" }[rule as "one" | "two" | "few"] ?? "th";
	return `${day}${suffix}`;
}

/** The next day after today a repeat falls due. */
function nextDate(entry: Recurring): string {
	for (let offset = 1; offset <= 62; offset++) {
		let day = addDays(TODAY, offset);
		if (Number(day.slice(8)) === entry.day) return day;
	}
	return TODAY;
}

/** The sentence under the strip: a prompt, or what is due on the picked day. */
function daySummary(picked: string | null, due: Upcoming[]): string {
	if (picked === null) return "Pick a day to see what's due on it.";
	if (due.length === 0) return `Nothing is due on ${longDate(picked, false)}.`;
	return `Due on ${longDate(picked, false)}: ${due.map((entry) => findMerchant(entry.merchant)?.name).join(", ")}.`;
}

/** One repeating payment: who, how often, when next and how much. */
function RecurringRow(handle: Handle<{ entry: Recurring; marked: boolean }>) {
	return () => {
		let { entry, marked } = handle.props;
		let merchant = findMerchant(entry.merchant);
		let currency = findAccount(entry.account)?.currency ?? HOME;
		let next = nextDate(entry);
		return (
			<li
				data-marked={marked ? "" : undefined}
				aria-current={marked ? "true" : undefined}
				mix={raw({
					display: "flex",
					alignItems: "center",
					gap: "0.75rem",
					padding: "0.625rem 0.75rem",
					borderRadius: "0.875rem",
					"&[data-marked]": {
						backgroundColor: "color-mix(in oklch, var(--ui-brand-solid) 10%, transparent)",
					},
				})}
			>
				<MerchantMark merchant={merchant} />
				<span
					mix={raw({ flex: "1", minInlineSize: "0", display: "flex", flexDirection: "column" })}
				>
					<span mix={raw({ fontWeight: "500" })}>{merchant?.name}</span>
					<span mix={raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })}>
						{merchant?.place} · on the {ordinal(entry.day)}
						{entry.varies ? ", amount varies" : ""}
					</span>
				</span>
				<span
					mix={raw({
						display: "flex",
						flexDirection: "column",
						alignItems: "flex-end",
						textAlign: "end",
					})}
				>
					<span mix={raw({ fontWeight: "500" })}>
						<Money value={entry.amount} currency={currency} sign="ledger" />
					</span>
					<span mix={raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })}>
						{dayTitle(next, TODAY)}
					</span>
				</span>
			</li>
		);
	};
}

namespace RecurringScreen {
	export interface Props {
		wallet: Wallet;
		url: URL;
	}
}

/** The bills and subscriptions screen. */
export function RecurringScreen(handle: Handle<RecurringScreen.Props>) {
	return () => {
		let { url } = handle.props;
		let on = url.searchParams.get("on");
		let due = upcoming(14);
		let days = Array.from({ length: 15 }, (_, offset) => addDays(TODAY, offset));
		let dueOn = (date: string): Upcoming[] => due.filter((entry) => entry.date === date);
		let picked = on !== null && days.includes(on) ? on : null;
		let outgoing = monthlyTotal(["bill", "subscription"]);
		let incoming = monthlyTotal(["income"]);
		let fortnight = due
			.filter((entry) => entry.amount < 0 && entry.kind !== "saving")
			.reduce(
				(sum, entry) => sum - toHome(entry.amount, findAccount(entry.account)?.currency ?? HOME),
				0,
			);
		return (
			<Screen width="52rem">
				<ScreenTitle
					title="Bills & subscriptions"
					detail="Everything that repeats each month, and what's due in the next two weeks."
				/>
				<div
					mix={raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))",
						gap: "1rem",
					})}
				>
					{[
						{ label: "Bills and subscriptions a month", value: outgoing },
						{ label: "Due in the next 14 days", value: fortnight },
						{ label: "Regular income a month", value: incoming },
					].map((stat) => (
						<div
							mix={raw({
								padding: "1rem 1.125rem",
								borderRadius: "1.125rem",
								backgroundColor: "var(--tuppence-card)",
								boxShadow: "0 0 0 1px var(--tuppence-hairline)",
							})}
						>
							<p
								mix={raw({
									margin: "0",
									fontSize: "0.8125rem",
									color: "var(--ui-neutral-fg-muted)",
								})}
							>
								{stat.label}
							</p>
							<p
								mix={raw({
									margin: "0",
									fontFamily: SERIF,
									fontSize: "1.625rem",
									fontWeight: "600",
								})}
							>
								<Money value={stat.value} currency={HOME} />
							</p>
						</div>
					))}
				</div>
				<Panel title="Next two weeks">
					<div mix={raw({ "--ui-day-strip-cell": "4.25rem" })}>
						<DayStrip
							label="The next two weeks"
							locale={LOCALE}
							today={TODAY}
							days={days.map((date) => {
								let onDay = dueOn(date);
								let total = onDay.reduce(
									(sum, entry) =>
										sum + toHome(entry.amount, findAccount(entry.account)?.currency ?? HOME),
									0,
								);
								return {
									date,
									href: href(date === picked ? "recurring" : `recurring?on=${date}`),
									current: date === picked,
									label:
										onDay.length === 0
											? "Nothing due"
											: onDay.map((entry) => findMerchant(entry.merchant)?.name).join(", "),
									note:
										onDay.length === 0 ? undefined : (
											<span
												mix={raw({
													fontSize: "0.6875rem",
													fontWeight: "600",
													color: total > 0 ? "var(--ui-success-fg)" : "inherit",
												})}
											>
												<Money
													value={total}
													currency={HOME}
													sign="ledger"
													compact={Math.abs(total) >= 100000}
												/>
											</span>
										),
								};
							})}
						/>
					</div>
					<p
						data-slot="tuppence-day-summary"
						mix={raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })}
					>
						{daySummary(picked, picked === null ? [] : dueOn(picked))}
					</p>
				</Panel>
				{GROUPS.map((group) => {
					let rows = RECURRING.filter((entry) => entry.kind === group.kind);
					return (
						<Panel title={group.title} flush>
							<ul
								mix={raw({
									listStyle: "none",
									margin: "0",
									padding: "0 0.25rem",
									display: "flex",
									flexDirection: "column",
								})}
							>
								{rows.map((entry) => (
									<RecurringRow
										entry={entry}
										marked={picked !== null && nextDate(entry) === picked}
									/>
								))}
							</ul>
						</Panel>
					);
				})}
			</Screen>
		);
	};
}
