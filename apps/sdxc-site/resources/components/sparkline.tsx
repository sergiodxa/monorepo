/**
 * A small unlabelled line, the shape of a series at a glance in a table row. Drawn with the
 * `@sdxc/ui` chart, scaled from zero to the series' own peak, so two rows compare by shape
 * rather than by height.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { overflow } from "@sdxc/u/overflow";
import { is } from "@sdxc/u/size";
import { Chart } from "@sdxc/ui";

namespace Sparkline {
	export interface Props {
		/** What the line shows, for assistive technology. */
		label: string;
		values: number[];
	}
}

/** Renders the line. */
export default function Sparkline(handle: Handle<Sparkline.Props>) {
	return () => {
		let { label, values } = handle.props;

		return (
			<Chart
				width={96}
				height={24}
				xDomain={[0, Math.max(1, values.length - 1)]}
				yDomain={[0, Math.max(1, ...values)]}
				aria-label={label}
				role="img"
				mix={[is(24), overflow("visible")]}
			>
				<Chart.Line
					color={1}
					markerCount={0}
					points={values.map((value, index) => ({ x: index, y: value, label: String(value) }))}
				/>
			</Chart>
		);
	};
}
