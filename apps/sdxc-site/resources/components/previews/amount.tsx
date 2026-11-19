/**
 * Live preview for `Amount`: a balance with smaller cents, a statement's money in and out,
 * yen with no decimals, and the same euros in German and compact notation, each drawn from
 * integer minor units.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { Amount } from "@sdxc/ui/amount";

/** The source the page shows, matching the markup below. */
const CODE = `<Amount value={1284056} currency="EUR" locale="en-IE" smallMinor />
<Amount value={210000} currency="EUR" sign="ledger" />
<Amount value={-2340} currency="EUR" sign="ledger" />
<Amount value={84500} currency="JPY" />
<Amount value={129950} currency="EUR" locale="de-DE" />
<Amount value={1250000} currency="USD" compact />`;

/** One labelled row of the preview. */
function Row(handle: Handle<{ label: string; children: JSX.Element }>) {
	return () => (
		<div
			mix={raw({
				display: "flex",
				justifyContent: "space-between",
				gap: "1.5rem",
				paddingBlock: "0.5rem",
				borderBlockEnd: "1px solid var(--ui-neutral-border)",
			})}
		>
			<span mix={raw({ color: "var(--ui-neutral-fg-muted)", fontSize: "0.875rem" })}>
				{handle.props.label}
			</span>
			{handle.props.children}
		</div>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={raw({ inlineSize: "100%", maxInlineSize: "24rem", marginBlock: "1.5rem" })}>
			<p mix={raw({ margin: "0 0 0.75rem", fontSize: "2.5rem", fontWeight: "600" })}>
				<Amount value={1284056} currency="EUR" locale="en-IE" smallMinor />
			</p>
			<Row label="Money in">
				<Amount value={210000} currency="EUR" sign="ledger" />
			</Row>
			<Row label="Money out">
				<Amount value={-2340} currency="EUR" sign="ledger" />
			</Row>
			<Row label="Yen">
				<Amount value={84500} currency="JPY" />
			</Row>
			<Row label="German">
				<Amount value={129950} currency="EUR" locale="de-DE" />
			</Row>
			<Row label="Compact">
				<Amount value={1250000} currency="USD" compact />
			</Row>
		</div>
	),
};
