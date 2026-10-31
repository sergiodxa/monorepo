/**
 * A period-over-period change as a signed percentage, green when it grew and red when it
 * shrank. A period with nothing before it reads "new" when it has downloads and a dash when
 * it has none, since a percentage over zero would be infinite.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { iife } from "@sdxc/iife";
import { fg } from "@sdxc/u/color";
import { tabularNums } from "@sdxc/u/typography";

/** How a change reads: always signed, so a flat week and a small gain look different. */
const PERCENT_FORMAT = new Intl.NumberFormat("en-US", {
	style: "percent",
	maximumFractionDigits: 0,
	signDisplay: "exceptZero",
});

namespace Change {
	export interface Props {
		/** The change as a fraction, or `null` when the period before had nothing. */
		value: number | null;
		/** The current period's count, which tells "new" apart from "nothing". */
		current: number;
	}
}

/** Renders the change, coloured by direction. */
export default function Change(handle: Handle<Change.Props>) {
	return () => {
		let { current, value } = handle.props;
		if (value === null) {
			return <span mix={fg("neutral.muted")}>{current > 0 ? "new" : "—"}</span>;
		}

		let tone = iife(() => {
			if (value > 0) return "success";
			if (value < 0) return "danger";
			return "neutral.muted";
		});
		return <span mix={[fg(tone), tabularNums()]}>{PERCENT_FORMAT.format(value)}</span>;
	};
}
