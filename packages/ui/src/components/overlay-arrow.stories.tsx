import type { Meta, StoryObj } from "@storybook/react";

import { DialogTrigger } from "react-aria-components";

import { Button } from "./button";
import { Dialog } from "./dialog";
import { OverlayArrow } from "./overlay-arrow";
import { Popover } from "./popover";

const meta: Meta<typeof OverlayArrow> = {
	title: "Utility/OverlayArrow",
	component: OverlayArrow,
};

export default meta;
type Story = StoryObj<typeof OverlayArrow>;

export const Default: Story = {
	render: (args) => (
		<DialogTrigger>
			<Button>Open Popover with Arrow</Button>
			<Popover placement="bottom">
				<OverlayArrow {...args}>
					<svg width={12} height={12} viewBox="0 0 12 12" className="fill-white stroke-gray-200">
						<path d="M0 0 L6 6 L12 0" />
					</svg>
				</OverlayArrow>
				<Dialog className="p-4">
					<p>This popover has an arrow pointing to its trigger.</p>
				</Dialog>
			</Popover>
		</DialogTrigger>
	),
};

export const AllPlacements: Story = {
	render: () => (
		<div className="flex flex-wrap items-center justify-center gap-4 p-24">
			<DialogTrigger>
				<Button>Top</Button>
				<Popover placement="top">
					<OverlayArrow>
						<svg width={12} height={12} viewBox="0 0 12 12" className="fill-white stroke-gray-200">
							<path d="M0 0 L6 6 L12 0" />
						</svg>
					</OverlayArrow>
					<Dialog className="p-4">
						<p>Arrow points down</p>
					</Dialog>
				</Popover>
			</DialogTrigger>

			<DialogTrigger>
				<Button>Bottom</Button>
				<Popover placement="bottom">
					<OverlayArrow>
						<svg width={12} height={12} viewBox="0 0 12 12" className="fill-white stroke-gray-200">
							<path d="M0 0 L6 6 L12 0" />
						</svg>
					</OverlayArrow>
					<Dialog className="p-4">
						<p>Arrow points up</p>
					</Dialog>
				</Popover>
			</DialogTrigger>

			<DialogTrigger>
				<Button>Left</Button>
				<Popover placement="left">
					<OverlayArrow>
						<svg width={12} height={12} viewBox="0 0 12 12" className="fill-white stroke-gray-200">
							<path d="M0 0 L6 6 L12 0" />
						</svg>
					</OverlayArrow>
					<Dialog className="p-4">
						<p>Arrow points right</p>
					</Dialog>
				</Popover>
			</DialogTrigger>

			<DialogTrigger>
				<Button>Right</Button>
				<Popover placement="right">
					<OverlayArrow>
						<svg width={12} height={12} viewBox="0 0 12 12" className="fill-white stroke-gray-200">
							<path d="M0 0 L6 6 L12 0" />
						</svg>
					</OverlayArrow>
					<Dialog className="p-4">
						<p>Arrow points left</p>
					</Dialog>
				</Popover>
			</DialogTrigger>
		</div>
	),
};

export const CustomArrowStyle: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Styled Arrow</Button>
			<Popover placement="bottom" className="rounded-lg border border-blue-200 bg-blue-50">
				<OverlayArrow>
					<svg width={16} height={16} viewBox="0 0 16 16" className="fill-blue-50 stroke-blue-200">
						<path d="M0 0 L8 8 L16 0" strokeWidth={1} />
					</svg>
				</OverlayArrow>
				<Dialog className="p-4">
					<p className="text-blue-900">Custom styled popover with matching arrow.</p>
				</Dialog>
			</Popover>
		</DialogTrigger>
	),
};

export const TooltipStyle: Story = {
	render: () => (
		<DialogTrigger>
			<Button>Hover for Tooltip</Button>
			<Popover placement="top" className="rounded bg-gray-900 text-white">
				<OverlayArrow>
					<svg width={10} height={10} viewBox="0 0 10 10" className="fill-gray-900">
						<path d="M0 0 L5 5 L10 0" />
					</svg>
				</OverlayArrow>
				<Dialog className="px-3 py-2 text-sm">Tooltip content</Dialog>
			</Popover>
		</DialogTrigger>
	),
};
