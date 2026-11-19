/**
 * Monthly budgets: each category's spending against its limit, with a mark for where the
 * month's pace says it should be today, an alert for any past or near its limit, and an
 * inline form to change a limit or set one for a category without.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { TriangleAlertIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Alert, Button, TextField } from "@sdxc/ui";

import type { BudgetStatus } from "./figures";
import type { Wallet } from "./state";

import { HOME, TODAY, actionHref, daysInMonth, findCategory, monthName } from "./data";
import { budgetStatuses, spendingByCategory } from "./figures";
import { CategoryTile, Money, Panel, Screen, ScreenTitle } from "./parts";
import { BUDGETABLE, budgetFor } from "./state";

/** Days left in the month after today, today included. */
function daysLeft(): number {
	return daysInMonth(TODAY.slice(0, 7)) - Number(TODAY.slice(8)) + 1;
}

namespace EditBudget {
	export interface Props {
		category: string;
		/** The limit now, in cents, to start the field from. */
		value?: number;
		/** Opens the form on first paint, for the address `?edit=` names. */
		open: boolean;
		label: string;
	}
}

/** A disclosure holding a one-field form that sets a category's monthly limit. */
function EditBudget(handle: Handle<EditBudget.Props>) {
	return () => {
		let { category, value, open, label } = handle.props;
		return (
			<details
				open={open}
				mix={raw({
					"& > summary": { cursor: "pointer", listStyle: "none" },
					"& > summary::-webkit-details-marker": { display: "none" },
				})}
			>
				<summary
					mix={raw({
						display: "inline-flex",
						fontSize: "0.8125rem",
						fontWeight: "500",
						color: "var(--ui-brand-fg)",
						borderRadius: "0.375rem",
						"&:focus-visible": { outline: "2px solid var(--ui-brand-solid)", outlineOffset: "2px" },
					})}
				>
					{label}
				</summary>
				<form
					method="post"
					action={actionHref(`budgets/${category}`)}
					mix={raw({
						display: "flex",
						alignItems: "flex-end",
						gap: "0.5rem",
						marginBlockStart: "0.5rem",
						flexWrap: "wrap",
					})}
				>
					<TextField
						label="Monthly limit"
						name="amount"
						prefix="€"
						defaultValue={value === undefined ? "" : (value / 100).toFixed(0)}
						autoComplete="off"
						required
						mix={raw({ flex: "1 1 10rem" })}
					/>
					<Button type="submit">Save budget</Button>
				</form>
			</details>
		);
	};
}

/** One budget: name, spent of limit, the bar with today's pace mark, and what is left. */
function BudgetRow(handle: Handle<{ status: BudgetStatus; editing: boolean }>) {
	return () => {
		let { status, editing } = handle.props;
		let category = findCategory(status.category);
		let used = Math.min(status.spent / status.budget, 1);
		let month = TODAY.slice(0, 7);
		let pace = Number(TODAY.slice(8)) / daysInMonth(month);
		let left = status.budget - status.spent;
		let tone = {
			over: "var(--ui-danger-solid)",
			near: "var(--ui-warning-solid)",
			fine: `var(--ui-chart-${category?.color ?? 1})`,
		}[status.state];
		return (
			<li
				id={`budget-${status.category}`}
				data-state={status.state}
				mix={raw({
					display: "grid",
					gridTemplateColumns: "auto 1fr",
					gap: "0.5rem 0.875rem",
					paddingBlock: "1rem",
					borderBlockEnd: "1px solid var(--tuppence-hairline)",
					"&:last-child": { borderBlockEnd: "0" },
				})}
			>
				<CategoryTile category={status.category} size={2.5} />
				<div
					mix={raw({ display: "flex", flexDirection: "column", gap: "0.5rem", minInlineSize: "0" })}
				>
					<div
						mix={raw({
							display: "flex",
							justifyContent: "space-between",
							alignItems: "baseline",
							gap: "1rem",
							flexWrap: "wrap",
						})}
					>
						<span mix={raw({ fontWeight: "600" })}>{category?.name}</span>
						<span mix={raw({ fontSize: "0.875rem" })}>
							<strong mix={raw({ fontWeight: "600" })}>
								<Money value={status.spent} currency={HOME} />
							</strong>{" "}
							<span mix={raw({ color: "var(--ui-neutral-fg-muted)" })}>
								of <Money value={status.budget} currency={HOME} />
							</span>
						</span>
					</div>
					<div
						role="meter"
						aria-label={`${category?.name} budget used`}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round((status.spent / status.budget) * 100)}
						aria-valuetext={`${Math.round((status.spent / status.budget) * 100)}% used`}
						mix={raw({
							position: "relative",
							blockSize: "0.625rem",
							borderRadius: "999px",
							backgroundColor: "color-mix(in oklch, var(--ui-fg) 8%, transparent)",
						})}
					>
						<span
							data-slot="budget-fill"
							mix={raw({
								position: "absolute",
								insetBlock: "0",
								insetInlineStart: "0",
								inlineSize: `${used * 100}%`,
								borderRadius: "999px",
								backgroundColor: tone,
							})}
						/>
						<span
							title="Where the month's pace puts you today"
							mix={raw({
								position: "absolute",
								insetBlock: "-0.25rem",
								insetInlineStart: `${pace * 100}%`,
								inlineSize: "2px",
								borderRadius: "1px",
								backgroundColor: "var(--ui-fg)",
								opacity: "0.55",
							})}
						/>
					</div>
					<div
						mix={raw({
							display: "flex",
							justifyContent: "space-between",
							gap: "1rem",
							flexWrap: "wrap",
							fontSize: "0.8125rem",
							color: "var(--ui-neutral-fg-muted)",
						})}
					>
						<span
							data-slot="budget-left"
							mix={raw({
								color: status.state === "over" ? "var(--ui-danger-fg)" : "inherit",
								fontWeight: status.state === "fine" ? "400" : "600",
							})}
						>
							{left >= 0 ? (
								<>
									<Money value={left} currency={HOME} /> left · about{" "}
									<Money value={Math.floor(left / daysLeft())} currency={HOME} /> a day
								</>
							) : (
								<>
									<Money value={-left} currency={HOME} /> over
								</>
							)}
						</span>
						<span>
							On pace for <Money value={status.projected} currency={HOME} />
						</span>
					</div>
					<EditBudget
						category={status.category}
						value={status.budget}
						open={editing}
						label="Change limit"
					/>
				</div>
			</li>
		);
	};
}

namespace BudgetsScreen {
	export interface Props {
		wallet: Wallet;
		url: URL;
	}
}

/** The budgets screen. */
export function BudgetsScreen(handle: Handle<BudgetsScreen.Props>) {
	return () => {
		let { wallet, url } = handle.props;
		let editing = url.searchParams.get("edit");
		let statuses = budgetStatuses(wallet);
		let alerts = statuses.filter((status) => status.state !== "fine");
		let budgeted = statuses.reduce((sum, status) => sum + status.budget, 0);
		let spent = statuses.reduce((sum, status) => sum + status.spent, 0);
		let without = BUDGETABLE.filter((category) => budgetFor(wallet, category.id) === undefined);
		let month = TODAY.slice(0, 7);
		let others = new Map(spendingByCategory(wallet, month).map((row) => [row.category, row.total]));
		return (
			<Screen width="48rem">
				<ScreenTitle
					title="Budgets"
					detail={
						<>
							<Money value={spent} currency={HOME} /> of <Money value={budgeted} currency={HOME} />{" "}
							spent in {monthName(month)}, with {daysLeft()} days to go.
						</>
					}
				/>
				{alerts.length === 0 ? null : (
					<Alert color={alerts.some((status) => status.state === "over") ? "danger" : "warning"}>
						<TriangleAlertIcon size={18} aria-hidden="true" />
						<span>
							{alerts
								.map((status) => {
									let name = findCategory(status.category)?.name;
									return status.state === "over"
										? `${name} is over its limit.`
										: `${name} has used ${Math.round((status.spent / status.budget) * 100)}% with ${daysLeft()} days left.`;
								})
								.join(" ")}
						</span>
					</Alert>
				)}
				<Panel title={`${monthName(month)} budgets`}>
					<ul mix={raw({ listStyle: "none", margin: "0", padding: "0" })}>
						{statuses.map((status) => (
							<BudgetRow status={status} editing={editing === status.category} />
						))}
					</ul>
				</Panel>
				{without.length === 0 ? null : (
					<Panel title="No budget yet">
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
							{without.map((category) => (
								<li
									id={`budget-${category.id}`}
									mix={raw({
										display: "grid",
										gridTemplateColumns: "auto 1fr",
										gap: "0.25rem 0.875rem",
									})}
								>
									<CategoryTile category={category.id} size={2.5} />
									<div mix={raw({ display: "flex", flexDirection: "column", gap: "0.25rem" })}>
										<span
											mix={raw({ display: "flex", justifyContent: "space-between", gap: "1rem" })}
										>
											<span mix={raw({ fontWeight: "600" })}>{category.name}</span>
											<span
												mix={raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })}
											>
												<Money value={others.get(category.id) ?? 0} currency={HOME} /> this month
											</span>
										</span>
										<EditBudget
											category={category.id}
											open={editing === category.id}
											label="Set a budget"
										/>
									</div>
								</li>
							))}
						</ul>
					</Panel>
				)}
			</Screen>
		);
	};
}
