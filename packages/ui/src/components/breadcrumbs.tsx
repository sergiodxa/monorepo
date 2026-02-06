import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import {
	Breadcrumbs as AriaBreadcrumbs,
	Breadcrumb as AriaBreadcrumb,
	Link,
} from "react-aria-components";

export namespace Breadcrumbs {
	export interface Props<T extends object> extends Omit<
		ComponentProps<typeof AriaBreadcrumbs<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}
}

export function Breadcrumbs<T extends object>({ className, ...props }: Breadcrumbs.Props<T>) {
	return <AriaBreadcrumbs {...props} className={cn("ui-breadcrumbs", className)} />;
}

export namespace Breadcrumb {
	export interface Props extends Omit<ComponentProps<typeof AriaBreadcrumb>, "className"> {
		className?: cn.ClassName;
	}
}

export function Breadcrumb({ className, ...props }: Breadcrumb.Props) {
	return <AriaBreadcrumb {...props} className={cn("ui-breadcrumb", className)} />;
}

export namespace BreadcrumbLink {
	export interface Props extends Omit<ComponentProps<typeof Link>, "className"> {
		className?: cn.ClassName;
	}
}

export function BreadcrumbLink({ className, ...props }: BreadcrumbLink.Props) {
	return <Link {...props} className={cn("ui-breadcrumb-link", className)} />;
}
