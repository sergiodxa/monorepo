/**
 * Live preview island for `NavigationMenu`. Each trigger pairs with the panel nested
 * beside it through the item's own context, so the whole menu opens and closes on the
 * Popover API with no script. The example is a marketing header: a wide two-column
 * panel, a narrower list panel, plain links, and the current page marked `aria-current`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { NavigationMenu } from "@sdxc/ui";
import { clientEntry } from "remix/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<NavigationMenu aria-label="Primary">
	<NavigationMenu.List>
		<NavigationMenu.Item>
			<NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
			<NavigationMenu.Content size="wide">
				<NavigationMenu.ContentGrid>
					<NavigationMenu.ContentColumn>
						<NavigationMenu.Link href="/products/uptime">Uptime monitoring</NavigationMenu.Link>
						<NavigationMenu.Link href="/products/status">Status pages</NavigationMenu.Link>
						<NavigationMenu.Link href="/products/alerts">On-call alerting</NavigationMenu.Link>
					</NavigationMenu.ContentColumn>
					<NavigationMenu.ContentColumn>
						<NavigationMenu.Link href="/products/auth">Hosted auth</NavigationMenu.Link>
						<NavigationMenu.Link href="/products/analytics">Analytics</NavigationMenu.Link>
						<NavigationMenu.Link href="/products/changelog">Changelog hosting</NavigationMenu.Link>
					</NavigationMenu.ContentColumn>
				</NavigationMenu.ContentGrid>
			</NavigationMenu.Content>
		</NavigationMenu.Item>

		<NavigationMenu.Item>
			<NavigationMenu.Trigger>Developers</NavigationMenu.Trigger>
			<NavigationMenu.Content>
				<NavigationMenu.ContentList>
					<NavigationMenu.Link href="/docs">Documentation</NavigationMenu.Link>
					<NavigationMenu.Link href="/api/ui">Component catalogue</NavigationMenu.Link>
					<NavigationMenu.Link href="/api">Packages</NavigationMenu.Link>
					<NavigationMenu.Link href="https://github.com/sergiodxa" target="_blank" rel="noreferrer">
						Source on GitHub
					</NavigationMenu.Link>
				</NavigationMenu.ContentList>
			</NavigationMenu.Content>
		</NavigationMenu.Item>

		<NavigationMenu.Item>
			<NavigationMenu.Link href="/pricing">Pricing</NavigationMenu.Link>
		</NavigationMenu.Item>

		<NavigationMenu.Item>
			<NavigationMenu.Link href="/api/ui/navigation-menu" aria-current="page">
				Catalogue
			</NavigationMenu.Link>
		</NavigationMenu.Item>

		<NavigationMenu.Item>
			<NavigationMenu.Trigger aria-disabled="true">Enterprise</NavigationMenu.Trigger>
			<NavigationMenu.Content>
				<NavigationMenu.ContentList>
					<NavigationMenu.Link href="/enterprise">Talk to sales</NavigationMenu.Link>
				</NavigationMenu.ContentList>
			</NavigationMenu.Content>
		</NavigationMenu.Item>
	</NavigationMenu.List>
</NavigationMenu>`;

/** A marketing header's primary navigation, hydrated so the page loads this chunk alone. */
export const NavigationMenuPreview = clientEntry(
	"/resources/components/previews/navigation-menu.tsx#NavigationMenuPreview",
	function NavigationMenuPreview() {
		return () => (
			<NavigationMenu aria-label="Primary">
				<NavigationMenu.List>
					<NavigationMenu.Item>
						<NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
						<NavigationMenu.Content size="wide">
							<NavigationMenu.ContentGrid>
								<NavigationMenu.ContentColumn>
									<NavigationMenu.Link href="/products/uptime">
										Uptime monitoring
									</NavigationMenu.Link>
									<NavigationMenu.Link href="/products/status">Status pages</NavigationMenu.Link>
									<NavigationMenu.Link href="/products/alerts">
										On-call alerting
									</NavigationMenu.Link>
								</NavigationMenu.ContentColumn>
								<NavigationMenu.ContentColumn>
									<NavigationMenu.Link href="/products/auth">Hosted auth</NavigationMenu.Link>
									<NavigationMenu.Link href="/products/analytics">Analytics</NavigationMenu.Link>
									<NavigationMenu.Link href="/products/changelog">
										Changelog hosting
									</NavigationMenu.Link>
								</NavigationMenu.ContentColumn>
							</NavigationMenu.ContentGrid>
						</NavigationMenu.Content>
					</NavigationMenu.Item>

					<NavigationMenu.Item>
						<NavigationMenu.Trigger>Developers</NavigationMenu.Trigger>
						<NavigationMenu.Content>
							<NavigationMenu.ContentList>
								<NavigationMenu.Link href="/docs">Documentation</NavigationMenu.Link>
								<NavigationMenu.Link href="/api/ui">Component catalogue</NavigationMenu.Link>
								<NavigationMenu.Link href="/api">Packages</NavigationMenu.Link>
								<NavigationMenu.Link
									href="https://github.com/sergiodxa"
									target="_blank"
									rel="noreferrer"
								>
									Source on GitHub
								</NavigationMenu.Link>
							</NavigationMenu.ContentList>
						</NavigationMenu.Content>
					</NavigationMenu.Item>

					<NavigationMenu.Item>
						<NavigationMenu.Link href="/pricing">Pricing</NavigationMenu.Link>
					</NavigationMenu.Item>

					<NavigationMenu.Item>
						<NavigationMenu.Link href="/api/ui/navigation-menu" aria-current="page">
							Catalogue
						</NavigationMenu.Link>
					</NavigationMenu.Item>

					<NavigationMenu.Item>
						<NavigationMenu.Trigger aria-disabled="true">Enterprise</NavigationMenu.Trigger>
						<NavigationMenu.Content>
							<NavigationMenu.ContentList>
								<NavigationMenu.Link href="/enterprise">Talk to sales</NavigationMenu.Link>
							</NavigationMenu.ContentList>
						</NavigationMenu.Content>
					</NavigationMenu.Item>
				</NavigationMenu.List>
			</NavigationMenu>
		);
	},
);

export default { code: CODE, render: () => <NavigationMenuPreview /> };
