/**
 * One sidebar tree as a list of links: each section's own entries, then its groups, each
 * a title over its entries, all expanded so the whole tree is scannable at once. It is
 * drawn twice per page, in the docked rail and the drawer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { flex, items } from "@sdxc/u/layout";
import { minBs, pb, pi } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Sidebar } from "@sdxc/ui";

import type { NavGroup, NavTree } from "~/app/services/navigation-tree";

namespace DocsNav {
	export interface Props {
		tree: NavTree;
		/** The path of the page being read, which is what marks one link as current. */
		activePath: string;
	}
}

/** Renders every section of the tree under its label, in reading order. */
export default function DocsNav(handle: Handle<DocsNav.Props>) {
	return () => {
		let { activePath, tree } = handle.props;

		return (
			<Sidebar.Nav aria-label={tree.label}>
				{tree.sections.map((section) => (
					<Sidebar.Group key={section.title}>
						<Sidebar.GroupLabel>{section.title}</Sidebar.GroupLabel>
						<Sidebar.Menu>
							{section.entries.map((entry) => (
								<Sidebar.MenuItem key={entry.href}>
									<Sidebar.MenuLink href={entry.href} active={entry.href === activePath}>
										{entry.title}
									</Sidebar.MenuLink>
								</Sidebar.MenuItem>
							))}

							{section.groups.map((group) => (
								<NavGroupItem key={group.title} group={group} activePath={activePath} />
							))}
						</Sidebar.Menu>
					</Sidebar.Group>
				))}
			</Sidebar.Nav>
		);
	};
}

namespace NavGroupItem {
	export interface Props {
		group: NavGroup;
		/** The path of the page being read, which is what marks one link as current. */
		activePath: string;
	}
}

/** Renders one group of the tree as its title over its entries, always expanded. */
function NavGroupItem(handle: Handle<NavGroupItem.Props>) {
	return () => {
		let { activePath, group } = handle.props;

		return (
			<Sidebar.MenuItem>
				<span
					mix={[
						flex(),
						items("center"),
						minBs("2.25rem"),
						pi("0.625rem"),
						pb("0.375rem"),
						text("sm"),
					]}
				>
					{group.title}
				</span>

				<Sidebar.MenuSub style={{ marginInlineStart: "0.625rem", paddingInlineStart: "0.25rem" }}>
					{group.entries.map((entry) => (
						<Sidebar.MenuSubItem key={entry.href}>
							<Sidebar.MenuSubLink href={entry.href} active={entry.href === activePath}>
								{entry.title}
							</Sidebar.MenuSubLink>
						</Sidebar.MenuSubItem>
					))}
				</Sidebar.MenuSub>
			</Sidebar.MenuItem>
		);
	};
}
