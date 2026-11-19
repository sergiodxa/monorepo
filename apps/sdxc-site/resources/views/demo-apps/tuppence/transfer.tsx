/**
 * The transfer flow, one page per step with the step in the address: pick a payee, enter an
 * amount and a reference, review it, then a confirmation. Each step works without script, a
 * refused amount comes back with what was typed, and no money ever leaves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { CircleCheckIcon, ChevronRightIcon } from "@sdxc/icons";
import { formatAmount } from "@sdxc/money";
import { parseAmount } from "@sdxc/money";
import { raw } from "@sdxc/u/general";
import { Button, Link, LinkButton, StepIndicator, TextField } from "@sdxc/ui";

import type { Account, Payee } from "./data";
import type { Wallet } from "./state";

import { LOCALE, PAYEES, actionHref, findAccount, findMerchant, findPayee, href } from "./data";
import { DemoNote, MerchantMark, Money, Panel, SERIF, Screen, ScreenTitle } from "./parts";
import { balanceOf } from "./state";

/** The account a payee is paid from: the one in the payee's currency. */
function sourceFor(payee: Payee): Account {
	return findAccount(payee.currency === "GBP" ? "gbp" : "main")!;
}

/** Where a step stands relative to the one the visitor is on. */
function stepState(step: number, at: number): StepIndicator.State {
	if (step < at) return "complete";
	if (step === at) return "current";
	return "upcoming";
}

/** The steps, marked for where the visitor is. */
function Steps(
	handle: Handle<{ at: 1 | 2 | 3; payee?: string; amount?: string; reference?: string }>,
) {
	return () => {
		let { at, payee, amount, reference } = handle.props;
		let state = (step: number) => stepState(step, at);
		let amountHref =
			payee === undefined
				? undefined
				: href(
						`transfer/amount?${new URLSearchParams({ payee, amount: amount ?? "", reference: reference ?? "" }).toString()}`,
					);
		return (
			<StepIndicator label="Transfer steps">
				<StepIndicator.Step number={1} state={state(1)} href={href("transfer")}>
					Payee
				</StepIndicator.Step>
				<StepIndicator.Step number={2} state={state(2)} href={amountHref}>
					Amount
				</StepIndicator.Step>
				<StepIndicator.Step number={3} state={state(3)}>
					Review
				</StepIndicator.Step>
			</StepIndicator>
		);
	};
}

/** Step one: the saved payees, each a link to the amount step. */
function PickPayee() {
	return () => (
		<Screen width="36rem">
			<ScreenTitle title="Send money" detail="Who is it for?" />
			<Steps at={1} />
			<Panel title="Saved payees" flush>
				<ul
					mix={raw({
						listStyle: "none",
						margin: "0",
						padding: "0 0.25rem",
						display: "flex",
						flexDirection: "column",
					})}
				>
					{PAYEES.map((payee) => {
						let merchant = findMerchant(payee.merchant);
						return (
							<li>
								<a
									href={href(`transfer/amount?payee=${payee.id}`)}
									data-rmx-prefetch="intent"
									mix={raw({
										display: "flex",
										alignItems: "center",
										gap: "0.75rem",
										padding: "0.75rem",
										borderRadius: "0.875rem",
										color: "inherit",
										textDecoration: "none",
										"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
										"&:focus-visible": {
											outline: "2px solid var(--ui-brand-bg-solid)",
											outlineOffset: "-2px",
										},
									})}
								>
									<MerchantMark merchant={merchant} />
									<span mix={raw({ flex: "1", display: "flex", flexDirection: "column" })}>
										<span mix={raw({ fontWeight: "500" })}>{merchant?.name}</span>
										<span mix={raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })}>
											{payee.bank} · {payee.masked} · {payee.currency}
										</span>
									</span>
									<ChevronRightIcon size={18} aria-hidden="true" />
								</a>
							</li>
						);
					})}
				</ul>
			</Panel>
			<DemoNote>
				every payee, bank and account number here is invented, and no payment is ever made.
			</DemoNote>
		</Screen>
	);
}

namespace EnterAmount {
	export interface Props {
		wallet: Wallet;
		payee: Payee;
		amount: string;
		reference: string;
		/** Why the amount was sent back. */
		error: "amount" | "balance" | null;
	}
}

/** The amount field's message after a refused amount, saying what would work. */
function AmountError(
	handle: Handle<{ error: "amount" | "balance"; available: number; currency: string }>,
) {
	return () => {
		let { error, available, currency } = handle.props;
		if (error === "amount") return "Enter an amount above zero, like 25 or 12.50.";
		return (
			<>
				That's more than the <Money value={available} currency={currency} /> available.
			</>
		);
	};
}

/** Step two: the amount and reference, as a GET form so the review page is an address. */
function EnterAmount(handle: Handle<EnterAmount.Props>) {
	return () => {
		let { wallet, payee, amount, reference, error } = handle.props;
		let merchant = findMerchant(payee.merchant);
		let source = sourceFor(payee);
		let available = balanceOf(wallet, source);
		return (
			<Screen width="36rem">
				<ScreenTitle title="Send money" detail={`To ${merchant?.name}`} />
				<Steps at={2} payee={payee.id} amount={amount} reference={reference} />
				<Panel>
					<form
						method="get"
						action={href("transfer/review")}
						mix={raw({ display: "flex", flexDirection: "column", gap: "1rem" })}
					>
						<input type="hidden" name="payee" value={payee.id} />
						<div mix={raw({ display: "flex", alignItems: "center", gap: "0.75rem" })}>
							<MerchantMark merchant={merchant} />
							<span mix={raw({ display: "flex", flexDirection: "column" })}>
								<span mix={raw({ fontWeight: "600" })}>{merchant?.name}</span>
								<span mix={raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })}>
									{payee.bank} · {payee.masked}
								</span>
							</span>
						</div>
						<TextField
							label="Amount"
							name="amount"
							prefix={source.symbol}
							defaultValue={amount}
							placeholder="0.00"
							autoComplete="off"
							required
							description={
								<>
									From {source.name}, <Money value={available} currency={source.currency} />{" "}
									available
								</>
							}
							errorMessage={
								error === null ? undefined : (
									<AmountError error={error} available={available} currency={source.currency} />
								)
							}
						/>
						<TextField
							label="Reference"
							name="reference"
							defaultValue={reference}
							maxLength={40}
							placeholder="What's it for?"
							autoComplete="off"
						/>
						<div mix={raw({ display: "flex", justifyContent: "flex-end", gap: "0.5rem" })}>
							<LinkButton href={href("transfer")} variant="ghost" color="neutral">
								Back
							</LinkButton>
							<Button type="submit" color="brand">
								Review
							</Button>
						</div>
					</form>
				</Panel>
			</Screen>
		);
	};
}

namespace Review {
	export interface Props {
		payee: Payee;
		/** The amount in minor units, already checked. */
		cents: number;
		/** What the visitor typed, for the Change link. */
		typed: string;
		reference: string;
	}
}

/** One review line. */
function ReviewLine(handle: Handle<{ label: string; children: RemixNode }>) {
	return () => (
		<div
			mix={raw({
				display: "flex",
				justifyContent: "space-between",
				gap: "1rem",
				paddingBlock: "0.625rem",
				borderBlockEnd: "1px solid var(--tuppence-hairline)",
				fontSize: "0.9375rem",
			})}
		>
			<dt mix={raw({ color: "var(--ui-neutral-fg-muted)" })}>{handle.props.label}</dt>
			<dd mix={raw({ margin: "0", textAlign: "end", fontWeight: "500" })}>
				{handle.props.children}
			</dd>
		</div>
	);
}

/** Step three: everything about the transfer, and the one button that sends it. */
function Review(handle: Handle<Review.Props>) {
	return () => {
		let { payee, cents, typed, reference } = handle.props;
		let merchant = findMerchant(payee.merchant);
		let source = sourceFor(payee);
		let label = formatAmount(cents, payee.currency, { locale: LOCALE });
		return (
			<Screen width="36rem">
				<ScreenTitle title="Check and send" detail="Nothing has moved yet." />
				<Steps at={3} payee={payee.id} amount={typed} reference={reference} />
				<Panel>
					<div
						mix={raw({
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: "0.5rem",
							paddingBlock: "0.5rem",
							textAlign: "center",
						})}
					>
						<MerchantMark merchant={merchant} size={3.5} />
						<span mix={raw({ fontSize: "0.9375rem" })}>
							To <strong mix={raw({ fontWeight: "600" })}>{merchant?.name}</strong>
						</span>
						<span
							data-slot="review-amount"
							mix={raw({
								fontFamily: SERIF,
								fontSize: "2.75rem",
								fontWeight: "600",
								letterSpacing: "-0.02em",
								lineHeight: "1.1",
							})}
						>
							<Money value={cents} currency={payee.currency} smallMinor />
						</span>
					</div>
					<dl mix={raw({ margin: "0" })}>
						<ReviewLine label="From">{`${source.name} · ${source.masked}`}</ReviewLine>
						<ReviewLine label="To">{`${payee.bank} · ${payee.masked}`}</ReviewLine>
						<ReviewLine label="Reference">{reference === "" ? "None" : reference}</ReviewLine>
						<ReviewLine label="Fee">
							<Money value={0} currency={payee.currency} />
						</ReviewLine>
						<ReviewLine label="Arrives">Within seconds</ReviewLine>
					</dl>
					<form
						method="post"
						action={actionHref("transfer")}
						mix={raw({ display: "flex", flexDirection: "column", gap: "0.75rem" })}
					>
						<input type="hidden" name="payee" value={payee.id} />
						<input type="hidden" name="amount" value={String(cents)} />
						<input type="hidden" name="reference" value={reference} />
						<DemoNote>
							this is not a real payment. Sending adds a pending line to your demo statement and
							nothing else.
						</DemoNote>
						<div
							mix={raw({
								display: "flex",
								justifyContent: "space-between",
								gap: "0.5rem",
								flexWrap: "wrap",
							})}
						>
							<LinkButton
								href={href(
									`transfer/amount?${new URLSearchParams({ payee: payee.id, amount: typed, reference }).toString()}`,
								)}
								variant="ghost"
								color="neutral"
							>
								Change
							</LinkButton>
							<Button type="submit" color="brand" data-slot="send-button">
								Send {label}
							</Button>
						</div>
					</form>
				</Panel>
			</Screen>
		);
	};
}

/** The confirmation after sending. */
function Sent(handle: Handle<{ payee: Payee; cents: number; id: string | null; known: boolean }>) {
	return () => {
		let { payee, cents, id, known } = handle.props;
		let merchant = findMerchant(payee.merchant);
		return (
			<Screen width="32rem">
				<Panel>
					<div
						role="status"
						mix={raw({
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: "0.75rem",
							textAlign: "center",
							paddingBlock: "1.5rem 0.5rem",
						})}
					>
						<CircleCheckIcon
							size={48}
							aria-hidden="true"
							mix={raw({ color: "var(--ui-success-fg)" })}
						/>
						<h1
							mix={raw({ margin: "0", fontFamily: SERIF, fontSize: "1.75rem", fontWeight: "600" })}
						>
							<Money value={cents} currency={payee.currency} /> on its way
						</h1>
						<p mix={raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })}>
							To {merchant?.name}. It shows as pending on your statement.
						</p>
					</div>
					<DemoNote>
						no money moved. The pending line lives in this browser until you reset the demo.
					</DemoNote>
					<div
						mix={raw({
							display: "flex",
							justifyContent: "center",
							gap: "0.5rem",
							flexWrap: "wrap",
						})}
					>
						{known && id !== null ? (
							<LinkButton href={href(`transactions?tx=${id}`)} variant="outline" color="neutral">
								View in transactions
							</LinkButton>
						) : null}
						<LinkButton href={href()}>Done</LinkButton>
					</div>
				</Panel>
				<p mix={raw({ margin: "0", textAlign: "center", fontSize: "0.875rem" })}>
					<Link href={href("transfer")}>Send another</Link>
				</p>
			</Screen>
		);
	};
}

/**
 * The page a transfer step's address names. An unreadable or too large amount on the review
 * address shows the amount step again with the reason, keeping what was typed.
 *
 * @param wallet The visitor's changes.
 * @param step `""`, `amount`, `review` or `sent`.
 * @param url The page's address.
 */
export function transferStep(
	wallet: Wallet,
	step: string,
	url: URL,
): { title: string; content: RemixNode } | undefined {
	let params = url.searchParams;
	if (step === "") return { title: "Send money", content: <PickPayee /> };
	let payee = findPayee(params.get("payee") ?? "");
	if (payee === undefined) return undefined;
	let typed = params.get("amount") ?? "";
	let reference = (params.get("reference") ?? "").slice(0, 40);
	let amountStep = (error: EnterAmount.Props["error"]) => ({
		title: "Send money",
		content: (
			<EnterAmount
				wallet={wallet}
				payee={payee}
				amount={typed}
				reference={reference}
				error={error}
			/>
		),
	});
	if (step === "amount") {
		let error = params.get("error");
		return amountStep(error === "amount" || error === "balance" ? error : null);
	}
	if (step === "review") {
		let cents = parseAmount(typed, payee.currency, { locale: LOCALE });
		if (cents === null) return amountStep("amount");
		if (cents > balanceOf(wallet, sourceFor(payee))) return amountStep("balance");
		return {
			title: "Check and send",
			content: <Review payee={payee} cents={cents} typed={typed} reference={reference} />,
		};
	}
	if (step === "sent") {
		let cents = Number(params.get("amount"));
		if (!Number.isSafeInteger(cents) || cents <= 0) return undefined;
		let id = params.get("id");
		return {
			title: "Sent",
			content: (
				<Sent
					payee={payee}
					cents={cents}
					id={id}
					known={wallet.sent.some((sent) => sent.id === id)}
				/>
			),
		};
	}
	return undefined;
}
