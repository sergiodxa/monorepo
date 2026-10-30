/**
 * Live preview for `Bento`: an uptime product's three pillars as separate cards, the first
 * leading with a 45-day availability strip that fades into the card, the way a landing
 * opens its product tour.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { is } from "@sdxc/u/size";
import { HeadingScope } from "@sdxc/ui";
import { Bento } from "@sdxc/ui/patterns";

/** Days in the availability strip, one bar per day. */
const DAYS = Array.from({ length: 45 }, (_, day) => day);

/** Days the strip marks as an outage, so the chart reads like a real quarter. */
const OUTAGE_DAYS = new Set([12, 31]);

/** The source the page shows, matching the markup below. */
const CODE = `<Bento columns={3}>
	<Bento.Cell>
		<Bento.Media>
			<svg viewBox="0 0 360 140" role="img" aria-label="Availability over the last 45 days">
				{dailyBars}
			</svg>
		</Bento.Media>
		<Bento.Title size="lg">Monitors</Bento.Title>
		<Bento.Body>
			HTTP, TCP and DNS checks every thirty seconds from six regions, with
			<strong> response time per region</strong> beside up or down.
		</Bento.Body>
	</Bento.Cell>
	<Bento.Cell>
		<Bento.Title>Incidents</Bento.Title>
		<Bento.Body>
			An outage opens an incident, pages whoever holds the pager and
			<strong> closes itself</strong> once every region recovers.
		</Bento.Body>
	</Bento.Cell>
	<Bento.Cell>
		<Bento.Title>Status pages</Bento.Title>
		<Bento.Body>
			Publish live status on your own domain, with
			<strong> subscriber updates</strong> by email and RSS.
		</Bento.Body>
	</Bento.Cell>
</Bento>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<HeadingScope>
				<Bento columns={3}>
					<Bento.Cell>
						<Bento.Media>
							<svg viewBox="0 0 360 140" role="img" aria-label="Availability over the last 45 days">
								{DAYS.map((day) => (
									<rect
										x={day * 8}
										y={OUTAGE_DAYS.has(day) ? 64 : 24}
										width="5"
										height={OUTAGE_DAYS.has(day) ? 76 : 116}
										rx="2"
										fill="currentColor"
										mix={[fg(OUTAGE_DAYS.has(day) ? "danger" : "success")]}
									/>
								))}
							</svg>
						</Bento.Media>
						<Bento.Title size="lg">Monitors</Bento.Title>
						<Bento.Body>
							HTTP, TCP and DNS checks every thirty seconds from six regions, with
							<strong> response time per region</strong> beside up or down.
						</Bento.Body>
					</Bento.Cell>
					<Bento.Cell>
						<Bento.Title>Incidents</Bento.Title>
						<Bento.Body>
							An outage opens an incident, pages whoever holds the pager and
							<strong> closes itself</strong> once every region recovers.
						</Bento.Body>
					</Bento.Cell>
					<Bento.Cell>
						<Bento.Title>Status pages</Bento.Title>
						<Bento.Body>
							Publish live status on your own domain, with
							<strong> subscriber updates</strong> by email and RSS.
						</Bento.Body>
					</Bento.Cell>
				</Bento>
			</HeadingScope>
		</div>
	),
};
