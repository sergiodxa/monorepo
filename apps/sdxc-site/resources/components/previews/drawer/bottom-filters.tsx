/**
 * Live example for `Drawer` docked to the bottom edge, where a filters panel sits on a
 * phone. Showing and dismissing it are Invoker Commands on the native `<dialog>`, and the
 * footer's apply button closes it the same way, so the example is plain markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ListFilterIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { Button, Checkbox, Drawer } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Button commandfor="filters" command="show-modal" variant="outline">
	<ListFilterIcon />
	Filters
</Button>

<Drawer id="filters" placement="bottom" aria-labelledby="filters-title">
	<Drawer.Header>
		<Drawer.Title id="filters-title">Filter issues</Drawer.Title>
		<Drawer.Description>Show only the issues that match every choice.</Drawer.Description>
	</Drawer.Header>
	<div mix={[vstack({ gap: 3, align: "start" })]}>
		<Checkbox name="assigned" defaultChecked>Assigned to me</Checkbox>
		<Checkbox name="open">Open only</Checkbox>
		<Checkbox name="priority">High priority</Checkbox>
	</div>
	<Drawer.Footer>
		<Button commandfor="filters" command="close">Apply filters</Button>
	</Drawer.Footer>
</Drawer>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Bottom filters",
	code: CODE,
	render: () => (
		<>
			<Button commandfor="example-drawer-bottom-filters" command="show-modal" variant="outline">
				<ListFilterIcon />
				Filters
			</Button>

			<Drawer
				id="example-drawer-bottom-filters"
				placement="bottom"
				aria-labelledby="example-drawer-bottom-filters-title"
			>
				<Drawer.Header>
					<Drawer.Title id="example-drawer-bottom-filters-title">Filter issues</Drawer.Title>
					<Drawer.Description>Show only the issues that match every choice.</Drawer.Description>
				</Drawer.Header>
				<div mix={[vstack({ gap: 3, align: "start" })]}>
					<Checkbox name="assigned" defaultChecked>
						Assigned to me
					</Checkbox>
					<Checkbox name="open">Open only</Checkbox>
					<Checkbox name="priority">High priority</Checkbox>
				</div>
				<Drawer.Footer>
					<Button commandfor="example-drawer-bottom-filters" command="close">
						Apply filters
					</Button>
				</Drawer.Footer>
			</Drawer>
		</>
	),
};
