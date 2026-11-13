/**
 * Live preview for `Countdown`: a conference's doors three ways, the time left as the server
 * renders it from a fixed `now`, the same countdown ticking from the reader's clock through its
 * island, and a countdown whose moment has passed reading its done text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Countdown } from "@sdxc/ui/landing";
import { css } from "remix/component";

/** When the doors open, the moment every countdown below counts toward. */
const DOORS = "2027-04-15T06:30:00Z";

/** The source the page shows, matching the markup below. */
const CODE = `<Countdown to="${DOORS}" now="2027-01-01T09:00:00Z" done="Doors are open" />

<div style="--ui-countdown-value-size: 2.5rem; --ui-countdown-value-color: var(--ui-brand-fg)">
	<Countdown to="${DOORS}" done="Doors are open" aria-label="Time left until the doors open" live />
</div>

<Countdown to="2026-04-16T06:30:00Z" done="Doors are open" />`;

/** What the preview registry reads: the source to show, and the three countdowns to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={css({
				display: "grid",
				gap: "1.5rem",
				justifyItems: "start",
				"& p": {
					margin: "0 0 0.25rem",
					fontSize: "0.8125rem",
					color: "var(--ui-neutral-fg-muted)",
				},
			})}
		>
			<div>
				<p>Rendered from a fixed now</p>
				<Countdown to={DOORS} now="2027-01-01T09:00:00Z" done="Doors are open" />
			</div>
			<div
				mix={css({
					"--ui-countdown-value-size": "2.5rem",
					"--ui-countdown-value-color": "var(--ui-brand-fg)",
				})}
			>
				<p>Ticking from your clock</p>
				<Countdown
					to={DOORS}
					done="Doors are open"
					aria-label="Time left until the doors open"
					live
				/>
			</div>
			<div>
				<p>After the moment</p>
				<Countdown to="2026-04-16T06:30:00Z" done="Doors are open" />
			</div>
		</div>
	),
};
