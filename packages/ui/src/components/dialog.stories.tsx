import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { Dialog, DialogTrigger } from "./dialog";
import { Input } from "./input";
import { Label } from "./label";
import { Modal } from "./modal";
import { TextField } from "./text-field";
import { TextArea } from "./textarea";

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
					<Dialog {...args}>
						<Dialog.Header>
							<Dialog.Title>Dialog Title</Dialog.Title>
							<Dialog.Description>
								This is the dialog description. You can put any content here.
							</Dialog.Description>
						</Dialog.Header>
						<p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
							This is the dialog content. You can put any content here.
						</p>
						<Dialog.Footer>
							<Button variant="outline" color="neutral" slot="close">
								Cancel
							</Button>
							<Button slot="close">Confirm</Button>
						</Dialog.Footer>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};

export const WithCloseButton: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Open Dialog</Button>
			<Modal.Overlay>
				<Modal>
					<Dialog>
						<Dialog.Close />
						<Dialog.Header>
							<Dialog.Title>Settings</Dialog.Title>
							<Dialog.Description>Manage your account settings and preferences.</Dialog.Description>
						</Dialog.Header>
						<p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
							Your settings content goes here.
						</p>
						<Dialog.Footer>
							<Button slot="close">Save Changes</Button>
						</Dialog.Footer>
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
				<Modal className="w-96">
					<Dialog>
						<Dialog.Close />
						<Dialog.Header>
							<Dialog.Title>Edit Profile</Dialog.Title>
							<Dialog.Description>Update your profile information below.</Dialog.Description>
						</Dialog.Header>
						<form className="mt-4 flex flex-col gap-4">
							<TextField>
								<Label>Name</Label>
								<Input placeholder="Enter your name" />
							</TextField>
							<TextField>
								<Label>Email</Label>
								<Input type="email" placeholder="Enter your email" />
							</TextField>
							<TextField>
								<Label>Bio</Label>
								<TextArea rows={3} placeholder="Tell us about yourself" />
							</TextField>
							<Dialog.Footer>
								<Button variant="outline" color="neutral" slot="close">
									Cancel
								</Button>
								<Button type="submit">Save Changes</Button>
							</Dialog.Footer>
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
				<Modal className="max-w-md">
					<Dialog className="max-h-[80vh] overflow-y-auto">
						<Dialog.Header>
							<Dialog.Title>Terms and Conditions</Dialog.Title>
						</Dialog.Header>
						<div className="mt-4 space-y-4 text-sm text-neutral-600 dark:text-neutral-400">
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
						<Dialog.Footer>
							<Button variant="outline" color="neutral" slot="close">
								Decline
							</Button>
							<Button slot="close">Accept</Button>
						</Dialog.Footer>
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
					<Dialog>
						<Dialog.Header>
							<Dialog.Title>Confirm Order</Dialog.Title>
							<Dialog.Description>
								You are about to submit an order for $99.99. Continue?
							</Dialog.Description>
						</Dialog.Header>
						<Dialog.Footer>
							<Button variant="outline" color="neutral" slot="close">
								Go Back
							</Button>
							<Button slot="close">Place Order</Button>
						</Dialog.Footer>
					</Dialog>
				</Modal>
			</Modal.Overlay>
		</DialogTrigger>
	),
};
