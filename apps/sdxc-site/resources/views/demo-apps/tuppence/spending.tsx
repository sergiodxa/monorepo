/**
 * Where a month's money went: a ring of categories around the month's total, spending by
 * day, and each category against the month before, with the month chosen in the address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { formatAmount } from "@sdxc/money";
import { raw } from "@sdxc/u/general";
import { Chart } from "@sdxc/ui/app/chart";

import type { Wallet } from "./state";

import {
	HOME,
	LOCALE,
	MONTHS,
	TODAY,
	daysInMonth,
	findCategory,
	href,
	monthName,
	previousMonth,
} from "./data";
import { cumulative, spendingByCategory } from "./figures";
import { CategoryTile, Money, Panel, SERIF, Screen, ScreenTitle } from "./parts";

/** The month an address names, the current one when it names none Tuppence has. */
export function readMonth(url: URL): string {
	let wanted = url.searchParams.get("month") ?? "";
	return (MONTHS as readonly string[]).includes(wanted) ? wanted : TODAY.slice(0, 7);
}

/** The month switcher: one link per month, the shown one current. */
function MonthTabs(handle: Handle<{ month: string }>) {
	return () => (
		<nav aria-label="Month">
			<ul
				mix={raw({
					listStyle: "none",
					margin: "0",
					padding: "0.25rem",
					display: "inline-flex",
					gap: "0.25rem",
					borderRadius: "999px",
					backgroundColor: "var(--tuppence-card)",
					boxShadow: "0 0 0 1px var(--tuppence-hairline)",
				})}
			>
				{MONTHS.map((month) => (
					<li>
						<a
							href={href(month === TODAY.slice(0, 7) ? "spending" : `spending?month=${month}`)}
							aria-current={month === handle.props.month ? "page" : undefined}
							data-rmx-prefetch="intent"
							mix={raw({
								display: "block",
								paddingBlock: "0.375rem",
								paddingInline: "0.875rem",
								borderRadius: "999px",
								fontSize: "0.875rem",
								fontWeight: "500",
								color: "inherit",
								textDecoration: "none",
								"&[aria-current='page']": {
									backgroundColor: "var(--ui-brand-bg-solid)",
									color: "var(--ui-brand-fg-on-solid, white)",
								},
								"&:not([aria-current]):hover": {
									backgroundColor: "var(--ui-neutral-bg-tint-hover)",
								},
							})}
						>
							{monthName(month, "short")}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}

namespace SpendingScreen {
	export interface Props {
		wallet: Wallet;
		url: URL;
	}
}

/** The spending screen. */
export function SpendingScreen(handle: Handle<SpendingScreen.Props>) {
	return () => {
		let { wallet, url } = handle.props;
		let month = readMonth(url);
		let last = previousMonth(month);
		let current = month === TODAY.slice(0, 7);
		let through = current ? Number(TODAY.slice(8)) : daysInMonth(month);
		let rows = spendingByCategory(wallet, month);
		let before = new Map(
			spendingByCategory(wallet, last, current ? through : 31).map((row) => [
				row.category,
				row.total,
			]),
		);
		let total = rows.reduce((sum, row) => sum + row.total, 0);
		let running = cumulative(wallet, month, through);
		let daily = running.map((value, index) => value - (running[index - 1] ?? 0));
		let peak = Math.max(...daily, 1);
		let name = monthName(month);
		let widest = Math.max(
			...rows.map((row) => Math.max(row.total, before.get(row.category) ?? 0)),
			1,
		);
		return (
			<Screen width="64rem">
				<ScreenTitle
					title="Spending"
					detail={
						current
							? `${name} so far, against the same days of ${monthName(last)}.`
							: `All of ${name}, against ${monthName(last)}.`
					}
					actions={<MonthTabs month={month} />}
				/>
				<div
					mix={raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))",
						gap: "1.25rem",
						alignItems: "start",
					})}
				>
					<Panel title={`By category in ${name}`}>
						<div
							mix={raw({
								position: "relative",
								maxInlineSize: "17rem",
								marginInline: "auto",
								inlineSize: "100%",
							})}
						>
							<Chart.Pie
								width={240}
								height={240}
								innerRadius={84}
								aria-label={`Spending by category in ${name}`}
								data={rows.map((row) => ({
									value: row.total,
									label: `${findCategory(row.category)?.name}: ${formatAmount(row.total, HOME, { locale: LOCALE })}`,
									color: findCategory(row.category)?.color ?? undefined,
								}))}
							/>
							<div
								aria-hidden="true"
								mix={raw({
									position: "absolute",
									inset: "0",
									display: "grid",
									placeContent: "center",
									textAlign: "center",
									pointerEvents: "none",
								})}
							>
								<span mix={raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })}>
									Spent
								</span>
								<span mix={raw({ fontFamily: SERIF, fontSize: "1.625rem", fontWeight: "600" })}>
									<Money value={total} currency={HOME} />
								</span>
							</div>
						</div>
					</Panel>
					<Panel title="By day">
						<Chart.Bar
							width={480}
							height={220}
							domain={[0, peak * 1.1]}
							series={["spent"]}
							categoryGap={0.3}
							aria-label={`Spending by day in ${name}`}
							data={daily.map((value, index) => ({
								category: String(index + 1),
								values: {
									spent: {
										value,
										label: `${index + 1} ${monthName(month, "short")}: ${formatAmount(value, HOME, { locale: LOCALE })}`,
									},
								},
							}))}
						/>
						<div
							aria-hidden="true"
							mix={raw({
								display: "flex",
								justifyContent: "space-between",
								fontSize: "0.75rem",
								color: "var(--ui-neutral-fg-muted)",
							})}
						>
							<span>1 {monthName(month, "short")}</span>
							<span>
								{through} {monthName(month, "short")}
							</span>
						</div>
						<p
							mix={raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })}
						>
							The tall days are rent and the bills on the 1st, then the weekly shop.
						</p>
					</Panel>
				</div>
				<Panel title={`Each category against ${monthName(last)}`}>
					<ul
						mix={raw({
							listStyle: "none",
							margin: "0",
							padding: "0",
							display: "flex",
							flexDirection: "column",
							gap: "1rem",
						})}
					>
						{rows.map((row) => {
							let category = findCategory(row.category);
							let previous = before.get(row.category) ?? 0;
							let change = row.total - previous;
							return (
								<li
									data-category={row.category}
									mix={raw({
										display: "grid",
										gridTemplateColumns: "auto 1fr auto",
										gap: "0.25rem 0.75rem",
										alignItems: "center",
									})}
								>
									<span mix={raw({ gridRow: "span 2" })}>
										<CategoryTile category={row.category} />
									</span>
									<a
										href={href(`transactions?category=${row.category}`)}
										data-rmx-prefetch="intent"
										mix={raw({
											color: "inherit",
											fontWeight: "500",
											textDecoration: "none",
											"&:hover": { textDecoration: "underline" },
										})}
									>
										{category?.name}
									</a>
									<span mix={raw({ fontWeight: "600", textAlign: "end" })}>
										<Money value={row.total} currency={HOME} />
									</span>
									<span
										mix={raw({ display: "flex", flexDirection: "column", gap: "0.1875rem" })}
										aria-hidden="true"
									>
										<span
											mix={raw({
												blockSize: "0.4375rem",
												borderRadius: "999px",
												inlineSize: `${(row.total / widest) * 100}%`,
												backgroundColor: `var(--ui-chart-${category?.color ?? 1})`,
											})}
										/>
										<span
											mix={raw({
												blockSize: "0.25rem",
												borderRadius: "999px",
												inlineSize: `${(previous / widest) * 100}%`,
												backgroundColor: "var(--ui-neutral-border, var(--tuppence-hairline))",
											})}
										/>
									</span>
									<span
										mix={raw({
											fontSize: "0.75rem",
											textAlign: "end",
											color: change > 0 ? "var(--ui-warning-fg)" : "var(--ui-success-fg)",
										})}
									>
										{change === 0 ? (
											"Same"
										) : (
											<>
												<Money value={Math.abs(change)} currency={HOME} />{" "}
												{change > 0 ? "more" : "less"}
											</>
										)}
									</span>
								</li>
							);
						})}
					</ul>
				</Panel>
			</Screen>
		);
	};
}
