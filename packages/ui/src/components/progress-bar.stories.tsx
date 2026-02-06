import type { Meta, StoryObj } from "@storybook/react";

import { Label } from "./label";
import { ProgressBar } from "./progress-bar";

const meta: Meta<typeof ProgressBar> = {
	title: "Progress/ProgressBar",
	component: ProgressBar,
	argTypes: {
		value: { control: { type: "range", min: 0, max: 100 } },
		isIndeterminate: { control: "boolean" },
	},
	args: {
		value: 50,
		isIndeterminate: false,
	},
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Default: Story = {
	render: (args) => (
		<ProgressBar {...args} className="w-64">
			{({ percentage }) => (
				<>
					<ProgressBar.Track>
						<ProgressBar.Fill percentage={percentage} />
					</ProgressBar.Track>
				</>
			)}
		</ProgressBar>
	),
};

export const WithLabel: Story = {
	render: (args) => (
		<ProgressBar {...args} className="w-64">
			{({ percentage }) => (
				<>
					<div className="flex justify-between">
						<Label>Uploading...</Label>
						<ProgressBar.ValueLabel>{percentage}%</ProgressBar.ValueLabel>
					</div>
					<ProgressBar.Track>
						<ProgressBar.Fill percentage={percentage} />
					</ProgressBar.Track>
				</>
			)}
		</ProgressBar>
	),
};

export const DifferentValues: Story = {
	render: () => (
		<div className="flex flex-col gap-6">
			<ProgressBar value={0} className="w-64">
				{({ percentage }) => (
					<>
						<div className="flex justify-between">
							<Label>0%</Label>
							<ProgressBar.ValueLabel>{percentage}%</ProgressBar.ValueLabel>
						</div>
						<ProgressBar.Track>
							<ProgressBar.Fill percentage={percentage} />
						</ProgressBar.Track>
					</>
				)}
			</ProgressBar>
			<ProgressBar value={50} className="w-64">
				{({ percentage }) => (
					<>
						<div className="flex justify-between">
							<Label>50%</Label>
							<ProgressBar.ValueLabel>{percentage}%</ProgressBar.ValueLabel>
						</div>
						<ProgressBar.Track>
							<ProgressBar.Fill percentage={percentage} />
						</ProgressBar.Track>
					</>
				)}
			</ProgressBar>
			<ProgressBar value={100} className="w-64">
				{({ percentage }) => (
					<>
						<div className="flex justify-between">
							<Label>100%</Label>
							<ProgressBar.ValueLabel>{percentage}%</ProgressBar.ValueLabel>
						</div>
						<ProgressBar.Track>
							<ProgressBar.Fill percentage={percentage} />
						</ProgressBar.Track>
					</>
				)}
			</ProgressBar>
		</div>
	),
};

export const Indeterminate: Story = {
	render: (args) => (
		<ProgressBar {...args} isIndeterminate className="w-64">
			<div className="flex justify-between">
				<Label>Loading...</Label>
			</div>
			<ProgressBar.Track>
				<ProgressBar.Fill isIndeterminate />
			</ProgressBar.Track>
		</ProgressBar>
	),
};

export const IndeterminateWithLabel: Story = {
	render: (args) => (
		<ProgressBar {...args} isIndeterminate className="w-64">
			<div className="flex justify-between">
				<Label>Processing your request</Label>
			</div>
			<ProgressBar.Track>
				<ProgressBar.Fill isIndeterminate />
			</ProgressBar.Track>
		</ProgressBar>
	),
};

export const DownloadProgress: Story = {
	render: (args) => (
		<ProgressBar {...args} className="w-64">
			{({ percentage }) => (
				<>
					<div className="flex justify-between">
						<Label>Downloading file.zip</Label>
						<ProgressBar.ValueLabel>67 MB / 100 MB</ProgressBar.ValueLabel>
					</div>
					<ProgressBar.Track>
						<ProgressBar.Fill percentage={percentage} />
					</ProgressBar.Track>
				</>
			)}
		</ProgressBar>
	),
};

export const MultipleProgress: Story = {
	render: () => (
		<div className="flex flex-col gap-4 w-80">
			<ProgressBar value={100} className="w-full">
				{({ percentage }) => (
					<>
						<div className="flex justify-between">
							<Label>Step 1: Upload</Label>
							<ProgressBar.ValueLabel>Complete</ProgressBar.ValueLabel>
						</div>
						<ProgressBar.Track>
							<ProgressBar.Fill percentage={percentage} />
						</ProgressBar.Track>
					</>
				)}
			</ProgressBar>
			<ProgressBar value={45} className="w-full">
				{({ percentage }) => (
					<>
						<div className="flex justify-between">
							<Label>Step 2: Process</Label>
							<ProgressBar.ValueLabel>{percentage}%</ProgressBar.ValueLabel>
						</div>
						<ProgressBar.Track>
							<ProgressBar.Fill percentage={percentage} />
						</ProgressBar.Track>
					</>
				)}
			</ProgressBar>
			<ProgressBar value={0} className="w-full">
				{({ percentage }) => (
					<>
						<div className="flex justify-between">
							<Label>Step 3: Verify</Label>
							<ProgressBar.ValueLabel>Pending</ProgressBar.ValueLabel>
						</div>
						<ProgressBar.Track>
							<ProgressBar.Fill percentage={percentage} />
						</ProgressBar.Track>
					</>
				)}
			</ProgressBar>
		</div>
	),
};
