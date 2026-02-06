import type { Meta, StoryObj } from "@storybook/react";

import { DialogTrigger } from "react-aria-components";

import { Button } from "./button";
import { Dialog } from "./dialog";
import { Popover } from "./popover";

const meta: Meta<typeof Popover> = {
	title: "Overlays/Popover",
	component: Popover,
	args: {
		placement: "bottom",
	},
	argTypes: {
		placement: {
			control: "select",
			options: [
				"top",
				"bottom",
				"left",
				"right",
				"top start",
				"top end",
				"bottom start",
				"bottom end",
			],
		},
	},
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
	render: (args) => (
		<DialogTrigger>
			<Button>Open Popover</Button>
			<Popover {...args}>
				<Dialog className="p-4">
					<p>This is popover content.</p>
				</Dialog>
			</Popover>
		</DialogTrigger>
	),
};

export const PlacementTop: Story = {
	render: () => (
		<div className="flex h-48 items-end justify-center">
			<DialogTrigger>
				<Button>Open Above</Button>
				<Popover placement="top">
					<Dialog className="p-4">
						<p>Popover on top</p>
					</Dialog>
				</Popover>
			</DialogTrigger>
		</div>
	),
};

export const PlacementBottom: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Open Below</Button>
			<Popover placement="bottom">
				<Dialog className="p-4">
					<p>Popover on bottom</p>
				</Dialog>
			</Popover>
		</DialogTrigger>
	),
};

export const PlacementLeft: Story = {
	render: () => (
		<div className="flex justify-end">
			<DialogTrigger>
				<Button>Open Left</Button>
				<Popover placement="left">
					<Dialog className="p-4">
						<p>Popover on left</p>
					</Dialog>
				</Popover>
			</DialogTrigger>
		</div>
	),
};

export const PlacementRight: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Open Right</Button>
			<Popover placement="right">
				<Dialog className="p-4">
					<p>Popover on right</p>
				</Dialog>
			</Popover>
		</DialogTrigger>
	),
};

export const AllPlacements: Story = {
	render: () => (
		<div className="flex flex-wrap items-center justify-center gap-4 p-16">
			<DialogTrigger>
				<Button>Top</Button>
				<Popover placement="top">
					<Dialog className="p-4">
						<p>Placement: top</p>
					</Dialog>
				</Popover>
			</DialogTrigger>

			<DialogTrigger>
				<Button>Bottom</Button>
				<Popover placement="bottom">
					<Dialog className="p-4">
						<p>Placement: bottom</p>
					</Dialog>
				</Popover>
			</DialogTrigger>

			<DialogTrigger>
				<Button>Left</Button>
				<Popover placement="left">
					<Dialog className="p-4">
						<p>Placement: left</p>
					</Dialog>
				</Popover>
			</DialogTrigger>

			<DialogTrigger>
				<Button>Right</Button>
				<Popover placement="right">
					<Dialog className="p-4">
						<p>Placement: right</p>
					</Dialog>
				</Popover>
			</DialogTrigger>
		</div>
	),
};

export const WithForm: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Edit Settings</Button>
			<Popover placement="bottom start">
				<Dialog className="flex w-64 flex-col gap-4 p-4">
					<h3 className="font-semibold">Settings</h3>
					<label className="flex flex-col gap-1">
						<span className="text-sm">Name</span>
						<input type="text" className="rounded border px-2 py-1" placeholder="Enter name" />
					</label>
					<label className="flex flex-col gap-1">
						<span className="text-sm">Email</span>
						<input type="email" className="rounded border px-2 py-1" placeholder="Enter email" />
					</label>
					<Button size="sm">Save</Button>
				</Dialog>
			</Popover>
		</DialogTrigger>
	),
};
