import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";
import type { LinkProps as ReactRouterLinkProps } from "react-router";

import { cn as classNames } from "@pkg/cn";
import { useState } from "react";
import { Link as AriaLink } from "react-aria-components";
import { PrefetchPageLinks } from "react-router";

export namespace Link {
	export type Color = "primary" | "neutral" | "danger" | "warning" | "success";

	export interface Props extends Omit<ComponentProps<typeof AriaLink>, "className"> {
		/** The color scheme of the link */
		color?: Color;
		/** Prefetch behavior for React Router integration */
		prefetch?: ReactRouterLinkProps["prefetch"];
		className?: cn.ClassName;
	}
}

/**
 * Link component with React Router integration.
 *
 * Requires RouterProvider from react-aria-components wrapping your app
 * to enable client-side navigation with the href prop.
 *
 * @example
 * ```tsx
 * <Link href="/about">About</Link>
 * <Link href="/delete" color="danger">Delete</Link>
 * <Link href="/settings" prefetch="intent">Settings</Link>
 * ```
 */
export function Link({ className, color = "primary", prefetch, ...props }: Link.Props) {
	let [shouldPrefetch, setShouldPrefetch] = useState(false);

	return (
		<>
			<AriaLink
				{...props}
				data-color={color}
				className={classNames("ui-link", className)}
				onHoverStart={(e) => {
					setShouldPrefetch(true);
					props.onHoverStart?.(e);
				}}
				onHoverEnd={(e) => {
					setShouldPrefetch(false);
					props.onHoverEnd?.(e);
				}}
			/>
			{props.href && prefetch === "render" && <PrefetchPageLinks page={props.href} />}
			{props.href && shouldPrefetch && prefetch === "intent" && (
				<PrefetchPageLinks page={props.href} />
			)}
		</>
	);
}
