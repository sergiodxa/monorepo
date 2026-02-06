import type { Meta, StoryObj } from "@storybook/react";

import { Skeleton } from "./skeleton";

type StoryArgs = {
	width: number;
	height: number;
	rounded: "md" | "full";
};

const meta: Meta<StoryArgs> = {
	title: "Feedback/Skeleton",
	component: Skeleton as unknown as Meta<StoryArgs>["component"],
	args: {
		width: 240,
		height: 16,
		rounded: "md",
	},
	argTypes: {
		width: { control: { type: "range", min: 40, max: 400, step: 4 } },
		height: { control: { type: "range", min: 8, max: 80, step: 2 } },
		rounded: { control: "select", options: ["md", "full"] },
	},
	render: ({ width, height, rounded }) => (
		<Skeleton
			style={{ width, height }}
			className={rounded === "full" ? "rounded-full" : undefined}
		/>
	),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const Circle: Story = {
	args: {
		width: 48,
		height: 48,
		rounded: "full",
	},
};
