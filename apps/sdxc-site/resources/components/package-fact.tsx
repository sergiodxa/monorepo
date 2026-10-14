/**
 * One labelled row of the facts a package page states above its README: a term and
 * the values under it, wrapping rather than scrolling, since a package with twelve
 * subpath exports is as ordinary as one with none.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { flexWrap, hstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";

namespace PackageFact {
	export interface Props {
		label: string;
		children: RemixNode;
	}
}

/** Renders one term and its values. */
export default function PackageFact(handle: Handle<PackageFact.Props>) {
	return () => {
		let { children, label } = handle.props;

		return (
			<div mix={[hstack({ gap: 3, align: "baseline" }), flexWrap()]}>
				<dt mix={[m(0), text("sm"), weight("semibold"), fg("neutral")]}>{label}</dt>
				<dd mix={[m(0), hstack({ gap: 2, align: "baseline" }), flexWrap()]}>{children}</dd>
			</div>
		);
	};
}
