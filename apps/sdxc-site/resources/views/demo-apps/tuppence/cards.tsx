/**
 * Noor's cards: the chosen card drawn large, a freeze switch that saves the moment it is
 * pressed (and offers Undo), the month's spending against its limit, and the printed details
 * behind a disclosure, every number in them fake.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { LockKeyholeOpenIcon, SnowflakeIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Button } from "@sdxc/ui";
import { PaymentCard } from "@sdxc/ui/finance/payment-card";

import type { Card } from "./data";
import type { Wallet } from "./state";

import { CARDS, HOLDER, HOME, actionHref, findCard, href } from "./data";
import { DemoNote, Money, Panel, Screen, ScreenTitle } from "./parts";

/** One card in the picker: its drawing at a small size and its name. */
function CardChoice(handle: Handle<{ card: Card; current: boolean; frozen: boolean }>) {
	return () => {
		let { card, current, frozen } = handle.props;
		return (
			<a
				href={href(`cards?card=${card.id}`)}
				aria-current={current ? "page" : undefined}
				data-rmx-prefetch="intent"
				mix={raw({
					display: "flex",
					alignItems: "center",
					gap: "0.75rem",
					padding: "0.625rem",
					borderRadius: "1rem",
					color: "inherit",
					textDecoration: "none",
					boxShadow: "0 0 0 1px var(--tuppence-hairline)",
					backgroundColor: "var(--tuppence-card)",
					"&[aria-current='page']": { boxShadow: "0 0 0 2px var(--ui-brand-solid)" },
					"&:focus-visible": { outline: "2px solid var(--ui-brand-solid)", outlineOffset: "2px" },
				})}
			>
				<span mix={raw({ inlineSize: "4.5rem", flex: "none" })} aria-hidden="true">
					<PaymentCard
						label={card.name}
						brand=""
						last4={card.last4}
						holder=""
						expires=""
						network=""
						kind={card.kind}
						tone={card.tone}
						frozen={frozen}
						frozenLabel=""
						virtualLabel=""
						mix={raw({ "--ui-payment-card-radius": "0.375rem" })}
					/>
				</span>
				<span mix={raw({ display: "flex", flexDirection: "column", minInlineSize: "0" })}>
					<span mix={raw({ fontWeight: "600" })}>{card.name}</span>
					<span mix={raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })}>
						{card.kind === "virtual" ? "Virtual" : "Physical"} · •• {card.last4}
						{frozen ? " · Frozen" : ""}
					</span>
				</span>
			</a>
		);
	};
}

namespace CardsScreen {
	export interface Props {
		wallet: Wallet;
		url: URL;
	}
}

/** The cards screen. */
export function CardsScreen(handle: Handle<CardsScreen.Props>) {
	return () => {
		let { wallet, url } = handle.props;
		let card = findCard(url.searchParams.get("card") ?? "") ?? CARDS[0]!;
		let frozen = wallet.frozen.includes(card.id);
		let used = Math.min(1, card.spent / card.limit);
		return (
			<Screen width="60rem">
				<ScreenTitle
					title="Cards"
					detail="Freeze a card the moment it goes missing; unfreeze it when it turns up."
				/>
				<div
					mix={raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))",
						gap: "1.5rem",
						alignItems: "start",
					})}
				>
					<div mix={raw({ display: "flex", flexDirection: "column", gap: "1rem" })}>
						<PaymentCard
							label={`${card.name} ending ${card.last4}`}
							brand="Tuppence"
							last4={card.last4}
							holder={HOLDER.name}
							expires={card.expires}
							network="debit"
							kind={card.kind}
							tone={card.tone}
							frozen={frozen}
							mix={raw({ marginInline: "auto" })}
						/>
						<nav aria-label="Your cards" mix={raw({ display: "grid", gap: "0.5rem" })}>
							{CARDS.map((choice) => (
								<CardChoice
									card={choice}
									current={choice.id === card.id}
									frozen={wallet.frozen.includes(choice.id)}
								/>
							))}
						</nav>
					</div>
					<div mix={raw({ display: "flex", flexDirection: "column", gap: "1.25rem" })}>
						<Panel title={card.name}>
							<form
								method="post"
								action={actionHref(`cards/${card.id}/freeze`)}
								mix={raw({
									display: "flex",
									alignItems: "center",
									gap: "0.875rem",
									flexWrap: "wrap",
								})}
							>
								<input type="hidden" name="frozen" value={frozen ? "false" : "true"} />
								<span
									aria-hidden="true"
									mix={raw({
										display: "grid",
										placeItems: "center",
										inlineSize: "2.5rem",
										blockSize: "2.5rem",
										borderRadius: "999px",
										backgroundColor: frozen
											? "light-dark(oklch(0.93 0.04 240), oklch(0.32 0.05 240))"
											: "color-mix(in oklch, var(--ui-fg) 7%, transparent)",
										color: frozen
											? "light-dark(oklch(0.45 0.12 240), oklch(0.85 0.07 240))"
											: "inherit",
									})}
								>
									<SnowflakeIcon size={20} />
								</span>
								<span mix={raw({ flex: "1 1 12rem", display: "flex", flexDirection: "column" })}>
									<span data-slot="card-state" mix={raw({ fontWeight: "600" })}>
										{frozen ? "Card is frozen" : "Card is active"}
									</span>
									<span mix={raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })}>
										{frozen
											? "Payments, withdrawals and online use are declined until you unfreeze it."
											: "Freezing declines every payment at once; direct debits keep going."}
									</span>
								</span>
								<Button
									type="submit"
									variant={frozen ? "solid" : "outline"}
									color={frozen ? "brand" : "neutral"}
									aria-pressed={frozen ? "true" : "false"}
								>
									{frozen ? (
										<LockKeyholeOpenIcon size={16} aria-hidden="true" />
									) : (
										<SnowflakeIcon size={16} aria-hidden="true" />
									)}
									{frozen ? "Unfreeze card" : "Freeze card"}
								</Button>
							</form>
							<DemoNote>
								freezing changes only this demo. No card exists and no payment is declined anywhere.
							</DemoNote>
						</Panel>
						<Panel title="This month">
							<div
								mix={raw({
									display: "flex",
									justifyContent: "space-between",
									alignItems: "baseline",
									gap: "1rem",
								})}
							>
								<span>
									<strong mix={raw({ fontWeight: "600" })}>
										<Money value={card.spent} currency={HOME} />
									</strong>{" "}
									<span mix={raw({ color: "var(--ui-neutral-fg-muted)", fontSize: "0.875rem" })}>
										spent
									</span>
								</span>
								<span mix={raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })}>
									Limit <Money value={card.limit} currency={HOME} />
								</span>
							</div>
							<div
								role="meter"
								aria-label="Monthly limit used"
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={Math.round(used * 100)}
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
										inlineSize: `${used * 100}%`,
										backgroundColor: "var(--ui-brand-solid)",
										borderRadius: "999px",
									})}
								/>
							</div>
							<p
								mix={raw({
									margin: "0",
									fontSize: "0.8125rem",
									color: "var(--ui-neutral-fg-muted)",
								})}
							>
								{card.use}.
							</p>
						</Panel>
						<Panel title="Card details">
							<details
								mix={raw({
									"& > summary": {
										cursor: "pointer",
										fontWeight: "500",
										color: "var(--ui-brand-fg)",
									},
								})}
							>
								<summary>Show card details</summary>
								<dl
									mix={raw({
										display: "grid",
										gridTemplateColumns: "auto 1fr",
										gap: "0.5rem 1rem",
										margin: "0.75rem 0 0",
										fontSize: "0.9375rem",
									})}
								>
									<dt mix={raw({ color: "var(--ui-neutral-fg-muted)" })}>Number</dt>
									<dd mix={raw({ margin: "0", fontFamily: "var(--ui-font-mono, monospace)" })}>
										•••• •••• •••• {card.last4}
									</dd>
									<dt mix={raw({ color: "var(--ui-neutral-fg-muted)" })}>Expires</dt>
									<dd mix={raw({ margin: "0", fontVariantNumeric: "tabular-nums" })}>
										{card.expires}
									</dd>
									<dt mix={raw({ color: "var(--ui-neutral-fg-muted)" })}>Security code</dt>
									<dd mix={raw({ margin: "0" })}>•••</dd>
								</dl>
								<p
									mix={raw({
										margin: "0.75rem 0 0",
										fontSize: "0.8125rem",
										color: "var(--ui-neutral-fg-muted)",
									})}
								>
									A demo card has no full number to show. A real app would ask for your passcode
									first.
								</p>
							</details>
						</Panel>
					</div>
				</div>
			</Screen>
		);
	};
}
