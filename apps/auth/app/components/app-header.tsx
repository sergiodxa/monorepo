/**
 * AppHeader component for the auth app. Renders a sticky page header with an
 * optional breadcrumb trail, a heading, and an optional right-aligned actions
 * area, giving the account and admin pages a consistent top bar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ReactNode } from "react";

import { Breadcrumb, BreadcrumbLink, Breadcrumbs } from "@pkg/ui";

export interface Crumb {
	label: string;
	href?: string;
}

export function AppHeader(props: { heading: string; breadcrumbs?: Crumb[]; children?: ReactNode }) {
	return (
		<header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50/80 px-4 dark:border-neutral-800 dark:bg-neutral-950/80">
			<div className="flex flex-col justify-center gap-0.5">
				{props.breadcrumbs && props.breadcrumbs.length > 0 && (
					<Breadcrumbs className="text-xs">
						{props.breadcrumbs.map((crumb, index) => {
							let isLast = index === props.breadcrumbs!.length - 1;
							return (
								<Breadcrumb key={crumb.href ?? index} className={isLast ? "" : "max-md:hidden"}>
									<BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
								</Breadcrumb>
							);
						})}
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
