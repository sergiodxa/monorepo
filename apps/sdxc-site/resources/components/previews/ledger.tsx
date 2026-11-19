/**
 * Live preview for `Ledger`: two days of a statement, each headed by its net, with a
 * pending card payment, a split dinner, a transfer in and the open row marked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { Amount } from "@sdxc/ui/amount";
import { Ledger } from "@sdxc/ui/finance/ledger";

/** The source the page shows, matching the markup below. */
const CODE = `<Ledger>
	<Ledger.Day title="Today" total={<Amount value={-6140} currency="EUR" />}>
		<Ledger.Entry mark={<Mark letters="CL" />} title="Café Lumen" meta="Eating out · Pending"
			amount={<Amount value={-340} currency="EUR" sign="ledger" />} href="?tx=1" muted />
		<Ledger.Entry mark={<Mark letters="TR" />} title="Tasca do Ribeiro" meta="Eating out · Split 3 ways"
			amount={<Amount value={-5800} currency="EUR" sign="ledger" />}
			amountMeta={<>You: <Amount value={-1933} currency="EUR" /></>} href="?tx=2" current />
	</Ledger.Day>
	<Ledger.Day title="Yesterday">
		<Ledger.Entry mark={<Mark letters="AN" />} title="Atelier Norte" meta="Income"
			amount={<Amount value={210000} currency="EUR" sign="ledger" />} href="?tx=3" />
	</Ledger.Day>
</Ledger>`;

/** A merchant's letters on a tile of its hue, standing in for a logo. */
function Mark(handle: Handle<{ letters: string; hue: number }>) {
	return () => (
		<span
			aria-hidden="true"
			mix={raw({
				display: "grid",
				placeItems: "center",
				inlineSize: "2.5rem",
				blockSize: "2.5rem",
				borderRadius: "28%",
				fontSize: "0.875rem",
				fontWeight: "650",
				backgroundColor: `light-dark(oklch(0.92 0.05 ${handle.props.hue}), oklch(0.34 0.06 ${handle.props.hue}))`,
				color: `light-dark(oklch(0.38 0.1 ${handle.props.hue}), oklch(0.9 0.06 ${handle.props.hue}))`,
			})}
		>
			{handle.props.letters}
		</span>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={raw({ inlineSize: "100%", maxInlineSize: "28rem", marginBlock: "1.5rem" })}>
			<Ledger>
				<Ledger.Day title="Today" total={<Amount value={-6140} currency="EUR" />}>
					<Ledger.Entry
						mark={<Mark letters="CL" hue={55} />}
						title="Café Lumen"
						meta="Eating out · Pending"
						amount={<Amount value={-340} currency="EUR" sign="ledger" />}
						href="#tx-1"
						muted
					/>
					<Ledger.Entry
						mark={<Mark letters="TR" hue={25} />}
						title="Tasca do Ribeiro"
						meta="Eating out · Split 3 ways"
						amount={<Amount value={-5800} currency="EUR" sign="ledger" />}
						amountMeta={
							<>
								You: <Amount value={-1933} currency="EUR" />
							</>
						}
						href="#tx-2"
						current
					/>
				</Ledger.Day>
				<Ledger.Day title="Yesterday">
					<Ledger.Entry
						mark={<Mark letters="AN" hue={150} />}
						title="Atelier Norte"
						meta="Income"
						amount={<Amount value={210000} currency="EUR" sign="ledger" />}
						href="#tx-3"
					/>
				</Ledger.Day>
			</Ledger>
		</div>
	),
};
