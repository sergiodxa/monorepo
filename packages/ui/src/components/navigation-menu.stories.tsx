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
		<NavigationMenu aria-label="Primary">
			<NavigationMenu.List aria-label="Main navigation" orientation={orientation}>
				<NavigationMenu.Item>
					<NavigationMenu.Link href="#">Overview</NavigationMenu.Link>
				</NavigationMenu.Item>
				<NavigationMenu.Item>
					<NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
					<NavigationMenu.Content
						placement={orientation === "vertical" ? "right top" : "bottom start"}
					>
						<div className="ui-navigation-menu-content-list">
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
		<NavigationMenu aria-label="Resources">
			<NavigationMenu.List aria-label="Resources" orientation="horizontal">
				<NavigationMenu.Item>
					<NavigationMenu.Trigger>Resources</NavigationMenu.Trigger>
					<NavigationMenu.Content className="ui-navigation-menu-content-wide">
						<div className="ui-navigation-menu-content-grid">
							<div className="ui-navigation-menu-content-column">
								<NavigationMenu.Link href="#">Getting Started</NavigationMenu.Link>
								<NavigationMenu.Link href="#">Guides</NavigationMenu.Link>
								<NavigationMenu.Link href="#">API Reference</NavigationMenu.Link>
							</div>
							<div className="ui-navigation-menu-content-column">
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
