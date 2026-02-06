import type { Meta, StoryObj } from "@storybook/react";

import { Heading } from "react-aria-components";

import { Button } from "./button";
import { Dialog, DialogTrigger } from "./dialog";
import { Drawer } from "./drawer";

type StoryArgs = {
	placement: Drawer.Placement;
	isDismissable: boolean;
	isKeyboardDismissDisabled: boolean;
};

const meta: Meta<StoryArgs> = {
	title: "Overlays/Drawer",
	component: Drawer as unknown as Meta<StoryArgs>["component"],
	args: {
		placement: "bottom",
		isDismissable: true,
		isKeyboardDismissDisabled: false,
	},
	argTypes: {
		placement: {
			control: "select",
			options: ["bottom", "top"],
		},
	},
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
	render: ({ placement, isDismissable, isKeyboardDismissDisabled }) => (
		<DialogTrigger>
			<Button>Open Drawer</Button>
			<Drawer.Overlay
				placement={placement}
				isDismissable={isDismissable}
				isKeyboardDismissDisabled={isKeyboardDismissDisabled}
			>
				<Drawer placement={placement}>
					<Dialog className="flex h-full flex-col gap-4">
						<Heading slot="title" className="ui-dialog-title">
							Project Settings
						</Heading>
						<div className="flex-1 space-y-4 overflow-auto text-sm text-neutral-600 dark:text-neutral-300">
							<p>
								Adjust notification rules, access levels, and sync preferences for this project.
							</p>
							<div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
								<p className="font-medium text-neutral-900 dark:text-neutral-100">Sync schedule</p>
								<p className="mt-1">Sync changes every 15 minutes to keep reports current.</p>
							</div>
							<div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
								<p className="font-medium text-neutral-900 dark:text-neutral-100">Access</p>
								<p className="mt-1">Only team members with admin access can edit integrations.</p>
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<Button variant="outline" slot="close">
								Cancel
							</Button>
							<Button slot="close">Save changes</Button>
						</div>
					</Dialog>
				</Drawer>
			</Drawer.Overlay>
		</DialogTrigger>
	),
};
