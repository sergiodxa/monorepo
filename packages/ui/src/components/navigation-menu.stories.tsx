import type { Meta, StoryObj } from "@storybook/react";

import { NavigationMenu } from "./navigation-menu";

type StoryArgs = {
	orientation: "horizontal" | "vertical";
};

const meta: Meta<StoryArgs> = {
	title: "Navigation/NavigationMenu",
	component: NavigationMenu as unknown as Meta<StoryArgs>["component"],
	args: {
		orientation: "horizontal",
	},
	argTypes: {
		orientation: { control: "select", options: ["horizontal", "vertical"] },
	},
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
	render: ({ orientation }) => (
		<NavigationMenu>
			<NavigationMenu.List orientation={orientation}>
				<NavigationMenu.Item>
					<NavigationMenu.Link href="#">Overview</NavigationMenu.Link>
				</NavigationMenu.Item>
				<NavigationMenu.Item>
					<NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
					<NavigationMenu.Content>
						<div className="grid gap-2">
							<NavigationMenu.Link href="#">Analytics</NavigationMenu.Link>
							<NavigationMenu.Link href="#">Automation</NavigationMenu.Link>
							<NavigationMenu.Link href="#">Integrations</NavigationMenu.Link>
						</div>
					</NavigationMenu.Content>
				</NavigationMenu.Item>
				<NavigationMenu.Item>
					<NavigationMenu.Link href="#">Pricing</NavigationMenu.Link>
				</NavigationMenu.Item>
				<NavigationMenu.Item>
					<NavigationMenu.Link href="#">Docs</NavigationMenu.Link>
				</NavigationMenu.Item>
			</NavigationMenu.List>
		</NavigationMenu>
	),
};

export const MegaMenu: Story = {
	render: () => (
		<NavigationMenu>
			<NavigationMenu.List>
				<NavigationMenu.Item>
					<NavigationMenu.Trigger>Resources</NavigationMenu.Trigger>
					<NavigationMenu.Content>
						<div className="grid w-[28rem] grid-cols-2 gap-3">
							<div className="space-y-1">
								<NavigationMenu.Link href="#">Getting Started</NavigationMenu.Link>
								<NavigationMenu.Link href="#">Guides</NavigationMenu.Link>
								<NavigationMenu.Link href="#">API Reference</NavigationMenu.Link>
							</div>
							<div className="space-y-1">
								<NavigationMenu.Link href="#">Changelog</NavigationMenu.Link>
								<NavigationMenu.Link href="#">Community</NavigationMenu.Link>
								<NavigationMenu.Link href="#">Support</NavigationMenu.Link>
							</div>
						</div>
					</NavigationMenu.Content>
				</NavigationMenu.Item>
			</NavigationMenu.List>
		</NavigationMenu>
	),
};
