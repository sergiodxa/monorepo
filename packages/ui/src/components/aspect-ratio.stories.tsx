import type { Meta, StoryObj } from "@storybook/react";

import { AspectRatio } from "./aspect-ratio";

type StoryArgs = AspectRatio.Props & {
	label: string;
};

const demoImage =
	"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><rect width='800' height='450' fill='%23e5e7eb'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236b7280' font-family='Arial' font-size='32'>Media</text></svg>";

const meta: Meta<StoryArgs> = {
	title: "Layout/AspectRatio",
	component: AspectRatio,
	args: {
		ratio: "16 / 9",
		label: "Product demo",
		className: "max-w-md rounded-lg border border-neutral-200 bg-neutral-100",
	},
	argTypes: {
		ratio: { control: "text" },
		label: { control: "text" },
		className: { control: "text" },
	},
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
	render: ({ label, ...args }) => (
		<AspectRatio {...args}>
			<img alt={label} src={demoImage} className="h-full w-full object-cover" loading="lazy" />
		</AspectRatio>
	),
};
