import type { Meta, StoryObj } from "@storybook/react";

import { Heading } from "react-aria-components";

import { Button } from "./button";
import { Dialog, DialogTrigger } from "./dialog";
import { Modal } from "./modal";

const meta: Meta<typeof Modal> = {
	title: "Overlays/Modal",
	component: Modal,
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const Default: Story = {
	render: (args) => (
		<DialogTrigger>
			<Button>Open Modal</Button>
			<Modal.Overlay>
				<Modal {...args}>
					<Dialog className="p-6">
						<Heading slot="title" className="mb-4 text-xl font-semibold">
							Modal Title
						</Heading>
						<p className="mb-4">This is a modal dialog. Click outside or press Escape to close.</p>
						<div className="flex justify-end">
							<Button slot="close">Close</Button>
						</div>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};

export const Dismissable: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Open Dismissable Modal</Button>
			<Modal.Overlay isDismissable>
				<Modal>
					<Dialog className="p-6">
						<Heading slot="title" className="mb-4 text-xl font-semibold">
							Dismissable Modal
						</Heading>
						<p className="mb-4">
							This modal can be dismissed by clicking outside of it or pressing Escape.
						</p>
						<div className="flex justify-end">
							<Button slot="close">Close</Button>
						</div>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};

export const NonDismissable: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Open Non-Dismissable Modal</Button>
			<Modal.Overlay isDismissable={false}>
				<Modal>
					<Dialog className="p-6">
						<Heading slot="title" className="mb-4 text-xl font-semibold">
							Non-Dismissable Modal
						</Heading>
						<p className="mb-4">
							This modal cannot be dismissed by clicking outside. You must use the close button.
						</p>
						<div className="flex justify-end">
							<Button slot="close">Close</Button>
						</div>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};

export const WithKeyboardDismissDisabled: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Open Modal (No Escape)</Button>
			<Modal.Overlay isKeyboardDismissDisabled>
				<Modal>
					<Dialog className="p-6">
						<Heading slot="title" className="mb-4 text-xl font-semibold">
							Keyboard Dismiss Disabled
						</Heading>
						<p className="mb-4">
							This modal cannot be closed with the Escape key. Use the button to close.
						</p>
						<div className="flex justify-end">
							<Button slot="close">Close</Button>
						</div>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};

export const SmallModal: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Open Small Modal</Button>
			<Modal.Overlay isDismissable>
				<Modal className="w-72">
					<Dialog className="p-4">
						<Heading slot="title" className="mb-2 text-lg font-semibold">
							Quick Action
						</Heading>
						<p className="mb-4 text-sm">Are you sure?</p>
						<div className="flex justify-end gap-2">
							<Button size="sm" variant="outline" slot="close">
								No
							</Button>
							<Button size="sm" slot="close">
								Yes
							</Button>
						</div>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};

export const LargeModal: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Open Large Modal</Button>
			<Modal.Overlay isDismissable>
				<Modal className="w-[48rem] max-w-[90vw]">
					<Dialog className="p-8">
						<Heading slot="title" className="mb-6 text-2xl font-semibold">
							Large Modal
						</Heading>
						<div className="mb-6 grid grid-cols-2 gap-6">
							<div className="rounded border p-4">
								<h3 className="mb-2 font-medium">Section 1</h3>
								<p className="text-sm">Content for the first section goes here.</p>
							</div>
							<div className="rounded border p-4">
								<h3 className="mb-2 font-medium">Section 2</h3>
								<p className="text-sm">Content for the second section goes here.</p>
							</div>
							<div className="rounded border p-4">
								<h3 className="mb-2 font-medium">Section 3</h3>
								<p className="text-sm">Content for the third section goes here.</p>
							</div>
							<div className="rounded border p-4">
								<h3 className="mb-2 font-medium">Section 4</h3>
								<p className="text-sm">Content for the fourth section goes here.</p>
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<Button variant="outline" slot="close">
								Cancel
							</Button>
							<Button slot="close">Save</Button>
						</div>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};

export const FullscreenModal: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Open Fullscreen Modal</Button>
			<Modal.Overlay isDismissable>
				<Modal className="h-[90vh] w-[90vw]">
					<Dialog className="flex h-full flex-col p-6">
						<Heading slot="title" className="mb-4 text-xl font-semibold">
							Fullscreen Modal
						</Heading>
						<div className="flex-1 overflow-auto rounded border p-4">
							<p>This modal takes up most of the screen. Good for complex workflows.</p>
						</div>
						<div className="mt-4 flex justify-end gap-2">
							<Button variant="outline" slot="close">
								Cancel
							</Button>
							<Button slot="close">Done</Button>
						</div>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};
