/**
 * Live example for `Sheet` sliding in from the left edge, where navigation and filters
 * usually live. The panel opens and closes through Invoker Commands on the native
 * `<dialog>`, so the example is plain markup with no island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { SlidersHorizontalIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { Button, Checkbox, Sheet } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Button commandfor="filters" command="show-modal" variant="outline">
	<SlidersHorizontalIcon />
	Filters
</Button>

<Sheet id="filters" side="left" aria-labelledby="filters-title">
	<Sheet.Header>
		<Sheet.Title id="filters-title">Filter monitors</Sheet.Title>
		<Sheet.Description>Narrow the list to the checks you care about.</Sheet.Description>
	</Sheet.Header>
	<div mix={[vstack({ gap: 3, align: "start" })]}>
		<Checkbox name="down" defaultChecked>Down right now</Checkbox>
		<Checkbox name="degraded">Degraded</Checkbox>
		<Checkbox name="paused">Paused</Checkbox>
	</div>
	<Sheet.Close commandfor="filters" aria-label="Close" />
</Sheet>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Left side",
	code: CODE,
	render: () => (
		<>
			<Button commandfor="example-sheet-left-side" command="show-modal" variant="outline">
				<SlidersHorizontalIcon />
				Filters
			</Button>

			<Sheet
				id="example-sheet-left-side"
				side="left"
				aria-labelledby="example-sheet-left-side-title"
			>
				<Sheet.Header>
					<Sheet.Title id="example-sheet-left-side-title">Filter monitors</Sheet.Title>
					<Sheet.Description>Narrow the list to the checks you care about.</Sheet.Description>
				</Sheet.Header>
				<div mix={[vstack({ gap: 3, align: "start" })]}>
					<Checkbox name="down" defaultChecked>
						Down right now
					</Checkbox>
					<Checkbox name="degraded">Degraded</Checkbox>
					<Checkbox name="paused">Paused</Checkbox>
				</div>
				<Sheet.Close commandfor="example-sheet-left-side" aria-label="Close" />
			</Sheet>
		</>
	),
};
