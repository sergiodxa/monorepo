/**
 * One statement row as every Tuppence list draws it: the merchant's mark, its name, the
 * category with any pending, split or note mark, and the amount in its own currency with
 * the visitor's share or the euro worth under it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { StickyNoteIcon } from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { raw } from "@sdxc/u/general";
import { Ledger } from "@sdxc/ui/app/ledger";

import type { Entry } from "./state";

import { HOME, findAccount, findCategory, findMerchant, toHome } from "./data";
import { MerchantMark, Money } from "./parts";

namespace EntryRow {
	export interface Props {
		entry: Entry;
		/** Where the row leads: the transaction's detail. */
		link: string;
		/** Marks the row whose detail is open. */
		current?: boolean;
	}
}

/** The quiet line under a merchant: category, then pending, split and a note mark. */
function metaLine(entry: Entry): string {
	let parts = [findCategory(entry.category)?.name ?? entry.category];
	if (entry.pending) parts.push("Pending");
	if (entry.split !== undefined) parts.push(`Split ${entry.split} ways`);
	if (entry.reference !== undefined && entry.category === "transfers") parts.push(entry.reference);
	return parts.join(" · ");
}

/** Renders one movement as a ledger row. */
export function EntryRow(handle: Handle<EntryRow.Props>) {
	return () => {
		let { entry, link, current } = handle.props;
		let merchant = findMerchant(entry.merchant);
		let currency = findAccount(entry.account)?.currency ?? HOME;
		let under = iife(() => {
			if (entry.split !== undefined)
				return (
					<>
						You: <Money value={-entry.share} currency={currency} />
					</>
				);
			if (currency !== HOME)
				return (
					<>
						≈ <Money value={toHome(entry.amount, currency)} currency={HOME} sign="never" />
					</>
				);
			return undefined;
		});
		return (
			<Ledger.Entry
				id={`tx-${entry.id}`}
				mark={<MerchantMark merchant={merchant} />}
				title={merchant?.name ?? entry.merchant}
				meta={
					<>
						{metaLine(entry)}
						{entry.note === undefined ? null : (
							<StickyNoteIcon
								size={12}
								aria-label="Has a note"
								mix={raw({ marginInlineStart: "0.375rem", verticalAlign: "-0.1em" })}
							/>
						)}
					</>
				}
				amount={<Money value={entry.amount} currency={currency} sign="ledger" />}
				amountMeta={under}
				href={link}
				current={current}
				muted={entry.pending}
			/>
		);
	};
}
