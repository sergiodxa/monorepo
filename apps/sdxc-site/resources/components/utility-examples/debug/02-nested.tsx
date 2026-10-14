/**
 * A `debug` example in nested mode, which outlines every descendant too, so a reader
 * sees the whole box model of a layout at once. Drawn as a development build draws it,
 * since the site's production build resolves the call to no styles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A row and each of its items outlined the way a development build outlines them. */
export default {
	title: "Outlining descendants",
	description:
		"Pass `nested` to outline every descendant as well, to see how each box of a layout sits, shown here as a development build draws it:",
	code: `<div mix={[debug("nested"), ...]}>
	<div mix={[...]}>One</div>
	<div mix={[...]}>Two</div>
	<div mix={[...]}>Three</div>
</div>`,
	render: () => (
		<div mix={[demo.row(), demo.debugOutline(true)]}>
			<div mix={[demo.block()]}>One</div>
			<div mix={[demo.block()]}>Two</div>
			<div mix={[demo.block()]}>Three</div>
		</div>
	),
} satisfies UtilityExampleModule;
