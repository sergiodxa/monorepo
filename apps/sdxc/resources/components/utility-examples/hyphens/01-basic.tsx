/**
 * The opening `hyphens` example: a narrow column of English text full of long words hyphenated from the
 * browser's dictionary, which it picks from the `lang` attribute.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "@sdxc/u/size";
import { hyphens } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A narrow paragraph hyphenated automatically, beside the same paragraph left unhyphenated. */
export default {
	title: "Basic example",
	description:
		"Use `hyphens()` to let the browser hyphenate long words from its dictionary, chosen by the `lang` attribute on the element or an ancestor:",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[maxIs(48), demo.panel()]}>
				<p mix={[demo.caption()]}>hyphens()</p>
				<p lang="en" mix={[hyphens()]}>
					The committee's recommendations on intergovernmental telecommunications infrastructure
					were characteristically uncompromising.
				</p>
			</div>
			<div mix={[maxIs(48), demo.panel()]}>
				<p mix={[demo.caption()]}>hyphens("none")</p>
				<p lang="en" mix={[hyphens("none")]}>
					The committee's recommendations on intergovernmental telecommunications infrastructure
					were characteristically uncompromising.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
