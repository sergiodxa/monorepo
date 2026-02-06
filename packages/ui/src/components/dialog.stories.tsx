import type { Meta, StoryObj } from "@storybook/react";

import { Heading } from "react-aria-components";

import { Button } from "./button";
import { Dialog, DialogTrigger } from "./dialog";
import { Modal } from "./modal";

const meta: Meta<typeof Dialog> = {
	title: "Overlays/Dialog",
	component: Dialog,
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
	render: (args) => (
		<DialogTrigger>
			<Button>Open Dialog</Button>
			<Modal.Overlay>
				<Modal>
					<Dialog {...args} className="p-6">
						<Heading slot="title" className="mb-4 text-xl font-semibold">
							Dialog Title
						</Heading>
						<p className="mb-4">This is the dialog content. You can put any content here.</p>
						<div className="flex justify-end gap-2">
							<Button variant="outline" slot="close">
								Cancel
							</Button>
							<Button slot="close">Confirm</Button>
						</div>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};

export const AlertDialog: Story = {
	render: () => (
		<DialogTrigger>
			<Button color="danger">Delete Item</Button>
			<Modal.Overlay>
				<Modal>
					<Dialog role="alertdialog" className="p-6">
						<Heading slot="title" className="mb-4 text-xl font-semibold">
							Delete Item
						</Heading>
						<p className="mb-4">
							Are you sure you want to delete this item? This action cannot be undone.
						</p>
						<div className="flex justify-end gap-2">
							<Button variant="outline" slot="close">
								Cancel
							</Button>
							<Button color="danger" slot="close">
								Delete
							</Button>
						</div>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};

export const WithForm: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Edit Profile</Button>
			<Modal.Overlay>
				<Modal>
					<Dialog className="w-96 p-6">
						<Heading slot="title" className="mb-4 text-xl font-semibold">
							Edit Profile
						</Heading>
						<form className="flex flex-col gap-4">
							<label className="flex flex-col gap-1">
								<span className="text-sm font-medium">Name</span>
								<input
									type="text"
									className="rounded border px-3 py-2"
									placeholder="Enter your name"
								/>
							</label>
							<label className="flex flex-col gap-1">
								<span className="text-sm font-medium">Email</span>
								<input
									type="email"
									className="rounded border px-3 py-2"
									placeholder="Enter your email"
								/>
							</label>
							<label className="flex flex-col gap-1">
								<span className="text-sm font-medium">Bio</span>
								<textarea
									className="rounded border px-3 py-2"
									rows={3}
									placeholder="Tell us about yourself"
								/>
							</label>
							<div className="flex justify-end gap-2">
								<Button variant="outline" slot="close">
									Cancel
								</Button>
								<Button type="submit">Save Changes</Button>
							</div>
						</form>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};

export const LongContent: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Terms and Conditions</Button>
			<Modal.Overlay>
				<Modal>
					<Dialog className="max-h-[80vh] w-full max-w-md overflow-y-auto p-6">
						<Heading slot="title" className="mb-4 text-xl font-semibold">
							Terms and Conditions
						</Heading>
						<div className="mb-4 space-y-4 text-sm">
							<p>
								Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
								incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
								exercitation ullamco laboris.
							</p>
							<p>
								Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
								fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.
							</p>
							<p>
								Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
								doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore
								veritatis.
							</p>
							<p>
								Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia
								consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
							</p>
							<p>
								Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur,
								adipisci velit, sed quia non numquam eius modi tempora incidunt.
							</p>
							<p>
								Ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam,
								quis nostrum exercitationem ullam corporis suscipit laboriosam.
							</p>
						</div>
						<div className="flex justify-end gap-2">
							<Button variant="outline" slot="close">
								Decline
							</Button>
							<Button slot="close">Accept</Button>
						</div>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};

export const ConfirmationDialog: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Submit Order</Button>
			<Modal.Overlay>
				<Modal>
					<Dialog className="p-6">
						<Heading slot="title" className="mb-4 text-xl font-semibold">
							Confirm Order
						</Heading>
						<p className="mb-4">You are about to submit an order for $99.99. Continue?</p>
						<div className="flex justify-end gap-2">
							<Button variant="outline" slot="close">
								Go Back
							</Button>
							<Button slot="close">Place Order</Button>
						</div>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};
