/**
 * One `@sdxc/u` example: the canvas it draws on and, joined under it, the code that drew
 * it. The code stays open rather than behind a toggle, because for a utility the call is
 * the lesson and the drawing is its proof.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { bg, border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { vstack } from "@sdxc/u/layout";
import { overflowX } from "@sdxc/u/overflow";
import { is, minBs, p } from "@sdxc/u/size";

import Snippet from "~/resources/components/snippet";

namespace UtilityExample {
	export interface Props {
		/** The example as it renders. */
		children: RemixNode;
		/** The markup that drew it, printed under the canvas. */
		code: string;
		/**
		 * Centres the example on the canvas, or stretches it across the canvas's width.
		 * @default "center"
		 */
		align?: "center" | "stretch";
	}
}

/** Renders one example above its code. */
export default function UtilityExample(handle: Handle<UtilityExample.Props>) {
	return () => {
		let { children, code, align = "center" } = handle.props;

		return (
			<div mix={[vstack({ gap: 2, align: "stretch" })]}>
				<div
					mix={[
						vstack({ gap: 4, align, justify: "center" }),
						is("100%"),
						minBs("8rem"),
						p(8),
						overflowX("auto"),
						rounded("lg"),
						bg(),
						border({ color: "neutral.border", width: 1, style: "solid" }),
					]}
				>
					{children}
				</div>
				<Snippet code={code} />
			</div>
		);
	};
}
