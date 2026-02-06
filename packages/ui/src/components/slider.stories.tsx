import type { Meta, StoryObj } from "@storybook/react";

import { Label } from "./label";
import { Slider } from "./slider";

const meta: Meta<typeof Slider> = {
	title: "Progress/Slider",
	component: Slider,
	argTypes: {
		defaultValue: { control: "number" },
		minValue: { control: "number" },
		maxValue: { control: "number" },
		step: { control: "number" },
		isDisabled: { control: "boolean" },
	},
	args: {
		defaultValue: 50,
		minValue: 0,
		maxValue: 100,
		step: 1,
		isDisabled: false,
	},
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
	render: (args) => (
		<Slider {...args} className="w-64">
			<Slider.Track>
				<Slider.Thumb />
			</Slider.Track>
		</Slider>
	),
};

export const WithLabel: Story = {
	render: (args) => (
		<Slider {...args} className="w-64">
			<div className="flex justify-between">
				<Label>Volume</Label>
				<Slider.Output />
			</div>
			<Slider.Track>
				<Slider.Thumb />
			</Slider.Track>
		</Slider>
	),
};

export const DifferentValues: Story = {
	render: () => (
		<div className="flex flex-col gap-6">
			<Slider defaultValue={0} className="w-64">
				<div className="flex justify-between">
					<Label>0%</Label>
					<Slider.Output />
				</div>
				<Slider.Track>
					<Slider.Thumb />
				</Slider.Track>
			</Slider>
			<Slider defaultValue={50} className="w-64">
				<div className="flex justify-between">
					<Label>50%</Label>
					<Slider.Output />
				</div>
				<Slider.Track>
					<Slider.Thumb />
				</Slider.Track>
			</Slider>
			<Slider defaultValue={100} className="w-64">
				<div className="flex justify-between">
					<Label>100%</Label>
					<Slider.Output />
				</div>
				<Slider.Track>
					<Slider.Thumb />
				</Slider.Track>
			</Slider>
		</div>
	),
};

export const WithStep: Story = {
	render: (args) => (
		<Slider {...args} step={10} className="w-64">
			<div className="flex justify-between">
				<Label>Step: 10</Label>
				<Slider.Output />
			</div>
			<Slider.Track>
				<Slider.Thumb />
			</Slider.Track>
		</Slider>
	),
};

export const WithMinMax: Story = {
	render: (args) => (
		<Slider {...args} minValue={0} maxValue={50} className="w-64">
			<div className="flex justify-between">
				<Label>Range: 0-50</Label>
				<Slider.Output />
			</div>
			<Slider.Track>
				<Slider.Thumb />
			</Slider.Track>
		</Slider>
	),
};

export const RangeSlider: Story = {
	render: () => (
		<Slider<number[]> defaultValue={[25, 75]} className="w-64">
			<div className="flex justify-between">
				<Label>Price Range</Label>
				<Slider.Output />
			</div>
			<Slider.Track>
				<Slider.Thumb index={0} />
				<Slider.Thumb index={1} />
			</Slider.Track>
		</Slider>
	),
};

export const RangeSliderWithStep: Story = {
	render: () => (
		<Slider<number[]> defaultValue={[20, 80]} step={20} className="w-64">
			<div className="flex justify-between">
				<Label>Range with Step: 20</Label>
				<Slider.Output />
			</div>
			<Slider.Track>
				<Slider.Thumb index={0} />
				<Slider.Thumb index={1} />
			</Slider.Track>
		</Slider>
	),
};

export const Disabled: Story = {
	render: (args) => (
		<Slider {...args} isDisabled className="w-64">
			<div className="flex justify-between">
				<Label>Disabled</Label>
				<Slider.Output />
			</div>
			<Slider.Track>
				<Slider.Thumb />
			</Slider.Track>
		</Slider>
	),
};

export const Vertical: Story = {
	render: (args) => (
		<Slider {...args} orientation="vertical" className="h-40">
			<Label>Vertical</Label>
			<Slider.Track>
				<Slider.Thumb />
			</Slider.Track>
			<Slider.Output />
		</Slider>
	),
};

export const VerticalRange: Story = {
	render: () => (
		<Slider<number[]> defaultValue={[25, 75]} orientation="vertical" className="h-40">
			<Label>Vertical Range</Label>
			<Slider.Track>
				<Slider.Thumb index={0} />
				<Slider.Thumb index={1} />
			</Slider.Track>
			<Slider.Output />
		</Slider>
	),
};
