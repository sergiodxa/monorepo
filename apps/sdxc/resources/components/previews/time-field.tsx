/**
 * Live preview island for `TimeField`. A time on its own says little, so the example
 * is the shift form two of them appear in: both bounded to the hours the rota allows,
 * stepped in quarter hours, one described and one carrying the message the submission
 * came back with. An app hands `errorMessage` whatever its `parseSafe` result reported
 * for that field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Button, Card, TimeField } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** Quarter-hour steps, in seconds, which is the granularity the rota is planned at. */
const QUARTER_HOUR = 900;

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const TIME_FIELD_CODE = `<form
	method="post"
	action="/rota"
	mix={[on<HTMLFormElement, "submit">("submit", (event) => event.preventDefault())]}
>
	<Card>
		<Card.Header>
			<Card.Title>Thursday 24 September</Card.Title>
			<Card.Description>Front desk · Ana Ruiz</Card.Description>
		</Card.Header>
		<Card.Content mix={[vstack({ gap: 4, align: "stretch" })]}>
			<TimeField
				label="Shift starts"
				name="startTime"
				required
				min="09:00"
				max="17:00"
				step={900}
				defaultValue="09:30"
				description="Between 09:00 and 17:00, in quarter-hour steps."
			/>

			<TimeField
				label="Shift ends"
				name="endTime"
				required
				min="09:00"
				max="17:00"
				step={900}
				defaultValue="09:00"
				errorMessage={issues.endTime}
			/>
		</Card.Content>
		<Card.Footer mix={[hstack({ gap: 2, align: "center", justify: "end" })]}>
			<Button type="submit">Save the shift</Button>
		</Card.Footer>
	</Card>
</form>`;

/** A rota form step with two bounded time fields, hydrated with the page. */
export const TimeFieldPreview = clientEntry(
	"/resources/components/previews/time-field.tsx#TimeFieldPreview",
	function TimeFieldPreview() {
		return () => (
			<form
				method="post"
				action="/rota"
				mix={[
					is("26rem"),
					// A docs page has nowhere to post to, so the submission stops here instead
					// of navigating away from the example.
					on<HTMLFormElement, "submit">("submit", (event) => event.preventDefault()),
				]}
			>
				<Card>
					<Card.Header>
						<Card.Title>Thursday 24 September</Card.Title>
						<Card.Description>Front desk · Ana Ruiz</Card.Description>
					</Card.Header>
					<Card.Content mix={[vstack({ gap: 4, align: "stretch" })]}>
						<TimeField
							label="Shift starts"
							name="startTime"
							required
							min="09:00"
							max="17:00"
							step={QUARTER_HOUR}
							defaultValue="09:30"
							description="Between 09:00 and 17:00, in quarter-hour steps."
						/>

						<TimeField
							label="Shift ends"
							name="endTime"
							required
							min="09:00"
							max="17:00"
							step={QUARTER_HOUR}
							defaultValue="09:00"
							errorMessage="The shift ends before it starts."
						/>
					</Card.Content>
					<Card.Footer mix={[hstack({ gap: 2, align: "center", justify: "end" })]}>
						<Button type="submit">Save the shift</Button>
					</Card.Footer>
				</Card>
			</form>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TIME_FIELD_CODE, render: () => <TimeFieldPreview /> };
