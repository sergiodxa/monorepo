/**
 * Client island: the docs sidebar's search box and navigation list. Typing filters every
 * doc by title into a flat list labelled with each doc's section; clearing it restores the
 * sections in reading order. It is drawn twice per page, in the docked rail and the drawer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { block, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { SearchField, Sidebar } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** One doc link, reduced to the fields the sidebar renders. */
type DocsNavDoc = { path: string; title: string };

/** One sidebar section: a group heading plus the docs under it. */
type DocsNavSection = { title: string; docs: DocsNavDoc[] };

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type DocsNavProps = {
	sections: DocsNavSection[];
	activePath: string;
	/** The navigation landmark's accessible name. */
	label: string;
	searchPlaceholder: string;
	/** Shown in place of the list when a search matches no title. */
	noResults: string;
};

/**
 * Renders {@link DocsNavProps.sections} grouped by section, or a flat filtered list once
 * the visitor types a query. Without script the search box is inert and the full list stays.
 */
export const DocsNav = clientEntry(import.meta.url, function DocsNav(handle: Handle<DocsNavProps>) {
	let search = "";

	return () => {
		let { sections, activePath, label, searchPlaceholder, noResults } = handle.props;
		let query = search.trim().toLowerCase();
		let results =
			query.length > 0
				? sections
						.flatMap((section) => section.docs.map((doc) => ({ ...doc, section: section.title })))
						.filter((doc) => doc.title.toLowerCase().includes(query))
				: null;

		return (
			<div mix={[vstack({ gap: 4 })]}>
				<SearchField aria-label={searchPlaceholder}>
					<SearchField.Input
						value={search}
						placeholder={searchPlaceholder}
						mix={[
							on("input", (event) => {
								search = event.currentTarget.value;
								void handle.update();
							}),
						]}
					/>
				</SearchField>

				<Sidebar.Nav aria-label={label}>
					{results ? (
						<Sidebar.Menu>
							{results.length === 0 ? (
								<li mix={[p(2, 2.5), text("sm"), fg("neutral.muted")]}>{noResults}</li>
							) : null}
							{results.map((doc) => (
								<Sidebar.MenuItem key={doc.path}>
									<Sidebar.MenuLink
										href={doc.path}
										prefetch="intent"
										active={doc.path === activePath}
									>
										<span>
											{doc.title}
											<span mix={[block(), text("xs"), fg("neutral.muted")]}>{doc.section}</span>
										</span>
									</Sidebar.MenuLink>
								</Sidebar.MenuItem>
							))}
						</Sidebar.Menu>
					) : (
						sections.map((section) => (
							<Sidebar.Group key={section.title} mix={[p(0), m(0, 0, 2, 0)]}>
								<Sidebar.GroupLabel>{section.title}</Sidebar.GroupLabel>
								<Sidebar.Menu>
									{section.docs.map((doc) => (
										<Sidebar.MenuItem key={doc.path}>
											<Sidebar.MenuLink
												href={doc.path}
												prefetch="intent"
												active={doc.path === activePath}
											>
												{doc.title}
											</Sidebar.MenuLink>
										</Sidebar.MenuItem>
									))}
								</Sidebar.Menu>
							</Sidebar.Group>
						))
					)}
				</Sidebar.Nav>
			</div>
		);
	};
});

export default DocsNav;
