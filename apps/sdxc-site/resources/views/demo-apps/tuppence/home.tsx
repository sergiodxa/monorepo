/**
 * Tuppence's home: everything Noor holds in one euro figure, each currency account, this
 * month's spending running against last month's, the bills of the next two weeks, any budget
 * that needs a look, and the latest activity.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import {
	ArrowDownRightIcon,
	ArrowUpRightIcon,
	ChevronRightIcon,
	CreditCardIcon,
	PiggyBankIcon,
	RepeatIcon,
	SendIcon,
	TriangleAlertIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Link } from "@sdxc/ui";
import { Chart } from "@sdxc/ui/app/chart";
import { Ledger } from "@sdxc/ui/finance/ledger";
import { DayStrip } from "@sdxc/ui/schedule/day-strip";

import type { Wallet } from "./state";

import {
	HOLDER,
	HOME,
	LOCALE,
	POTS,
	TODAY,
	addDays,
	daysInMonth,
	findAccount,
	findCategory,
	findMerchant,
	href,
	monthName,
	previousMonth,
	toHome,
} from "./data";
import { budgetStatuses, monthToDate, spendingByCategory, upcoming } from "./figures";
import { EntryRow } from "./ledger-parts";
import { CategoryTile, Money, Panel, SERIF, Screen, dayTitle } from "./parts";
import { balances, entries, potBalance } from "./state";

/** The chart's coordinate space. */
const CHART = { width: 640, height: 200 } as const;

/** One quick action under the balance. */
function QuickAction(handle: Handle<{ href: string; label: string; icon: JSX.Element }>) {
	return () => (
		<a
			href={handle.props.href}
			data-rmx-prefetch="intent"
			mix={raw({
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: "0.375rem",
				minInlineSize: "4.25rem",
				color: "inherit",
				textDecoration: "none",
				fontSize: "0.8125rem",
				fontWeight: "500",
				"& > span": {
					display: "grid",
					placeItems: "center",
					inlineSize: "2.875rem",
					blockSize: "2.875rem",
					borderRadius: "999px",
					backgroundColor: "var(--tuppence-card)",
					boxShadow: "0 0 0 1px var(--tuppence-hairline)",
					color: "var(--ui-brand-fg)",
					transition: "background-color 120ms ease",
				},
				"&:hover > span": {
					backgroundColor: "var(--ui-brand-bg-tint-hover, var(--tuppence-card))",
				},
				"&:focus-visible": { outline: "none" },
				"&:focus-visible > span": {
					outline: "2px solid var(--ui-brand-bg-solid)",
					outlineOffset: "2px",
				},
			})}
		>
			<span aria-hidden="true">{handle.props.icon}</span>
			{handle.props.label}
		</a>
	);
}

/** The greeting, the total in euros across every account, and the quick actions. */
function BalanceHero(handle: Handle<{ wallet: Wallet }>) {
	return () => {
		let held = balances(handle.props.wallet);
		let total = held.reduce((sum, account) => sum + toHome(account.now, account.currency), 0);
		let saved = POTS.reduce((sum, pot) => sum + potBalance(handle.props.wallet, pot.id), 0);
		return (
			<section
				aria-labelledby="tuppence-total"
				mix={raw({
					display: "flex",
					flexWrap: "wrap",
					alignItems: "flex-end",
					justifyContent: "space-between",
					gap: "1.25rem 2rem",
					paddingBlock: "0.5rem 0.25rem",
				})}
			>
				<div mix={raw({ display: "flex", flexDirection: "column", gap: "0.25rem" })}>
					<p mix={raw({ margin: "0", color: "var(--ui-neutral-fg-muted)", fontSize: "0.9375rem" })}>
						Good afternoon, {HOLDER.first}
					</p>
					<h1
						id="tuppence-total"
						mix={raw({ margin: "0", display: "flex", flexDirection: "column" })}
					>
						<span
							mix={raw({
								fontSize: "0.8125rem",
								fontWeight: "500",
								letterSpacing: "0.04em",
								textTransform: "uppercase",
								color: "var(--ui-neutral-fg-muted)",
							})}
						>
							Total balance
						</span>
						<span
							data-slot="tuppence-total"
							mix={raw({
								fontFamily: SERIF,
								fontSize: "clamp(2.5rem, 1.9rem + 2.6vw, 3.5rem)",
								fontWeight: "600",
								letterSpacing: "-0.02em",
								lineHeight: "1.05",
							})}
						>
							<Money value={total} currency={HOME} smallMinor />
						</span>
					</h1>
					<p mix={raw({ margin: "0", color: "var(--ui-neutral-fg-muted)", fontSize: "0.8125rem" })}>
						Across {held.length} accounts at today's rates, plus{" "}
						<Link href={href("pots")}>
							<Money value={saved} currency={HOME} /> in pots
						</Link>
					</p>
				</div>
				<nav aria-label="Quick actions" mix={raw({ display: "flex", gap: "0.5rem" })}>
					<QuickAction href={href("transfer")} label="Send" icon={<SendIcon size={20} />} />
					<QuickAction href={href("pots")} label="Pots" icon={<PiggyBankIcon size={20} />} />
					<QuickAction href={href("cards")} label="Cards" icon={<CreditCardIcon size={20} />} />
					<QuickAction href={href("recurring")} label="Bills" icon={<RepeatIcon size={20} />} />
				</nav>
			</section>
		);
	};
}

/** Each currency account as a card with its balance and its worth in euros; a row that scrolls on a phone. */
function AccountCards(handle: Handle<{ wallet: Wallet }>) {
	return () => (
		<ul
			aria-label="Accounts"
			mix={raw({
				listStyle: "none",
				margin: "0",
				padding: "0.25rem",
				display: "grid",
				gridAutoFlow: "column",
				gridAutoColumns: "minmax(11rem, 1fr)",
				gap: "0.75rem",
				overflowX: "auto",
				scrollSnapType: "x mandatory",
				scrollPaddingInline: "0.25rem",
				marginInline: "-0.25rem",
				scrollbarWidth: "none",
			})}
		>
			{balances(handle.props.wallet).map((account) => (
				<li mix={raw({ scrollSnapAlign: "start", position: "relative" })}>
					<a
						href={href(`accounts/${account.id}`)}
						data-rmx-prefetch="intent"
						mix={raw({
							display: "flex",
							flexDirection: "column",
							gap: "0.75rem",
							blockSize: "100%",
							padding: "1rem",
							borderRadius: "1.125rem",
							backgroundColor: "var(--tuppence-card)",
							boxShadow: "0 0 0 1px var(--tuppence-hairline)",
							color: "inherit",
							textDecoration: "none",
							"&:hover": {
								boxShadow: "0 0 0 1px var(--ui-brand-border, var(--tuppence-hairline))",
							},
							"&:focus-visible": {
								outline: "2px solid var(--ui-brand-bg-solid)",
								outlineOffset: "2px",
							},
						})}
					>
						<span mix={raw({ display: "flex", alignItems: "center", gap: "0.5rem" })}>
							<span
								aria-hidden="true"
								mix={raw({
									display: "grid",
									placeItems: "center",
									inlineSize: "1.75rem",
									blockSize: "1.75rem",
									borderRadius: "999px",
									fontFamily: SERIF,
									fontWeight: "700",
									backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 14%, transparent)",
									color: "var(--ui-brand-fg)",
								})}
							>
								{account.symbol}
							</span>
							<span mix={raw({ display: "flex", flexDirection: "column", lineHeight: "1.2" })}>
								<span mix={raw({ fontWeight: "600", fontSize: "0.875rem" })}>{account.name}</span>
								<span mix={raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })}>
									{account.currency} · {account.masked}
								</span>
							</span>
						</span>
						<span mix={raw({ display: "flex", flexDirection: "column" })}>
							<span
								mix={raw({
									fontFamily: SERIF,
									fontSize: "1.5rem",
									fontWeight: "600",
									letterSpacing: "-0.01em",
								})}
							>
								<Money value={account.now} currency={account.currency} smallMinor />
							</span>
							<span
								mix={raw({
									fontSize: "0.75rem",
									color: "var(--ui-neutral-fg-muted)",
									minBlockSize: "1lh",
								})}
							>
								{account.currency === HOME ? (
									account.detail
								) : (
									<>
										≈ <Money value={toHome(account.now, account.currency)} currency={HOME} />
									</>
								)}
							</span>
						</span>
					</a>
				</li>
			))}
		</ul>
	);
}

/** The x-axis day labels under the spending chart. */
function AxisRow(handle: Handle<{ days: number }>) {
	return () => {
		let month = TODAY.slice(0, 7);
		let label = (day: number) => `${day} ${monthName(month, "short")}`;
		return (
			<div
				aria-hidden="true"
				mix={raw({
					display: "flex",
					justifyContent: "space-between",
					fontSize: "0.75rem",
					color: "var(--ui-neutral-fg-muted)",
					fontVariantNumeric: "tabular-nums",
				})}
			>
				<span>{label(1)}</span>
				<span>{label(15)}</span>
				<span>{label(handle.props.days)}</span>
			</div>
		);
	};
}

/** This month's spending so far, against the same days of last month, with its running curve. */
function SpendingThisMonth(handle: Handle<{ wallet: Wallet }>) {
	return () => {
		let { wallet } = handle.props;
		let figures = monthToDate(wallet);
		let days = daysInMonth(figures.month);
		let last = previousMonth(figures.month);
		let difference = figures.total - figures.before;
		let top = spendingByCategory(wallet, figures.month).slice(0, 3);
		let peak = Math.max(figures.beforeWhole, figures.total) * 1.08;
		let lastName = monthName(last);
		let thisName = monthName(figures.month);
		let less = difference <= 0;
		return (
			<Panel
				title="Spending this month"
				action={<Link href={href("spending")}>See breakdown</Link>}
			>
				<div
					mix={raw({
						display: "flex",
						flexWrap: "wrap",
						alignItems: "baseline",
						gap: "0.25rem 0.75rem",
					})}
				>
					<span
						mix={raw({
							fontFamily: SERIF,
							fontSize: "2rem",
							fontWeight: "600",
							letterSpacing: "-0.015em",
						})}
					>
						<Money value={figures.total} currency={HOME} />
					</span>
					<span
						data-slot="tuppence-delta"
						data-tone={less ? "good" : "bad"}
						mix={raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.25rem",
							fontSize: "0.8125rem",
							fontWeight: "600",
							paddingInline: "0.5rem",
							paddingBlock: "0.125rem",
							borderRadius: "999px",
							color: less ? "var(--ui-success-fg)" : "var(--ui-warning-fg, var(--ui-danger-fg))",
							backgroundColor: less
								? "color-mix(in oklch, var(--ui-success-fg) 12%, transparent)"
								: "color-mix(in oklch, var(--ui-warning-fg, var(--ui-danger-fg)) 12%, transparent)",
						})}
					>
						{less ? (
							<ArrowDownRightIcon size={14} aria-hidden="true" />
						) : (
							<ArrowUpRightIcon size={14} aria-hidden="true" />
						)}
						<Money value={Math.abs(difference)} currency={HOME} /> {less ? "less" : "more"}
					</span>
				</div>
				<p mix={raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })}>
					{less ? "Less" : "More"} than by {figures.day} {lastName}. All of {lastName} came to{" "}
					<Money value={figures.beforeWhole} currency={HOME} />.
				</p>
				<div
					mix={raw({
						display: "flex",
						flexDirection: "column",
						gap: "0.375rem",
						"--ui-chart-1": "var(--ui-brand-bg-solid)",
					})}
				>
					<Chart
						width={CHART.width}
						height={CHART.height}
						xDomain={[1, days]}
						yDomain={[0, peak]}
						aria-label={`Running spending in ${thisName} against ${lastName}`}
					>
						<Chart.Line
							comparison
							points={figures.lastCurve.slice(0, days).map((y, index) => ({
								x: index + 1,
								y,
								label: `${lastName} ${index + 1}: ${(y / 100).toFixed(2)} euros`,
							}))}
						/>
						<Chart.Area
							color={1}
							points={figures.thisCurve.map((y, index) => ({
								x: index + 1,
								y,
								label: `${thisName} ${index + 1}: ${(y / 100).toFixed(2)} euros`,
							}))}
						/>
					</Chart>
					<AxisRow days={days} />
					<div
						mix={raw({
							display: "flex",
							gap: "1rem",
							fontSize: "0.75rem",
							color: "var(--ui-neutral-fg-muted)",
						})}
					>
						<span mix={raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })}>
							<span
								mix={raw({
									inlineSize: "0.75rem",
									blockSize: "0.1875rem",
									borderRadius: "2px",
									backgroundColor: "var(--ui-chart-1)",
								})}
							/>
							{thisName}
						</span>
						<span mix={raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })}>
							<span
								mix={raw({
									inlineSize: "0.75rem",
									blockSize: "0",
									borderBlockStart: "2px dashed var(--ui-neutral-fg-muted)",
								})}
							/>
							{lastName}
						</span>
					</div>
				</div>
				<ul
					mix={raw({
						listStyle: "none",
						margin: "0",
						padding: "0",
						display: "flex",
						flexDirection: "column",
						gap: "0.5rem",
					})}
				>
					{top.map((row) => (
						<li mix={raw({ display: "flex", alignItems: "center", gap: "0.75rem" })}>
							<CategoryTile category={row.category} size={2} />
							<span mix={raw({ flex: "1", fontSize: "0.9375rem" })}>
								{findCategory(row.category)?.name}
							</span>
							<span mix={raw({ fontWeight: "500" })}>
								<Money value={row.total} currency={HOME} />
							</span>
						</li>
					))}
				</ul>
			</Panel>
		);
	};
}

/** The next fourteen days with each bill's amount under its day, then the next few bills by name. */
function ComingUp() {
	return () => {
		let due = upcoming(14);
		let days = Array.from({ length: 15 }, (_, offset) => addDays(TODAY, offset));
		let outgoing = due.filter((entry) => entry.amount < 0 && entry.kind !== "saving");
		return (
			<Panel title="Coming up" action={<Link href={href("recurring")}>All bills</Link>}>
				<div mix={raw({ "--ui-day-strip-cell": "4.25rem", marginInline: "-0.25rem" })}>
					<DayStrip
						label="The next two weeks"
						locale={LOCALE}
						today={TODAY}
						days={days.map((date) => {
							let onDay = due.filter((entry) => entry.date === date);
							let total = onDay.reduce(
								(sum, entry) =>
									sum + toHome(entry.amount, findAccount(entry.account)?.currency ?? HOME),
								0,
							);
							return {
								date,
								href: onDay.length > 0 ? href(`recurring?on=${date}`) : undefined,
								label:
									onDay.length > 0
										? onDay.map((entry) => findMerchant(entry.merchant)?.name).join(", ")
										: undefined,
								note:
									onDay.length > 0 ? (
										<span
											data-tone={total > 0 ? "in" : "out"}
											mix={raw({
												fontSize: "0.6875rem",
												fontWeight: "600",
												color: total > 0 ? "var(--ui-success-fg)" : "var(--ui-fg)",
											})}
										>
											<Money
												value={total}
												currency={HOME}
												sign="ledger"
												compact={Math.abs(total) >= 100000}
											/>
										</span>
									) : undefined,
							};
						})}
					/>
				</div>
				<ul
					mix={raw({
						listStyle: "none",
						margin: "0",
						padding: "0",
						display: "flex",
						flexDirection: "column",
						gap: "0.625rem",
					})}
				>
					{outgoing.slice(0, 4).map((entry) => {
						let merchant = findMerchant(entry.merchant);
						let currency = findAccount(entry.account)?.currency ?? HOME;
						return (
							<li
								mix={raw({
									display: "flex",
									alignItems: "center",
									gap: "0.75rem",
									fontSize: "0.9375rem",
								})}
							>
								<span
									mix={raw({
										flex: "1",
										minInlineSize: "0",
										display: "flex",
										flexDirection: "column",
									})}
								>
									<span mix={raw({ fontWeight: "500" })}>{merchant?.name}</span>
									<span mix={raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })}>
										{dayTitle(entry.date, TODAY)}
										{entry.varies ? " · usually" : ""}
									</span>
								</span>
								<Money value={-entry.amount} currency={currency} />
							</li>
						);
					})}
				</ul>
			</Panel>
		);
	};
}

/** The budgets past or near their limit, one line each, linking to the budgets screen. */
function BudgetAlerts(handle: Handle<{ wallet: Wallet }>) {
	return () => {
		let alerts = budgetStatuses(handle.props.wallet).filter((status) => status.state !== "fine");
		if (alerts.length === 0) return null;
		return (
			<a
				href={href("budgets")}
				data-rmx-prefetch="intent"
				data-slot="tuppence-budget-alert"
				mix={raw({
					display: "flex",
					alignItems: "center",
					gap: "0.75rem",
					padding: "0.875rem 1rem",
					borderRadius: "1.125rem",
					color: "inherit",
					textDecoration: "none",
					backgroundColor:
						"color-mix(in oklch, var(--ui-warning-bg-solid, orange) 12%, var(--tuppence-card))",
					boxShadow:
						"0 0 0 1px color-mix(in oklch, var(--ui-warning-bg-solid, orange) 30%, transparent)",
					"&:focus-visible": {
						outline: "2px solid var(--ui-brand-bg-solid)",
						outlineOffset: "2px",
					},
				})}
			>
				<TriangleAlertIcon
					size={20}
					aria-hidden="true"
					mix={raw({ flex: "none", color: "var(--ui-warning-fg)" })}
				/>
				<span
					mix={raw({ flex: "1", display: "flex", flexDirection: "column", fontSize: "0.875rem" })}
				>
					<strong mix={raw({ fontWeight: "600" })}>
						{alerts.length === 1
							? "One budget needs a look"
							: `${alerts.length} budgets need a look`}
					</strong>
					<span mix={raw({ color: "var(--ui-neutral-fg-muted)" })}>
						{alerts
							.map((status) => {
								let name = findCategory(status.category)?.name ?? status.category;
								let percent = Math.round((status.spent / status.budget) * 100);
								return status.state === "over"
									? `${name} is over (${percent}%)`
									: `${name} is at ${percent}%`;
							})
							.join(" · ")}
					</span>
				</span>
				<ChevronRightIcon size={18} aria-hidden="true" />
			</a>
		);
	};
}

/** The latest movements, grouped by day. */
function RecentActivity(handle: Handle<{ wallet: Wallet }>) {
	return () => {
		let latest = entries(handle.props.wallet).slice(0, 7);
		let days = [...new Set(latest.map((entry) => entry.date))];
		return (
			<Panel
				title="Recent activity"
				action={<Link href={href("transactions")}>See all</Link>}
				flush
			>
				<Ledger>
					{days.map((day) => (
						<Ledger.Day title={dayTitle(day, TODAY)}>
							{latest
								.filter((entry) => entry.date === day)
								.map((entry) => (
									<EntryRow entry={entry} link={href(`transactions?tx=${entry.id}`)} />
								))}
						</Ledger.Day>
					))}
				</Ledger>
			</Panel>
		);
	};
}

namespace Home {
	export interface Props {
		wallet: Wallet;
	}
}

/** The home screen. On a desktop the month and the bills sit side by side; on a phone they stack. */
export default function Home(handle: Handle<Home.Props>) {
	return () => {
		let { wallet } = handle.props;
		return (
			<Screen>
				<BalanceHero wallet={wallet} />
				<AccountCards wallet={wallet} />
				<BudgetAlerts wallet={wallet} />
				<div
					mix={raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))",
						gap: "1.25rem",
						alignItems: "start",
					})}
				>
					<SpendingThisMonth wallet={wallet} />
					<div
						mix={raw({
							display: "flex",
							flexDirection: "column",
							gap: "1.25rem",
							minInlineSize: "0",
						})}
					>
						<ComingUp />
						<RecentActivity wallet={wallet} />
					</div>
				</div>
			</Screen>
		);
	};
}
