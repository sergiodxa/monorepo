import type { Meta, StoryObj } from "@storybook/react";

import { Plus } from "lucide-react";

import { Logo } from "./logo";

const meta: Meta<typeof Logo> = {
	title: "Utility/Logo",
	component: Logo,
	argTypes: {
		size: {
			control: "select",
			options: ["sm", "md", "lg"],
		},
	},
	args: {
		size: "md",
	},
};

export default meta;
type Story = StoryObj<typeof Logo>;

export const Default: Story = {
	render: (args) => (
		<Logo {...args}>
			<Logo.Image
				src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Unofficial_JavaScript_logo_2.svg/480px-Unofficial_JavaScript_logo_2.svg.png"
				alt="JavaScript Logo"
			/>
			<Logo.Fallback>JS</Logo.Fallback>
		</Logo>
	),
};

export const WithFallback: Story = {
	render: (args) => (
		<Logo {...args}>
			<Logo.Image src="" alt="Unknown Logo" />
			<Logo.Fallback>??</Logo.Fallback>
		</Logo>
	),
};

export const FallbackOnly: Story = {
	render: (args) => (
		<Logo {...args}>
			<Logo.Fallback>TS</Logo.Fallback>
		</Logo>
	),
};

export const WithBadge: Story = {
	render: (args) => (
		<Logo {...args}>
			<Logo.Image
				src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Unofficial_JavaScript_logo_2.svg/480px-Unofficial_JavaScript_logo_2.svg.png"
				alt="JavaScript Logo"
			/>
			<Logo.Fallback>JS</Logo.Fallback>
			<Logo.Badge className="bg-green-500" />
		</Logo>
	),
};

export const BadgeWithIcon: Story = {
	render: (args) => (
		<Logo {...args}>
			<Logo.Image
				src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Typescript_logo_2020.svg/512px-Typescript_logo_2020.svg.png"
				alt="TypeScript Logo"
			/>
			<Logo.Fallback>TS</Logo.Fallback>
			<Logo.Badge className="flex items-center justify-center bg-primary-500">
				<Plus className="size-2 text-white" />
			</Logo.Badge>
		</Logo>
	),
};

export const Sizes: Story = {
	render: () => (
		<div className="flex items-center gap-4">
			<Logo size="sm">
				<Logo.Image
					src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Unofficial_JavaScript_logo_2.svg/480px-Unofficial_JavaScript_logo_2.svg.png"
					alt="Small"
				/>
				<Logo.Fallback>SM</Logo.Fallback>
			</Logo>
			<Logo size="md">
				<Logo.Image
					src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Unofficial_JavaScript_logo_2.svg/480px-Unofficial_JavaScript_logo_2.svg.png"
					alt="Medium"
				/>
				<Logo.Fallback>MD</Logo.Fallback>
			</Logo>
			<Logo size="lg">
				<Logo.Image
					src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Unofficial_JavaScript_logo_2.svg/480px-Unofficial_JavaScript_logo_2.svg.png"
					alt="Large"
				/>
				<Logo.Fallback>LG</Logo.Fallback>
			</Logo>
		</div>
	),
};

export const Group: Story = {
	render: () => (
		<Logo.Group>
			<Logo>
				<Logo.Image
					src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Unofficial_JavaScript_logo_2.svg/480px-Unofficial_JavaScript_logo_2.svg.png"
					alt="JavaScript"
				/>
				<Logo.Fallback>JS</Logo.Fallback>
			</Logo>
			<Logo>
				<Logo.Image
					src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Typescript_logo_2020.svg/512px-Typescript_logo_2020.svg.png"
					alt="TypeScript"
				/>
				<Logo.Fallback>TS</Logo.Fallback>
			</Logo>
			<Logo>
				<Logo.Image
					src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/512px-React-icon.svg.png"
					alt="React"
				/>
				<Logo.Fallback>Re</Logo.Fallback>
			</Logo>
		</Logo.Group>
	),
};

export const GroupWithCount: Story = {
	render: () => (
		<Logo.Group>
			<Logo>
				<Logo.Image
					src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Unofficial_JavaScript_logo_2.svg/480px-Unofficial_JavaScript_logo_2.svg.png"
					alt="JavaScript"
				/>
				<Logo.Fallback>JS</Logo.Fallback>
			</Logo>
			<Logo>
				<Logo.Image
					src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Typescript_logo_2020.svg/512px-Typescript_logo_2020.svg.png"
					alt="TypeScript"
				/>
				<Logo.Fallback>TS</Logo.Fallback>
			</Logo>
			<Logo.Group.Count>+5</Logo.Group.Count>
		</Logo.Group>
	),
};
