/**
 * Live preview for `Price`: a poster's price on its own, on sale with the earlier price
 * struck through and the saving tagged, and a starting price split into instalments.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Price } from "@sdxc/ui/commerce/price";

/** The source the page shows. */
const CODE = `<Price amount={4500} currency="USD" />
<Price amount={3600} currency="USD" compareAt={4500} size="lg" />
<Price amount={2900} currency="USD" from installments={4} />`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ display: "grid", gap: "1rem", paddingBlock: "1rem" })]}>
			<Price amount={4500} currency="USD" />
			<Price amount={3600} currency="USD" compareAt={4500} size="lg" />
			<Price amount={2900} currency="USD" from installments={4} />
		</div>
	),
};
