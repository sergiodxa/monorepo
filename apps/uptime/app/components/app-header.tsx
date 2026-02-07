import type { ReactNode } from "react";

import { Breadcrumb, BreadcrumbLink, Breadcrumbs, Sidebar } from "@pkg/ui";
import { PanelLeftIcon } from "lucide-react";

export interface Crumb {
	label: string;
	href?: string;
}

export function AppHeader(props: { heading: string; breadcrumbs?: Crumb[]; children?: ReactNode }) {
	return (
		<header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50/80 px-4 dark:border-neutral-800 dark:bg-neutral-950/80">
			<Sidebar.Trigger className="mr-2 p-2 md:hidden">
				<PanelLeftIcon aria-hidden className="size-4" />
				<span className="sr-only">Toggle sidebar</span>
			</Sidebar.Trigger>

			<div className="flex flex-col justify-center gap-0.5">
				{props.breadcrumbs && props.breadcrumbs.length > 0 && (
					<Breadcrumbs className="text-xs">
						{props.breadcrumbs.map((crumb, index) => (
							<Breadcrumb key={crumb.href ?? index}>
								<BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
							</Breadcrumb>
						))}
					</Breadcrumbs>
				)}
				<h1 className={props.breadcrumbs ? "text-sm font-medium" : ""}>{props.heading}</h1>
			</div>

			{props.children && (
				<aside className="ml-auto flex items-center gap-2">{props.children}</aside>
			)}
		</header>
	);
}
