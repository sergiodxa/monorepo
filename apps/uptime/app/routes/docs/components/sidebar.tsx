/**
 * Presentational sidebar component for the documentation site. It renders the docs
 * title, a search field, and either flat search results or docs grouped by section
 * as navigation links, with an optional close button for mobile. It is a controlled
 * component: search value, results, and close behavior are supplied via props.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, NavLink, ScrollArea, SearchField, Separator, Text } from "@pkg/ui";
import { X } from "lucide-react";

import type { DocSection } from "~/modules/docs";

export namespace Sidebar {
	export interface Props {
		sections: DocSection[];
		search: string;
		onSearchChange(value: string): void;
		searchResults: DocSection["docs"] | null;
		searchPlaceholder: string;
		title: string;
		description: string;
		onClose?(): void;
		closeLabel?: string;
	}
}

export function Sidebar({
	sections,
	search,
	onSearchChange,
	searchResults,
	searchPlaceholder,
	title,
	description,
	onClose,
	closeLabel,
}: Sidebar.Props) {
	return (
		<div className="flex h-full flex-col">
			<div className="flex items-start justify-between p-4">
				<div className="flex flex-col">
					<Text className="text-lg font-semibold">{title}</Text>
					<Text className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</Text>
				</div>
				{onClose && (
					<Button variant="ghost" size="sm" onPress={onClose} aria-label={closeLabel}>
						<X className="size-5" />
					</Button>
				)}
			</div>

			<Separator className="border-neutral-200 dark:border-neutral-800" />

			<div className="p-4 dark:border-neutral-800">
				<SearchField value={search} onChange={onSearchChange}>
					<SearchField.Input placeholder={searchPlaceholder} />
				</SearchField>
			</div>

			<ScrollArea className="min-h-0 flex-1 border-0">
				<ScrollArea.Viewport className="p-4">
					{searchResults ? (
						<nav>
							<ul className="flex flex-col gap-y-1">
								{searchResults.map((doc) => (
									<li key={doc.path}>
										<NavLink
											to={doc.path}
											hasBackground
											onClick={onClose}
											className={({ isActive }) => [
												"block rounded-md px-2 py-1.5 text-sm transition-colors",
												isActive
													? "bg-primary-100 font-medium text-primary-700 dark:bg-primary-900 dark:text-primary-300"
													: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
											]}
										>
											{doc.frontmatter.title}
										</NavLink>
									</li>
								))}
							</ul>
						</nav>
					) : (
						<nav className="flex flex-col gap-y-6">
							{sections.map((section) => (
								<div key={section.title} className="flex flex-col gap-2">
									<Text className="text-xs font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
										{section.title}
									</Text>
									<ul className="flex flex-col gap-y-1">
										{section.docs.map((doc) => (
											<li key={doc.path}>
												<NavLink
													to={doc.path}
													hasBackground
													onClick={onClose}
													className={({ isActive }) => [
														"block rounded-md px-2 py-1.5 text-sm transition-colors",
														isActive
															? "bg-primary-100 font-medium text-primary-700 dark:bg-primary-900 dark:text-primary-300"
															: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
													]}
												>
													{doc.frontmatter.title}
												</NavLink>
											</li>
										))}
									</ul>
								</div>
							))}
						</nav>
					)}
				</ScrollArea.Viewport>
			</ScrollArea>
		</div>
	);
}
