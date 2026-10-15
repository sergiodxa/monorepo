/**
 * The opening `vars` example: a progress bar whose fill reads its width from a custom
 * property the track sets, so the value lives in one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import * as u from "sdxc/u/general";
import { bs, is, maxIs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Progress bars filled from a custom property set on each track. */
export default {
	title: "Basic example",
	description:
		"Use `vars({...})` to set custom properties on an element, written without the leading `--`, for its children to read with `u.var()`:",
	align: "stretch",
	render: () => (
		<div mix={[maxIs(96), demo.stack()]}>
			<div mix={[u.vars({ progress: "35%" }), bs(2), rounded("full"), bg("neutral.border")]}>
				<div mix={[is(u.var("progress")), bs(2), rounded("full"), bg("brand.solid")]} />
			</div>
			<div mix={[u.vars({ progress: "80%" }), bs(2), rounded("full"), bg("neutral.border")]}>
				<div mix={[is(u.var("progress")), bs(2), rounded("full"), bg("brand.solid")]} />
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
