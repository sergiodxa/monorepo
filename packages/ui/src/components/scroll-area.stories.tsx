import type { Meta, StoryObj } from "@storybook/react";

import { ScrollArea } from "./scroll-area";

type StoryArgs = ScrollArea.Props & {
	orientation: ScrollArea.Orientation;
	viewportClassName: string;
	itemCount: number;
};

const meta: Meta<StoryArgs> = {
	title: "Layout/Scroll Area",
	component: ScrollArea,
	args: {
		className: "max-w-sm",
		viewportClassName: "h-64",
		orientation: "vertical",
		itemCount: 18,
	},
	argTypes: {
		className: { control: "text" },
		viewportClassName: { control: "text" },
		orientation: {
			control: "select",
			options: ["vertical", "horizontal", "both"],
		},
		itemCount: { control: { type: "number", min: 4, max: 48, step: 2 } },
	},
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
	render: ({ viewportClassName, orientation, itemCount, ...args }) => (
		<ScrollArea {...args}>
			<ScrollArea.Viewport className={viewportClassName} orientation={orientation}>
				<ul className="flex flex-col gap-2 p-4 text-sm text-neutral-700 dark:text-neutral-300">
					{Array.from({ length: itemCount }, (_, index) => (
						<li key={`note-${index}`} className="rounded-md border p-3">
							<div className="font-medium text-neutral-900 dark:text-neutral-100">
								Update {index + 1}
							</div>
							<div className="mt-1 text-neutral-500 dark:text-neutral-400">
								Review the checklist and confirm the next milestone.
							</div>
						</li>
					))}
				</ul>
			</ScrollArea.Viewport>
		</ScrollArea>
	),
};

export const Horizontal: Story = {
	render: () => (
		<ScrollArea className="max-w-lg">
			<ScrollArea.Viewport orientation="horizontal" className="h-36">
				<div className="flex w-max gap-3 p-4 text-sm">
					{Array.from({ length: 10 }, (_, index) => (
						<div
							key={`card-${index}`}
							className="w-48 rounded-lg border bg-white p-3 text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
						>
							<div className="font-medium">Sprint {index + 1}</div>
							<div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
								Focus on release readiness and QA feedback.
							</div>
						</div>
					))}
				</div>
			</ScrollArea.Viewport>
		</ScrollArea>
	),
};
