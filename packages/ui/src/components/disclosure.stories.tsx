import type { Meta, StoryObj } from "@storybook/react";

import { Disclosure } from "./disclosure";

const meta: Meta<typeof Disclosure> = {
	title: "Layout/Disclosure",
	component: Disclosure,
};

export default meta;
type Story = StoryObj<typeof Disclosure>;

export const Default: Story = {
	render: (args) => (
		<Disclosure {...args}>
			<Disclosure.Trigger>Show more information</Disclosure.Trigger>
			<Disclosure.Panel>
				<p className="p-4">
					This is the hidden content that becomes visible when you click the trigger. It can contain
					any content you want to show or hide.
				</p>
			</Disclosure.Panel>
		</Disclosure>
	),
};

export const DefaultExpanded: Story = {
	render: () => (
		<Disclosure defaultExpanded>
			<Disclosure.Trigger>Details (expanded by default)</Disclosure.Trigger>
			<Disclosure.Panel>
				<p className="p-4">
					This disclosure panel is expanded by default. Click the trigger to collapse it.
				</p>
			</Disclosure.Panel>
		</Disclosure>
	),
};

export const AccordionGroup: Story = {
	render: () => (
		<Disclosure.Group className="w-80 space-y-2">
			<Disclosure id="item-1" className="rounded border">
				<Disclosure.Trigger className="w-full p-4 text-left font-medium">
					What is your refund policy?
				</Disclosure.Trigger>
				<Disclosure.Panel>
					<p className="px-4 pb-4 text-sm text-gray-600">
						We offer a 30-day money-back guarantee on all purchases. If you're not satisfied with
						your purchase, contact our support team for a full refund.
					</p>
				</Disclosure.Panel>
			</Disclosure>
			<Disclosure id="item-2" className="rounded border">
				<Disclosure.Trigger className="w-full p-4 text-left font-medium">
					How do I track my order?
				</Disclosure.Trigger>
				<Disclosure.Panel>
					<p className="px-4 pb-4 text-sm text-gray-600">
						Once your order ships, you'll receive an email with a tracking number. You can use this
						number on our website or the carrier's site to track your package.
					</p>
				</Disclosure.Panel>
			</Disclosure>
			<Disclosure id="item-3" className="rounded border">
				<Disclosure.Trigger className="w-full p-4 text-left font-medium">
					Do you ship internationally?
				</Disclosure.Trigger>
				<Disclosure.Panel>
					<p className="px-4 pb-4 text-sm text-gray-600">
						Yes, we ship to over 100 countries worldwide. Shipping costs and delivery times vary by
						location. Check our shipping page for more details.
					</p>
				</Disclosure.Panel>
			</Disclosure>
		</Disclosure.Group>
	),
};

export const AccordionSingleExpand: Story = {
	render: () => (
		<Disclosure.Group allowsMultipleExpanded={false} className="w-80 space-y-2">
			<Disclosure id="section-1" className="rounded border">
				<Disclosure.Trigger className="w-full p-4 text-left font-medium">
					Section 1
				</Disclosure.Trigger>
				<Disclosure.Panel>
					<p className="px-4 pb-4 text-sm text-gray-600">
						Content for section 1. When you open another section, this one will close automatically.
					</p>
				</Disclosure.Panel>
			</Disclosure>
			<Disclosure id="section-2" className="rounded border">
				<Disclosure.Trigger className="w-full p-4 text-left font-medium">
					Section 2
				</Disclosure.Trigger>
				<Disclosure.Panel>
					<p className="px-4 pb-4 text-sm text-gray-600">
						Content for section 2. Only one section can be expanded at a time in this accordion.
					</p>
				</Disclosure.Panel>
			</Disclosure>
			<Disclosure id="section-3" className="rounded border">
				<Disclosure.Trigger className="w-full p-4 text-left font-medium">
					Section 3
				</Disclosure.Trigger>
				<Disclosure.Panel>
					<p className="px-4 pb-4 text-sm text-gray-600">
						Content for section 3. This creates a true accordion behavior.
					</p>
				</Disclosure.Panel>
			</Disclosure>
		</Disclosure.Group>
	),
};

export const WithIcons: Story = {
	render: () => (
		<Disclosure.Group className="w-80 space-y-2">
			<Disclosure id="settings" className="rounded border">
				<Disclosure.Trigger className="flex w-full items-center gap-2 p-4 text-left font-medium">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
					Settings
				</Disclosure.Trigger>
				<Disclosure.Panel>
					<div className="px-4 pb-4 pl-10 text-sm text-gray-600">
						<p>Configure your application settings.</p>
					</div>
				</Disclosure.Panel>
			</Disclosure>
			<Disclosure id="security" className="rounded border">
				<Disclosure.Trigger className="flex w-full items-center gap-2 p-4 text-left font-medium">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
					</svg>
					Security
				</Disclosure.Trigger>
				<Disclosure.Panel>
					<div className="px-4 pb-4 pl-10 text-sm text-gray-600">
						<p>Manage your security and privacy settings.</p>
					</div>
				</Disclosure.Panel>
			</Disclosure>
			<Disclosure id="notifications" className="rounded border">
				<Disclosure.Trigger className="flex w-full items-center gap-2 p-4 text-left font-medium">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
						<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
					</svg>
					Notifications
				</Disclosure.Trigger>
				<Disclosure.Panel>
					<div className="px-4 pb-4 pl-10 text-sm text-gray-600">
						<p>Choose what notifications you want to receive.</p>
					</div>
				</Disclosure.Panel>
			</Disclosure>
		</Disclosure.Group>
	),
};

export const Disabled: Story = {
	render: () => (
		<Disclosure.Group className="w-80 space-y-2">
			<Disclosure id="enabled" className="rounded border">
				<Disclosure.Trigger className="w-full p-4 text-left font-medium">
					Enabled Item
				</Disclosure.Trigger>
				<Disclosure.Panel>
					<p className="px-4 pb-4 text-sm text-gray-600">This disclosure can be toggled.</p>
				</Disclosure.Panel>
			</Disclosure>
			<Disclosure id="disabled" isDisabled className="rounded border opacity-50">
				<Disclosure.Trigger className="w-full p-4 text-left font-medium">
					Disabled Item
				</Disclosure.Trigger>
				<Disclosure.Panel>
					<p className="px-4 pb-4 text-sm text-gray-600">This content is not accessible.</p>
				</Disclosure.Panel>
			</Disclosure>
			<Disclosure id="another" className="rounded border">
				<Disclosure.Trigger className="w-full p-4 text-left font-medium">
					Another Enabled Item
				</Disclosure.Trigger>
				<Disclosure.Panel>
					<p className="px-4 pb-4 text-sm text-gray-600">This disclosure can also be toggled.</p>
				</Disclosure.Panel>
			</Disclosure>
		</Disclosure.Group>
	),
};
