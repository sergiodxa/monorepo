/**
 * Savings pots: each goal with how far along it is and what it needs a month to arrive on
 * time, and one pot's page with a form that moves money in or out of it, refusing more than
 * there is and keeping what was typed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowLeftIcon, PiggyBankIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Button, Link, TextField } from "@sdxc/ui";
import { Ledger } from "@sdxc/ui/finance/ledger";

import type { Pot } from "./data";
import type { Wallet } from "./state";

import { HOME, POTS, RECURRING, TODAY, actionHref, findAccount, findPot, href } from "./data";
import { EntryRow } from "./ledger-parts";
import { DemoNote, Money, Panel, SERIF, Screen, ScreenTitle, dayTitle, longDate } from "./parts";
import { balanceOf, entries, potBalance } from "./state";

/** Whole months from today until a day, at least one. */
function monthsUntil(day: string): number {
	let [fromYear = 0, fromMonth = 0] = TODAY.split("-").map(Number);
	let [toYear = 0, toMonth = 0] = day.split("-").map(Number);
	return Math.max(1, (toYear - fromYear) * 12 + (toMonth - fromMonth));
}

/** The sentence under a pot that says what it needs, or that it is done. */
function PotSentence(handle: Handle<{ pot: Pot; balance: number }>) {
	return () => {
		let { pot, balance } = handle.props;
		if (pot.target === undefined) return "No goal, just collecting.";
		let missing = pot.target - balance;
		if (missing <= 0) return "Goal reached.";
		if (pot.by === undefined)
			return (
				<>
					<Money value={missing} currency={HOME} /> to go
				</>
			);
		return (
			<>
				<Money value={Math.ceil(missing / monthsUntil(pot.by))} currency={HOME} /> a month to reach
				it by {longDate(pot.by, false)}
			</>
		);
	};
}

/** A goal's progress bar in the pot's own hue. */
function GoalBar(handle: Handle<{ pot: Pot; balance: number }>) {
	return () => {
		let { pot, balance } = handle.props;
		if (pot.target === undefined) return null;
		let percent = Math.min(100, Math.round((balance / pot.target) * 100));
		return (
			<div
				role="progressbar"
				aria-label={`${pot.name} goal`}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={percent}
				mix={raw({
					blockSize: "0.5rem",
					borderRadius: "999px",
					backgroundColor: "color-mix(in oklch, var(--ui-fg) 8%, transparent)",
					overflow: "hidden",
				})}
			>
				<span
					mix={raw({
						display: "block",
						blockSize: "100%",
						inlineSize: `${percent}%`,
						borderRadius: "999px",
						backgroundColor: `light-dark(oklch(0.62 0.13 ${pot.hue}), oklch(0.74 0.12 ${pot.hue}))`,
					})}
				/>
			</div>
		);
	};
}

namespace PotsScreen {
	export interface Props {
		wallet: Wallet;
	}
}

/** Every pot as a card, with the total set aside. */
export function PotsScreen(handle: Handle<PotsScreen.Props>) {
	return () => {
		let { wallet } = handle.props;
		let total = POTS.reduce((sum, pot) => sum + potBalance(wallet, pot.id), 0);
		return (
			<Screen width="60rem">
				<ScreenTitle
					title="Pots"
					detail={
						<>
							<Money value={total} currency={HOME} /> set aside across {POTS.length} pots, apart
							from your spending money.
						</>
					}
				/>
				<ul
					mix={raw({
						listStyle: "none",
						margin: "0",
						padding: "0",
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 16.5rem), 1fr))",
						gap: "1rem",
					})}
				>
					{POTS.map((pot) => {
						let balance = potBalance(wallet, pot.id);
						let percent =
							pot.target === undefined
								? undefined
								: Math.min(100, Math.round((balance / pot.target) * 100));
						return (
							<li>
								<a
									href={href(`pots/${pot.id}`)}
									data-rmx-prefetch="intent"
									mix={raw({
										display: "flex",
										flexDirection: "column",
										gap: "0.875rem",
										blockSize: "100%",
										padding: "1.125rem",
										borderRadius: "1.25rem",
										color: "inherit",
										textDecoration: "none",
										backgroundColor: "var(--tuppence-card)",
										boxShadow: "0 0 0 1px var(--tuppence-hairline)",
										"&:hover": {
											boxShadow: `0 0 0 1px light-dark(oklch(0.62 0.13 ${pot.hue}), oklch(0.74 0.12 ${pot.hue}))`,
										},
										"&:focus-visible": {
											outline: "2px solid var(--ui-brand-solid)",
											outlineOffset: "2px",
										},
									})}
								>
									<span
										mix={raw({
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: "0.75rem",
										})}
									>
										<span
											mix={raw({
												display: "flex",
												alignItems: "center",
												gap: "0.625rem",
												fontWeight: "600",
											})}
										>
											<span
												aria-hidden="true"
												mix={raw({
													display: "grid",
													placeItems: "center",
													inlineSize: "2.25rem",
													blockSize: "2.25rem",
													borderRadius: "30%",
													backgroundColor: `light-dark(oklch(0.92 0.05 ${pot.hue}), oklch(0.34 0.06 ${pot.hue}))`,
													color: `light-dark(oklch(0.42 0.11 ${pot.hue}), oklch(0.88 0.07 ${pot.hue}))`,
												})}
											>
												<PiggyBankIcon size={18} />
											</span>
											{pot.name}
										</span>
										{percent === undefined ? null : (
											<span
												mix={raw({
													fontSize: "0.8125rem",
													color: "var(--ui-neutral-fg-muted)",
													fontVariantNumeric: "tabular-nums",
												})}
											>
												{percent}%
											</span>
										)}
									</span>
									<span
										mix={raw({
											display: "flex",
											alignItems: "baseline",
											gap: "0.375rem",
											flexWrap: "wrap",
										})}
									>
										<span
											mix={raw({
												fontFamily: SERIF,
												fontSize: "1.75rem",
												fontWeight: "600",
												letterSpacing: "-0.015em",
											})}
										>
											<Money value={balance} currency={HOME} smallMinor />
										</span>
										{pot.target === undefined ? null : (
											<span
												mix={raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })}
											>
												of <Money value={pot.target} currency={HOME} />
											</span>
										)}
									</span>
									<GoalBar pot={pot} balance={balance} />
									<span mix={raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })}>
										<PotSentence pot={pot} balance={balance} />
									</span>
								</a>
							</li>
						);
					})}
				</ul>
			</Screen>
		);
	};
}

namespace PotDetail {
	export interface Props {
		wallet: Wallet;
		pot: Pot;
		/** Which way the form starts, from the address. */
		direction: "in" | "out";
		/** What the visitor typed before a refused move. */
		amount: string;
		/** Why the last move was refused. */
		error: "amount" | "balance" | null;
	}
}

/** One pot: its goal, a form to move money and its recent moves. */
function PotDetail(handle: Handle<PotDetail.Props>) {
	return () => {
		let { wallet, pot, direction, amount, error } = handle.props;
		let balance = potBalance(wallet, pot.id);
		let main = findAccount("main")!;
		let available = balanceOf(wallet, main);
		let standing = RECURRING.find((entry) => entry.id === pot.recurring);
		let moves = entries(wallet)
			.filter((entry) => entry.merchant === `pot-${pot.id}`)
			.slice(0, 6);
		let errorText =
			error === null ? undefined : (
				<MoveError
					error={error}
					direction={direction}
					available={direction === "in" ? available : balance}
				/>
			);
		return (
			<Screen width="44rem">
				<Link
					href={href("pots")}
					mix={raw({
						display: "inline-flex",
						alignItems: "center",
						gap: "0.25rem",
						fontSize: "0.875rem",
						alignSelf: "flex-start",
					})}
				>
					<ArrowLeftIcon size={16} aria-hidden="true" />
					All pots
				</Link>
				<ScreenTitle title={pot.name} detail={pot.purpose} />
				<Panel>
					<div mix={raw({ display: "flex", flexDirection: "column", gap: "0.75rem" })}>
						<span
							mix={raw({
								display: "flex",
								alignItems: "baseline",
								gap: "0.5rem",
								flexWrap: "wrap",
							})}
						>
							<span
								data-slot="pot-balance"
								mix={raw({
									fontFamily: SERIF,
									fontSize: "2.5rem",
									fontWeight: "600",
									letterSpacing: "-0.02em",
								})}
							>
								<Money value={balance} currency={HOME} smallMinor />
							</span>
							{pot.target === undefined ? null : (
								<span mix={raw({ color: "var(--ui-neutral-fg-muted)" })}>
									of <Money value={pot.target} currency={HOME} />
								</span>
							)}
						</span>
						<GoalBar pot={pot} balance={balance} />
						<p
							mix={raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })}
						>
							<PotSentence pot={pot} balance={balance} />
							{standing === undefined ? null : (
								<>
									{" "}
									· <Money value={-standing.amount} currency={HOME} /> goes in on the {standing.day}
									th of every month.
								</>
							)}
						</p>
					</div>
				</Panel>
				<Panel title="Move money" id="move">
					<form
						method="post"
						action={actionHref(`pots/${pot.id}`)}
						mix={raw({ display: "flex", flexDirection: "column", gap: "1rem" })}
					>
						<fieldset
							mix={raw({
								border: "0",
								margin: "0",
								padding: "0",
								display: "flex",
								gap: "0.5rem",
								flexWrap: "wrap",
							})}
						>
							<legend
								mix={raw({
									position: "absolute",
									inlineSize: "1px",
									blockSize: "1px",
									overflow: "hidden",
									clipPath: "inset(50%)",
								})}
							>
								Direction
							</legend>
							{(["in", "out"] as const).map((way) => (
								<label
									mix={raw({
										flex: "1 1 10rem",
										display: "grid",
										gridTemplateColumns: "auto 1fr",
										alignItems: "center",
										gap: "0 0.5rem",
										padding: "0.75rem 0.875rem",
										borderRadius: "0.875rem",
										boxShadow: "0 0 0 1px var(--tuppence-hairline)",
										cursor: "pointer",
										fontSize: "0.9375rem",
										"&:has(:checked)": {
											boxShadow: "0 0 0 2px var(--ui-brand-solid)",
											backgroundColor: "color-mix(in oklch, var(--ui-brand-solid) 6%, transparent)",
										},
										"&:has(:focus-visible)": {
											outline: "2px solid var(--ui-brand-solid)",
											outlineOffset: "2px",
										},
									})}
								>
									<input
										type="radio"
										name="direction"
										value={way}
										checked={way === direction}
										mix={raw({ accentColor: "var(--ui-brand-solid)" })}
									/>
									<span mix={raw({ fontWeight: "600" })}>
										{way === "in" ? "Add to pot" : "Withdraw"}
									</span>
									<span
										mix={raw({
											gridColumn: "2",
											fontSize: "0.75rem",
											color: "var(--ui-neutral-fg-muted)",
										})}
									>
										{way === "in" ? "From Everyday, " : "Back to Everyday, "}
										<Money value={way === "in" ? available : balance} currency={HOME} /> available
									</span>
								</label>
							))}
						</fieldset>
						<div
							mix={raw({
								display: "flex",
								alignItems: "flex-end",
								gap: "0.5rem",
								flexWrap: "wrap",
							})}
						>
							<TextField
								label="Amount"
								name="amount"
								prefix="€"
								defaultValue={amount}
								placeholder="0.00"
								autoComplete="off"
								errorMessage={errorText}
								required
								mix={raw({ flex: "1 1 12rem" })}
							/>
							<Button type="submit">Move money</Button>
						</div>
						<DemoNote>
							nothing leaves any account. The move lives in this browser for a week, or until you
							reset the demo.
						</DemoNote>
					</form>
				</Panel>
				{moves.length === 0 ? null : (
					<Panel title="Recent moves" flush>
						<Ledger>
							{[...new Set(moves.map((entry) => entry.date))].map((day) => (
								<Ledger.Day title={dayTitle(day, TODAY)}>
									{moves
										.filter((entry) => entry.date === day)
										.map((entry) => (
											<EntryRow entry={entry} link={href(`transactions?tx=${entry.id}`)} />
										))}
								</Ledger.Day>
							))}
						</Ledger>
					</Panel>
				)}
			</Screen>
		);
	};
}

namespace MoveError {
	export interface Props {
		error: "amount" | "balance";
		direction: "in" | "out";
		/** What the move could take from. */
		available: number;
	}
}

/** The message a refused move shows under the amount field, saying how to fix it. */
function MoveError(handle: Handle<MoveError.Props>) {
	return () => {
		let { error, direction, available } = handle.props;
		if (error === "amount") return "Enter an amount above zero, like 50 or 12.50.";
		return (
			<>
				That's more than the <Money value={available} currency={HOME} />{" "}
				{direction === "in" ? "in Everyday" : "in this pot"}.
			</>
		);
	};
}

/**
 * The page a `pots/<id>` address names, with the form's direction, typed amount and error
 * read from the address a refused move redirected to.
 *
 * @param wallet The visitor's changes.
 * @param id The pot's id.
 * @param url The page's address.
 */
export function potScreen(
	wallet: Wallet,
	id: string,
	url: URL,
): { title: string; content: RemixNode } | undefined {
	let pot = findPot(id);
	if (pot === undefined) return undefined;
	let params = url.searchParams;
	let error = params.get("error");
	return {
		title: pot.name,
		content: (
			<PotDetail
				wallet={wallet}
				pot={pot}
				direction={params.get("direction") === "out" ? "out" : "in"}
				amount={params.get("amount") ?? ""}
				error={error === "amount" || error === "balance" ? error : null}
			/>
		),
	};
}
