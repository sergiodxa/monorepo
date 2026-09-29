/**
 * One sidebar tree as a list of links: each section's own entries, then its groups, each
 * of which a reader can fold away once they are done with it. It is drawn twice per
 * page, in the docked rail and the drawer.
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
								<CollapsibleGroup key={group.title} group={group} activePath={activePath} />
							))}
						</Sidebar.Menu>
					</Sidebar.Group>
				))}
			</Sidebar.Nav>
		);
	};
}

namespace CollapsibleGroup {
	export interface Props {
		group: NavGroup;
		/** The path of the page being read, which is what marks one link as current. */
		activePath: string;
	}
}

/** Renders one group of the tree as a disclosure over its entries. */
function CollapsibleGroup(handle: Handle<CollapsibleGroup.Props>) {
	return () => {
		let { activePath, group } = handle.props;

		return (
			<Sidebar.MenuItem>
				{/* Every group starts open, so the whole tree is scannable on the first paint and
				    a reader folds away only what they are done with. Each one folds on its own,
				    so the rail and the drawer never close each other's. */}
				<Disclosure
					open
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

					{/* The rule under a group title starts beneath that title's first letter, so the
					    entries read as indented under it rather than as a column set apart. Both
					    insets replace ones the components set, which is what `style` settles. */}
					<Disclosure.Panel style={{ paddingInline: 0 }}>
						<Sidebar.MenuSub
							style={{ marginInlineStart: "0.625rem", paddingInlineStart: "0.25rem" }}
						>
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
