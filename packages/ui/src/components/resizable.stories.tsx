import type { Meta, StoryObj } from "@storybook/react";

import { Heading } from "./heading";
import { Resizable } from "./resizable";
import { Text } from "./text";

const meta: Meta<typeof Resizable> = {
	title: "Layout/Resizable",
	component: Resizable,
	argTypes: {
		orientation: { control: "select", options: ["horizontal", "vertical"] },
		isDisabled: { control: "boolean" },
	},
	args: {
		orientation: "horizontal",
		isDisabled: false,
	},
};

export default meta;
type Story = StoryObj<typeof Resizable>;

export const Default: Story = {
	render: (args) => (
		<Resizable {...args} className="h-72 w-full max-w-4xl">
			<Resizable.Panel id="resizable-panel-nav" defaultSize={25} minSize={15} className="p-4">
				<Heading level={3}>Navigation</Heading>
				<Text className="text-sm text-neutral-500">
					Keep an eye on navigation and resize this panel to balance space.
				</Text>
			</Resizable.Panel>
			<Resizable.Handle aria-label="Resize navigation panel" />
			<Resizable.Panel id="resizable-panel-main" defaultSize={50} minSize={25} className="p-4">
				<Heading level={3}>Main content</Heading>
				<Text className="text-sm text-neutral-500">
					Drag the handles or use arrow keys when focused to adjust.
				</Text>
			</Resizable.Panel>
			<Resizable.Handle aria-label="Resize main panel" />
			<Resizable.Panel id="resizable-panel-meta" defaultSize={25} minSize={15} className="p-4">
				<Heading level={3}>Details</Heading>
				<Text className="text-sm text-neutral-500">
					This panel is useful for metadata or inspector content.
				</Text>
			</Resizable.Panel>
		</Resizable>
	),
};
