import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";
import type { LinkProps } from "react-aria-components";

import { cn as classNames } from "@pkg/cn";
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
	return <AriaBreadcrumbs {...props} className={classNames("ui-breadcrumbs", className)} />;
}

export namespace Breadcrumb {
	export interface Props extends Omit<ComponentProps<typeof AriaBreadcrumb>, "className"> {
		href?: LinkProps["href"];
		className?: cn.ClassName;
	}
}

export function Breadcrumb({ className, children, href, ...props }: Breadcrumb.Props) {
	return (
		<AriaBreadcrumb {...props} className={classNames("ui-breadcrumb", className)}>
			{(renderProps) => (
				<Link href={href} className="ui-breadcrumb-link">
					{typeof children === "function" ? children(renderProps) : children}
				</Link>
			)}
		</AriaBreadcrumb>
	);
}
