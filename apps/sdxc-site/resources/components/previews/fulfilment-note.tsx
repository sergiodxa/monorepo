/**
 * Live preview for `FulfilmentNote`: the three ways an order reaches its buyer, a download, a
 * parcel and a pickup, each a quiet icon and line under a price.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { FulfilmentNote } from "@sdxc/ui/commerce/fulfilment-note";

/** The source the page shows. */
const CODE = `<FulfilmentNote kind="download">Instant download · PDF, 300 dpi</FulfilmentNote>
<FulfilmentNote kind="ships">Ships in 3–5 days, rolled in a tube</FulfilmentNote>
<FulfilmentNote kind="pickup">Pick up at the Leeds studio</FulfilmentNote>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ display: "grid", gap: "0.75rem", justifyItems: "start" })]}>
			<FulfilmentNote kind="download">Instant download · PDF, 300 dpi</FulfilmentNote>
			<FulfilmentNote kind="ships">Ships in 3–5 days, rolled in a tube</FulfilmentNote>
			<FulfilmentNote kind="pickup">Pick up at the Leeds studio</FulfilmentNote>
		</div>
	),
};
