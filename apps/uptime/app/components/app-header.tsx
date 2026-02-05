import type { ReactNode } from "react";

import { PanelLeftIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { useToggleSidebarStatus } from "~/hooks/use-sidebar-status";

export function AppHeader(props: { heading: string; children?: ReactNode }) {
	let toggleSidebar = useToggleSidebarStatus();

	return (
		<header className="flex h-16 flex-shrink-0 items-center gap-2 px-4 border-b border-neutral-300 dark:border-neutral-700 sticky top-0 z-10 bg-neutral-50/80 dark:bg-neutral-950/80">
			<Button type="button" onPress={() => toggleSidebar()} className="p-2 lg:hidden mr-2">
				<PanelLeftIcon aria-hidden className="size-4" />
				<span className="sr-only">Toggle sidebar</span>
			</Button>

			<h1>{props.heading}</h1>

			{props.children && (
				<aside className="ml-auto flex items-center gap-2">{props.children}</aside>
			)}
		</header>
	);
}
