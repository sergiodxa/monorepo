import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Sheet, SheetTrigger } from "./sheet";
import { TextField } from "./text-field";

type StoryArgs = {
	side: "right" | "left";
	isDismissable: boolean;
};

const meta: Meta<StoryArgs> = {
	title: "Overlays/Sheet",
	component: Sheet as unknown as Meta<StoryArgs>["component"],
	args: {
		side: "right",
		isDismissable: true,
	},
	argTypes: {
		side: {
			control: "select",
			options: ["right", "left"],
		},
		isDismissable: {
			control: "boolean",
		},
	},
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
	render: ({ side, isDismissable }) => (
		<SheetTrigger>
			<Button>Open Sheet</Button>
			<Sheet.Overlay isDismissable={isDismissable}>
				<Sheet side={side}>
					<Sheet.Content>
						<Sheet.Header>
							<Sheet.Title>Project details</Sheet.Title>
							<Sheet.Description>
								Update the project name and owner for your team.
							</Sheet.Description>
						</Sheet.Header>
						<div className="grid gap-4">
							<TextField>
								<Label>Project name</Label>
								<Input placeholder="Roadmap" />
							</TextField>
							<TextField>
								<Label>Owner</Label>
								<Input placeholder="sergio@example.com" />
							</TextField>
						</div>
						<Sheet.Footer>
							<Button variant="outline" slot="close">
								Cancel
							</Button>
							<Button slot="close">Save</Button>
						</Sheet.Footer>
					</Sheet.Content>
				</Sheet>
			</Sheet.Overlay>
		</SheetTrigger>
	),
};

export const ScrollableContent: Story = {
	render: () => (
		<SheetTrigger>
			<Button>Open Scrollable Sheet</Button>
			<Sheet.Overlay isDismissable>
				<Sheet>
					<Sheet.Content>
						<Sheet.Header>
							<Sheet.Title>Activity</Sheet.Title>
							<Sheet.Description>Recent changes across the workspace.</Sheet.Description>
						</Sheet.Header>
						<div className="flex-1 overflow-auto">
							<ul className="space-y-3 text-sm">
								<li>Created quarterly roadmap.</li>
								<li>Updated billing owner to sergio@example.com.</li>
								<li>Added 3 new team members.</li>
								<li>Connected Slack notifications.</li>
								<li>Archived the legacy project.</li>
								<li>Renamed the mobile app workspace.</li>
								<li>Uploaded the new brand assets.</li>
								<li>Scheduled a status review for Monday.</li>
								<li>Moved the analytics dashboard to Q2.</li>
								<li>Reopened the onboarding checklist.</li>
								<li>Reassigned ticket #458 to Kai.</li>
								<li>Added a security review reminder.</li>
								<li>Published the incident postmortem.</li>
								<li>Shared the new pricing draft.</li>
								<li>Updated integrations API token.</li>
							</ul>
						</div>
						<Sheet.Footer>
							<Button slot="close">Done</Button>
						</Sheet.Footer>
					</Sheet.Content>
				</Sheet>
			</Sheet.Overlay>
		</SheetTrigger>
	),
};
