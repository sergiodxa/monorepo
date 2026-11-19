/**
 * One currency account: its balance in its own currency, what that is worth in euros at the
 * day's invented rate, its masked details, and its own statement with the same filters and
 * detail sheet as the transactions screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { formatAmount } from "@sdxc/money";
import { raw } from "@sdxc/u/general";

import type { Account } from "./data";
import type { Wallet } from "./state";

import { HOME, LOCALE, RATES, toHome } from "./data";
import { Money, Panel, SERIF, Screen } from "./parts";
import { balanceOf } from "./state";
import { Statement } from "./transactions";

namespace AccountScreen {
	export interface Props {
		wallet: Wallet;
		account: Account;
		url: URL;
	}
}

/** An account's screen. */
export function AccountScreen(handle: Handle<AccountScreen.Props>) {
	return () => {
		let { wallet, account, url } = handle.props;
		let balance = balanceOf(wallet, account);
		let foreign = account.currency !== HOME;
		let unit = 10 ** (account.currency === "JPY" ? 0 : 2);
		let rateFrom = account.currency === "JPY" ? 1000 : 1;
		return (
			<Screen width="56rem">
				<Panel>
					<div
						mix={raw({
							display: "flex",
							flexWrap: "wrap",
							justifyContent: "space-between",
							gap: "1rem",
							alignItems: "flex-end",
						})}
					>
						<div mix={raw({ display: "flex", flexDirection: "column", gap: "0.25rem" })}>
							<p
								mix={raw({
									margin: "0",
									color: "var(--ui-neutral-fg-muted)",
									fontSize: "0.875rem",
								})}
							>
								{account.detail} · {account.masked}
							</p>
							<h1 mix={raw({ margin: "0", display: "flex", flexDirection: "column" })}>
								<span mix={raw({ fontSize: "1rem", fontWeight: "600" })}>
									{account.name} · {account.currency}
								</span>
								<span
									data-slot="account-balance"
									mix={raw({
										fontFamily: SERIF,
										fontSize: "clamp(2.25rem, 1.8rem + 2vw, 3rem)",
										fontWeight: "600",
										letterSpacing: "-0.02em",
										lineHeight: "1.1",
									})}
								>
									<Money value={balance} currency={account.currency} smallMinor />
								</span>
							</h1>
						</div>
						{foreign ? (
							<dl
								mix={raw({
									margin: "0",
									display: "grid",
									gridTemplateColumns: "auto auto",
									gap: "0.25rem 1rem",
									fontSize: "0.875rem",
								})}
							>
								<dt mix={raw({ color: "var(--ui-neutral-fg-muted)" })}>In euros</dt>
								<dd mix={raw({ margin: "0", textAlign: "end", fontWeight: "600" })}>
									<Money value={toHome(balance, account.currency)} currency={HOME} />
								</dd>
								<dt mix={raw({ color: "var(--ui-neutral-fg-muted)" })}>Today's rate</dt>
								<dd
									mix={raw({ margin: "0", textAlign: "end", fontVariantNumeric: "tabular-nums" })}
								>
									{formatAmount(rateFrom * unit, account.currency, { locale: LOCALE })} ={" "}
									{formatAmount(Math.round(rateFrom * RATES[account.currency] * 100), HOME, {
										locale: LOCALE,
									})}
								</dd>
							</dl>
						) : null}
					</div>
					{foreign ? (
						<p
							mix={raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })}
						>
							The rate is invented for the demo and never changes.
						</p>
					) : null}
				</Panel>
				<Statement wallet={wallet} url={url} page={`accounts/${account.id}`} account={account.id} />
			</Screen>
		);
	};
}
