import type { ReactNode } from "react";

import { Sidebar } from "@pkg/ui";
import { PanelLeftIcon } from "lucide-react";

export function AppHeader(props: { heading: string; children?: ReactNode }) {
	return (
		<header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50/80 px-4 dark:border-neutral-800 dark:bg-neutral-950/80">
			<Sidebar.Trigger className="mr-2 p-2 md:hidden">
				<PanelLeftIcon aria-hidden className="size-4" />
				<span className="sr-only">Toggle sidebar</span>
			</Sidebar.Trigger>

			<h1>{props.heading}</h1>

			{props.children && (
				<aside className="ml-auto flex items-center gap-2">{props.children}</aside>
			)}
		</header>
	);
}
