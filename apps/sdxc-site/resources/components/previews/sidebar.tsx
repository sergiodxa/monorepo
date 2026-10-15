/**
 * Live preview island for `Sidebar`. The shell is the whole component — a rail beside
 * an inset — so the example composes the real thing: a branded header, two labeled
 * groups of links with badges and a nested sub-menu, a footer account row, and page
 * content in the inset.
 *
 * Collapsing rides `Sidebar.Trigger`'s own checkbox, which every collapse rule in
 * `Sidebar.Provider` reads through `:has()`, and `persist(key)` mirrors that checkbox
 * into a cookie so a fresh load renders the rail as it was left. This page is itself
 * a sidebar shell, and the outer shell reads any checked trigger beneath it, so the
 * collapse belongs on a page that owns its own shell rather than in this frame.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	BookOpenIcon,
	ChartLineIcon,
	CircleAlertIcon,
	LayoutDashboardIcon,
	SettingsIcon,
	UserIcon,
} from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { bs, is, minBs, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Button, Heading, HeadingScope, Sidebar, Text } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const SIDEBAR_CODE = `<Sidebar.Provider>
	<Sidebar collapsible="none">
		<Sidebar.Header>
			<span>Acme Status</span>
		</Sidebar.Header>

		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuLink href="/examples/dashboard" active>
								<LayoutDashboardIcon aria-hidden="true" />
								<span data-sidebar-collapsed-hide>Dashboard</span>
							</Sidebar.MenuLink>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem>
							<Sidebar.MenuLink href="/examples/incidents">
								<CircleAlertIcon aria-hidden="true" />
								<span data-sidebar-collapsed-hide>Incidents</span>
								<Sidebar.MenuBadge>3</Sidebar.MenuBadge>
							</Sidebar.MenuLink>
							<Sidebar.MenuSub>
								<Sidebar.MenuSubItem>
									<Sidebar.MenuSubLink href="/examples/incidents/open" active>
										Open
									</Sidebar.MenuSubLink>
								</Sidebar.MenuSubItem>
								<Sidebar.MenuSubItem>
									<Sidebar.MenuSubLink href="/examples/incidents/resolved">Resolved</Sidebar.MenuSubLink>
								</Sidebar.MenuSubItem>
							</Sidebar.MenuSub>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem>
							<Sidebar.MenuLink href="/examples/reports">
								<ChartLineIcon aria-hidden="true" />
								<span data-sidebar-collapsed-hide>Reports</span>
							</Sidebar.MenuLink>
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>

			<Sidebar.Separator />

			<Sidebar.Group>
				<Sidebar.GroupLabel>Resources</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuLink href="/docs">
								<BookOpenIcon aria-hidden="true" />
								<span data-sidebar-collapsed-hide>Documentation</span>
							</Sidebar.MenuLink>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem>
							<Sidebar.MenuLink href="/examples/settings">
								<SettingsIcon aria-hidden="true" />
								<span data-sidebar-collapsed-hide>Settings</span>
							</Sidebar.MenuLink>
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>

		<Sidebar.Footer>
			<Sidebar.MenuButton>
				<UserIcon aria-hidden="true" />
				<span data-sidebar-collapsed-hide>sergio@aside.co</span>
			</Sidebar.MenuButton>
		</Sidebar.Footer>
	</Sidebar>

	<Sidebar.Inset>
		<HeadingScope>
			<Heading>Dashboard</Heading>
		</HeadingScope>
		<Text>Every monitor reporting, last checked a minute ago.</Text>
		<Button variant="outline" size="sm">Run every check now</Button>
	</Sidebar.Inset>
</Sidebar.Provider>`;

/** A full application shell — rail, groups, sub-menu, footer and inset — hydrated with the page. */
export const SidebarPreview = clientEntry(import.meta.url, function SidebarPreview() {
	return () => (
		<Sidebar.Provider
			/*
			 * Tall enough for the whole tree and narrow enough in the rail that the page
			 * beside it still reads as a page: a shell cropped to a scrolling rail and a
			 * sliver of content shows neither half of what it is for.
			 */
			style={{ "--sidebar-width": "13rem" }}
			mix={[is("100%"), bs("35rem"), minBs("0")]}
		>
			<Sidebar collapsible="none">
				<Sidebar.Header>
					<span mix={[text("sm"), weight("semibold")]}>Acme Status</span>
				</Sidebar.Header>

				<Sidebar.Content>
					<Sidebar.Group>
						<Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
						<Sidebar.GroupContent>
							<Sidebar.Menu>
								<Sidebar.MenuItem>
									<Sidebar.MenuLink href="/examples/dashboard" active>
										<LayoutDashboardIcon aria-hidden="true" />
										<span data-sidebar-collapsed-hide>Dashboard</span>
									</Sidebar.MenuLink>
								</Sidebar.MenuItem>
								<Sidebar.MenuItem>
									<Sidebar.MenuLink href="/examples/incidents">
										<CircleAlertIcon aria-hidden="true" />
										<span data-sidebar-collapsed-hide>Incidents</span>
										<Sidebar.MenuBadge>3</Sidebar.MenuBadge>
									</Sidebar.MenuLink>
									<Sidebar.MenuSub>
										<Sidebar.MenuSubItem>
											<Sidebar.MenuSubLink href="/examples/incidents/open" active>
												Open
											</Sidebar.MenuSubLink>
										</Sidebar.MenuSubItem>
										<Sidebar.MenuSubItem>
											<Sidebar.MenuSubLink href="/examples/incidents/resolved">
												Resolved
											</Sidebar.MenuSubLink>
										</Sidebar.MenuSubItem>
									</Sidebar.MenuSub>
								</Sidebar.MenuItem>
								<Sidebar.MenuItem>
									<Sidebar.MenuLink href="/examples/reports">
										<ChartLineIcon aria-hidden="true" />
										<span data-sidebar-collapsed-hide>Reports</span>
									</Sidebar.MenuLink>
								</Sidebar.MenuItem>
							</Sidebar.Menu>
						</Sidebar.GroupContent>
					</Sidebar.Group>

					<Sidebar.Separator />

					<Sidebar.Group>
						<Sidebar.GroupLabel>Resources</Sidebar.GroupLabel>
						<Sidebar.GroupContent>
							<Sidebar.Menu>
								<Sidebar.MenuItem>
									<Sidebar.MenuLink href="/docs">
										<BookOpenIcon aria-hidden="true" />
										<span data-sidebar-collapsed-hide>Documentation</span>
									</Sidebar.MenuLink>
								</Sidebar.MenuItem>
								<Sidebar.MenuItem>
									<Sidebar.MenuLink href="/examples/settings">
										<SettingsIcon aria-hidden="true" />
										<span data-sidebar-collapsed-hide>Settings</span>
									</Sidebar.MenuLink>
								</Sidebar.MenuItem>
							</Sidebar.Menu>
						</Sidebar.GroupContent>
					</Sidebar.Group>
				</Sidebar.Content>

				<Sidebar.Footer>
					<Sidebar.MenuButton>
						<UserIcon aria-hidden="true" />
						<span data-sidebar-collapsed-hide>sergio@aside.co</span>
					</Sidebar.MenuButton>
				</Sidebar.Footer>
			</Sidebar>

			<Sidebar.Inset>
				<div mix={[vstack({ gap: 3, align: "start" }), p(6)]}>
					<HeadingScope>
						<Heading mix={[text("xl"), weight("semibold")]}>Dashboard</Heading>
					</HeadingScope>
					<Text>Every monitor reporting, last checked a minute ago.</Text>
					<Button variant="outline" size="sm">
						Run every check now
					</Button>
				</div>
			</Sidebar.Inset>
		</Sidebar.Provider>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SIDEBAR_CODE, flush: true, render: () => <SidebarPreview /> };
