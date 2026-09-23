/**
 * The documentation tree as one list of links: the guides under their sections, then
 * the packages under collapsible groups, since sixty leaves opened at once is a wall
 * rather than a tree. It is drawn twice per page, in the docked rail and the drawer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ChevronDownIcon } from "@sdxc/icons";
import { border } from "@sdxc/u/color";
import { rounded, transition, transitionDuration } from "@sdxc/u/effects";
import { justify, shrink } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, minBs, minIs, pb, pi } from "@sdxc/u/size";
import { open, when } from "@sdxc/u/state";
import { rotate } from "@sdxc/u/transform";
import { text } from "@sdxc/u/typography";
import { Disclosure, Sidebar } from "@sdxc/ui";

import type { NavGroup, NavTree } from "~/app/services/navigation-tree";

import routes from "~/routes/web";

namespace DocsNav {
	export interface Props {
		tree: NavTree;
		/** The path of the page being read, which is what marks one link as current. */
		activePath: string;
	}
}

/** Renders every guide under its section, then every package under its group. */
export default function DocsNav(handle: Handle<DocsNav.Props>) {
	return () => {
		let { activePath, tree } = handle.props;
		let packagesPath = routes.docs.packages.index.href();

		return (
			<Sidebar.Nav aria-label="Documentation">
				{tree.guides.map((group) => (
					<Sidebar.Group key={group.title}>
						<Sidebar.GroupLabel>{group.title}</Sidebar.GroupLabel>
						<Sidebar.Menu>
							{group.entries.map((entry) => (
								<Sidebar.MenuItem key={entry.href}>
									<Sidebar.MenuLink href={entry.href} active={entry.href === activePath}>
										{entry.title}
									</Sidebar.MenuLink>
								</Sidebar.MenuItem>
							))}
						</Sidebar.Menu>
					</Sidebar.Group>
				))}

				<Sidebar.Group>
					<Sidebar.GroupLabel>Packages</Sidebar.GroupLabel>
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuLink href={packagesPath} active={activePath === packagesPath}>
								Every package
							</Sidebar.MenuLink>
						</Sidebar.MenuItem>

						{tree.packages.map((group) => (
							<CollapsibleGroup key={group.title} group={group} activePath={activePath} />
						))}
					</Sidebar.Menu>
				</Sidebar.Group>

				{/* The two catalogue packages carry hundreds of pages each, so they read as
				    their own bands under the packages rather than as two entries inside them. */}
				<Sidebar.Group>
					<Sidebar.GroupLabel>@sdxc/u</Sidebar.GroupLabel>
					<Sidebar.Menu>
						{tree.utilities.map((group) => (
							<CollapsibleGroup key={group.title} group={group} activePath={activePath} />
						))}
					</Sidebar.Menu>
				</Sidebar.Group>

				<Sidebar.Group>
					<Sidebar.GroupLabel>@sdxc/ui</Sidebar.GroupLabel>
					<Sidebar.Menu>
						{tree.components.map((entry) => (
							<Sidebar.MenuItem key={entry.href}>
								<Sidebar.MenuLink href={entry.href} active={entry.href === activePath}>
									{entry.title}
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
						))}
					</Sidebar.Menu>
				</Sidebar.Group>
			</Sidebar.Nav>
		);
	};
}

namespace CollapsibleGroup {
	export interface Props {
		group: NavGroup;
		/** The path of the page being read, which is what opens one group and marks one link. */
		activePath: string;
	}
}

/** Renders one group of the tree as a disclosure over its entries. */
function CollapsibleGroup(handle: Handle<CollapsibleGroup.Props>) {
	return () => {
		let { activePath, group } = handle.props;

		return (
			<Sidebar.MenuItem>
				{/* Open state is decided here so the group holding the page being read is
				    already expanded on the first paint, before any script runs. */}
				{/* Each group opens on its own, so the rail and the drawer never
				    close each other's, and the markup stays the same every render. */}
				<Disclosure
					open={group.entries.some((entry) => entry.href === activePath)}
					mix={[
						is("full"),
						minIs("0"),
						border("none"),
						rounded("none"),
						open(when('& summary [data-slot="icon"]', rotate(180))),
					]}
				>
					<Disclosure.Trigger
						mix={[
							justify("between"),
							minBs("2.25rem"),
							pi("0.625rem"),
							pb("0.375rem"),
							text("sm"),
							when('& [data-slot="icon"]', [
								shrink(),
								transition("transform", { duration: "200ms" }),
							]),
							media(
								"(prefers-reduced-motion: reduce)",
								when('& [data-slot="icon"]', transitionDuration("0s")),
							),
						]}
					>
						{group.title}
						<ChevronDownIcon data-slot="icon" size={14} aria-hidden="true" />
					</Disclosure.Trigger>

					<Disclosure.Panel>
						<Sidebar.MenuSub>
							{group.entries.map((entry) => (
								<Sidebar.MenuSubItem key={entry.href}>
									<Sidebar.MenuSubLink href={entry.href} active={entry.href === activePath}>
										{entry.title}
									</Sidebar.MenuSubLink>
								</Sidebar.MenuSubItem>
							))}
						</Sidebar.MenuSub>
					</Disclosure.Panel>
				</Disclosure>
			</Sidebar.MenuItem>
		);
	};
}
