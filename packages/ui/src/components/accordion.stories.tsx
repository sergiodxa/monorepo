import type { Meta, StoryObj } from "@storybook/react";

import { Accordion } from "./accordion";

type StoryArgs = {
	type: "single" | "multiple";
};

const meta: Meta<StoryArgs> = {
	title: "Layout/Accordion",
	component: Accordion as unknown as Meta<StoryArgs>["component"],
	args: {
		type: "single",
	},
	argTypes: {
		type: { control: "select", options: ["single", "multiple"] },
	},
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
	render: ({ type }) => (
		<Accordion type={type} className="w-80">
			<Accordion.Item value="overview">
				<Accordion.Trigger>
					<span>Product overview</span>
					<svg viewBox="0 0 20 20" className="size-4" data-accordion-icon aria-hidden>
						<path fill="currentColor" d="M6 8l4 4 4-4" />
					</svg>
				</Accordion.Trigger>
				<Accordion.Content>
					A quick look at what the product does, who it is for, and how it helps your team.
				</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="setup">
				<Accordion.Trigger>
					<span>Setup details</span>
					<svg viewBox="0 0 20 20" className="size-4" data-accordion-icon aria-hidden>
						<path fill="currentColor" d="M6 8l4 4 4-4" />
					</svg>
				</Accordion.Trigger>
				<Accordion.Content>
					Follow the setup guide to connect your data sources and configure permissions.
				</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="support">
				<Accordion.Trigger>
					<span>Support options</span>
					<svg viewBox="0 0 20 20" className="size-4" data-accordion-icon aria-hidden>
						<path fill="currentColor" d="M6 8l4 4 4-4" />
					</svg>
				</Accordion.Trigger>
				<Accordion.Content>
					Reach out to support or browse the documentation for troubleshooting tips.
				</Accordion.Content>
			</Accordion.Item>
		</Accordion>
	),
};

export const Composition: Story = {
	render: () => (
		<Accordion type="multiple" className="w-96">
			<Accordion.Item value="billing">
				<Accordion.Trigger>
					<span>Billing cycles</span>
					<span className="text-xs text-neutral-500">Updated weekly</span>
					<svg viewBox="0 0 20 20" className="size-4" data-accordion-icon aria-hidden>
						<path fill="currentColor" d="M6 8l4 4 4-4" />
					</svg>
				</Accordion.Trigger>
				<Accordion.Content>
					<div>
						<p>Choose monthly or annual billing. Annual plans include a discount.</p>
						<ul className="mt-3 list-disc space-y-1 pl-5">
							<li>Monthly renews on the 1st.</li>
							<li>Annual renews on your signup date.</li>
							<li>Invoices are emailed automatically.</li>
						</ul>
					</div>
				</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="invoices">
				<Accordion.Trigger>
					<span>Invoices</span>
					<span className="text-xs text-neutral-500">3 pending</span>
					<svg viewBox="0 0 20 20" className="size-4" data-accordion-icon aria-hidden>
						<path fill="currentColor" d="M6 8l4 4 4-4" />
					</svg>
				</Accordion.Trigger>
				<Accordion.Content>
					Download invoices or update the billing email for your team.
				</Accordion.Content>
			</Accordion.Item>
		</Accordion>
	),
};
