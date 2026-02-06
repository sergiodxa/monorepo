import type { Meta, StoryObj } from "@storybook/react";

import { toast } from "sonner";

import { Button } from "./button";
import { Toaster } from "./toaster";

type StoryArgs = {
	position:
		| "top-left"
		| "top-right"
		| "top-center"
		| "bottom-left"
		| "bottom-right"
		| "bottom-center";
	theme: "light" | "dark" | "system";
	closeButton: boolean;
	richColors: boolean;
	expand: boolean;
	duration: number;
};

const meta: Meta<StoryArgs> = {
	title: "Feedback/Toaster",
	component: Toaster as unknown as Meta<StoryArgs>["component"],
	args: {
		position: "top-right",
		theme: "system",
		closeButton: true,
		richColors: false,
		expand: true,
		duration: 4000,
	},
	argTypes: {
		position: {
			control: "select",
			options: [
				"top-left",
				"top-right",
				"top-center",
				"bottom-left",
				"bottom-right",
				"bottom-center",
			],
		},
		theme: { control: "select", options: ["light", "dark", "system"] },
		closeButton: { control: "boolean" },
		richColors: { control: "boolean" },
		expand: { control: "boolean" },
		duration: { control: "number" },
	},
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
	render: (args) => (
		<div className="flex flex-col items-start gap-3">
			<Toaster {...args} />
			<div className="flex flex-wrap gap-2">
				<Button
					onPress={() =>
						toast("Changes saved", {
							description: "Your settings were updated.",
						})
					}
				>
					Default
				</Button>
				<Button
					color="success"
					onPress={() =>
						toast.success("Invite sent", {
							description: "We emailed the invite link.",
						})
					}
				>
					Success
				</Button>
				<Button
					color="danger"
					onPress={() =>
						toast.error("Payment failed", {
							description: "Update your card to continue.",
							action: {
								label: "Retry",
								onClick: () => toast("Retrying payment..."),
							},
						})
					}
				>
					Error
				</Button>
			</div>
		</div>
	),
};
