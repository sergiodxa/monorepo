import type { Meta, StoryObj } from "@storybook/react";

import { AlertDialog, AlertDialogTrigger } from "./alert-dialog";
import { Button } from "./button";

const meta: Meta<typeof AlertDialog> = {
	title: "Overlays/AlertDialog",
	component: AlertDialog,
};

export default meta;
type Story = StoryObj<typeof AlertDialog>;

export const Default: Story = {
	render: () => (
		<AlertDialogTrigger>
			<Button color="danger">Delete Item</Button>
			<AlertDialog.Content>
				<AlertDialog>
					<AlertDialog.Header>
						<AlertDialog.Title>Delete Item</AlertDialog.Title>
						<AlertDialog.Description>
							Are you sure you want to delete this item? This action cannot be undone.
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
						<AlertDialog.Action>Delete</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog>
			</AlertDialog.Content>
		</AlertDialogTrigger>
	),
};

export const DestructiveAction: Story = {
	render: () => (
		<AlertDialogTrigger>
			<Button color="danger" variant="outline">
				Delete Account
			</Button>
			<AlertDialog.Content>
				<AlertDialog>
					<AlertDialog.Header>
						<AlertDialog.Title>Delete Account</AlertDialog.Title>
						<AlertDialog.Description>
							This will permanently delete your account and all associated data. This action cannot
							be undone.
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Keep Account</AlertDialog.Cancel>
						<AlertDialog.Action>Yes, Delete Account</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog>
			</AlertDialog.Content>
		</AlertDialogTrigger>
	),
};

export const ConfirmAction: Story = {
	render: () => (
		<AlertDialogTrigger>
			<Button>Publish Changes</Button>
			<AlertDialog.Content>
				<AlertDialog>
					<AlertDialog.Header>
						<AlertDialog.Title>Publish Changes</AlertDialog.Title>
						<AlertDialog.Description>
							Your changes will be visible to all users. Are you sure you want to publish?
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
						<AlertDialog.Action color="primary">Publish</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog>
			</AlertDialog.Content>
		</AlertDialogTrigger>
	),
};

export const DiscardChanges: Story = {
	render: () => (
		<AlertDialogTrigger>
			<Button variant="ghost" color="neutral">
				Discard
			</Button>
			<AlertDialog.Content>
				<AlertDialog>
					<AlertDialog.Header>
						<AlertDialog.Title>Discard Changes</AlertDialog.Title>
						<AlertDialog.Description>
							You have unsaved changes. Are you sure you want to discard them?
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Keep Editing</AlertDialog.Cancel>
						<AlertDialog.Action color="warning">Discard</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog>
			</AlertDialog.Content>
		</AlertDialogTrigger>
	),
};
