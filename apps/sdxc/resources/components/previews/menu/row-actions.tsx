/**
 * Live example for `Menu` as a table row's action menu. The grouped links navigate, and the
 * destructive row opens a confirmation `Modal` through `commandfor`/`command="show-modal"`,
 * so opening the menu and reaching the confirmation are the platform's with no script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { EllipsisIcon } from "@sdxc/icons";
import { Button, Header, Menu, Modal, Section } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Button
	commandfor="row-menu"
	command="toggle-popover"
	variant="ghost"
	color="neutral"
	aria-label="Actions for Q3 roadmap"
>
	<EllipsisIcon />
</Button>

<Menu id="row-menu" placement="left-start" aria-label="Project actions">
	<Section aria-labelledby="row-menu-view-heading">
		<Header id="row-menu-view-heading">View</Header>
		<Menu.Item href="/projects/q3-roadmap">Open project</Menu.Item>
		<Menu.Item href="/projects/q3-roadmap/edit">Edit details</Menu.Item>
	</Section>
	<Menu.Separator />
	<Menu.Item danger commandfor="confirm-delete" command="show-modal">
		Delete project
	</Menu.Item>
</Menu>

<Modal id="confirm-delete" aria-labelledby="confirm-delete-title">
	<Modal.Header>
		<Modal.Title id="confirm-delete-title">Delete Q3 roadmap?</Modal.Title>
		<Modal.Description>Its issues and comments are removed for everyone at Acme.</Modal.Description>
	</Modal.Header>
	<Modal.Footer>
		<Button commandfor="confirm-delete" command="close" variant="outline" color="neutral">
			Cancel
		</Button>
		<Button commandfor="confirm-delete" command="close" color="danger">
			Delete project
		</Button>
	</Modal.Footer>
</Modal>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Row actions",
	code: CODE,
	render: () => (
		<>
			<Button
				commandfor="example-menu-row-actions"
				command="toggle-popover"
				variant="ghost"
				color="neutral"
				aria-label="Actions for Q3 roadmap"
			>
				<EllipsisIcon />
			</Button>

			<Menu id="example-menu-row-actions" placement="left-start" aria-label="Project actions">
				<Section aria-labelledby="example-menu-row-actions-view-heading">
					<Header id="example-menu-row-actions-view-heading">View</Header>
					<Menu.Item href="/projects/q3-roadmap">Open project</Menu.Item>
					<Menu.Item href="/projects/q3-roadmap/edit">Edit details</Menu.Item>
				</Section>
				<Menu.Separator />
				<Menu.Item danger commandfor="example-menu-row-actions-confirm" command="show-modal">
					Delete project
				</Menu.Item>
			</Menu>

			<Modal
				id="example-menu-row-actions-confirm"
				aria-labelledby="example-menu-row-actions-confirm-title"
			>
				<Modal.Header>
					<Modal.Title id="example-menu-row-actions-confirm-title">Delete Q3 roadmap?</Modal.Title>
					<Modal.Description>
						Its issues and comments are removed for everyone at Acme.
					</Modal.Description>
				</Modal.Header>
				<Modal.Footer>
					<Button
						commandfor="example-menu-row-actions-confirm"
						command="close"
						variant="outline"
						color="neutral"
					>
						Cancel
					</Button>
					<Button commandfor="example-menu-row-actions-confirm" command="close" color="danger">
						Delete project
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	),
};
