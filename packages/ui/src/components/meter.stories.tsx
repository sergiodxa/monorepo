import type { Meta, StoryObj } from "@storybook/react";

import { Label } from "./label";
import { Meter } from "./meter";

const meta: Meta<typeof Meter> = {
	title: "Progress/Meter",
	component: Meter,
	argTypes: {
		value: { control: { type: "range", min: 0, max: 100 } },
		color: { control: "select", options: ["primary", "neutral", "danger", "warning", "success"] },
	},
	args: {
		value: 50,
		color: "primary",
	},
};

export default meta;
type Story = StoryObj<typeof Meter>;

export const Default: Story = {
	render: (args) => (
		<Meter {...args} className="w-64">
			{({ percentage }) => (
				<>
					<Meter.Track>
						<Meter.Fill percentage={percentage} />
					</Meter.Track>
				</>
			)}
		</Meter>
	),
};

export const WithLabel: Story = {
	render: (args) => (
		<Meter {...args} className="w-64">
			{({ percentage }) => (
				<>
					<div className="flex justify-between">
						<Label>Storage</Label>
						<Meter.ValueLabel>{percentage}%</Meter.ValueLabel>
					</div>
					<Meter.Track>
						<Meter.Fill percentage={percentage} />
					</Meter.Track>
				</>
			)}
		</Meter>
	),
};

export const DifferentValues: Story = {
	render: () => (
		<div className="flex flex-col gap-6">
			<Meter value={0} className="w-64">
				{({ percentage }) => (
					<>
						<div className="flex justify-between">
							<Label>0%</Label>
							<Meter.ValueLabel>{percentage}%</Meter.ValueLabel>
						</div>
						<Meter.Track>
							<Meter.Fill percentage={percentage} />
						</Meter.Track>
					</>
				)}
			</Meter>
			<Meter value={50} className="w-64">
				{({ percentage }) => (
					<>
						<div className="flex justify-between">
							<Label>50%</Label>
							<Meter.ValueLabel>{percentage}%</Meter.ValueLabel>
						</div>
						<Meter.Track>
							<Meter.Fill percentage={percentage} />
						</Meter.Track>
					</>
				)}
			</Meter>
			<Meter value={100} className="w-64">
				{({ percentage }) => (
					<>
						<div className="flex justify-between">
							<Label>100%</Label>
							<Meter.ValueLabel>{percentage}%</Meter.ValueLabel>
						</div>
						<Meter.Track>
							<Meter.Fill percentage={percentage} />
						</Meter.Track>
					</>
				)}
			</Meter>
		</div>
	),
};

export const WarningState: Story = {
	render: (args) => (
		<Meter {...args} color="warning" className="w-64">
			{({ percentage }) => (
				<>
					<div className="flex justify-between">
						<Label>Storage (Warning)</Label>
						<Meter.ValueLabel>{percentage}%</Meter.ValueLabel>
					</div>
					<Meter.Track>
						<Meter.Fill percentage={percentage} />
					</Meter.Track>
				</>
			)}
		</Meter>
	),
};

export const DangerState: Story = {
	render: (args) => (
		<Meter {...args} color="danger" className="w-64">
			{({ percentage }) => (
				<>
					<div className="flex justify-between">
						<Label>Storage (Critical)</Label>
						<Meter.ValueLabel>{percentage}%</Meter.ValueLabel>
					</div>
					<Meter.Track>
						<Meter.Fill percentage={percentage} />
					</Meter.Track>
				</>
			)}
		</Meter>
	),
};

export const DynamicColor: Story = {
	render: () => {
		function getColor(value: number): Meter.Color {
			if (value >= 90) return "danger";
			if (value >= 70) return "warning";
			return "success";
		}

		return (
			<div className="flex flex-col gap-6">
				<Meter value={50} color={getColor(50)} className="w-64">
					{({ percentage }) => (
						<>
							<div className="flex justify-between">
								<Label>50% - Success</Label>
								<Meter.ValueLabel>{percentage}%</Meter.ValueLabel>
							</div>
							<Meter.Track>
								<Meter.Fill percentage={percentage} />
							</Meter.Track>
						</>
					)}
				</Meter>
				<Meter value={75} color={getColor(75)} className="w-64">
					{({ percentage }) => (
						<>
							<div className="flex justify-between">
								<Label>75% - Warning</Label>
								<Meter.ValueLabel>{percentage}%</Meter.ValueLabel>
							</div>
							<Meter.Track>
								<Meter.Fill percentage={percentage} />
							</Meter.Track>
						</>
					)}
				</Meter>
				<Meter value={95} color={getColor(95)} className="w-64">
					{({ percentage }) => (
						<>
							<div className="flex justify-between">
								<Label>95% - Danger</Label>
								<Meter.ValueLabel>{percentage}%</Meter.ValueLabel>
							</div>
							<Meter.Track>
								<Meter.Fill percentage={percentage} />
							</Meter.Track>
						</>
					)}
				</Meter>
			</div>
		);
	},
};
