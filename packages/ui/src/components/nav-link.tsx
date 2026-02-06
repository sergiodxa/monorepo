import type { cn } from "@pkg/cn";
import type { NavLinkProps as ReactRouterNavLinkProps } from "react-router";

import { cn as classNames } from "@pkg/cn";
import { useRef, useState } from "react";
import { NavLink as ReactRouterNavLink, PrefetchPageLinks } from "react-router";

export namespace NavLink {
	export type Color = "primary" | "neutral" | "danger" | "warning" | "success";

	export interface Props extends Omit<ReactRouterNavLinkProps, "className"> {
		/** The color scheme of the nav link */
		color?: Color;
		/** Class name - can be a static value or a function receiving active/pending state */
		className?: cn.ClassName | ((props: { isActive: boolean; isPending: boolean }) => cn.ClassName);
	}
}

/**
 * NavLink component wrapping React Router's NavLink with styling support.
 *
 * Provides data attributes for active and pending states, plus color/variant styling.
 *
 * @example
 * ```tsx
 * <NavLink to="/dashboard" color="primary">Dashboard</NavLink>
 * <NavLink to="/settings" className={({ isActive }) => isActive && "font-bold"}>Settings</NavLink>
 * ```
 */
export function NavLink({
	className,
	color = "primary",
	prefetch,
	children,
	...props
}: NavLink.Props) {
	let [shouldPrefetch, setShouldPrefetch] = useState(false);
	let ref = useRef<HTMLAnchorElement>(null);

	return (
		<>
			<ReactRouterNavLink
				{...props}
				ref={ref}
				data-color={color}
				prefetch={prefetch}
				onMouseEnter={(e) => {
					setShouldPrefetch(true);
					props.onMouseEnter?.(e);
				}}
				onMouseLeave={(e) => {
					setShouldPrefetch(false);
					props.onMouseLeave?.(e);
				}}
				className={({ isActive, isPending }) => {
					// Update data attributes synchronously during render
					if (ref.current) {
						if (isActive) {
							ref.current.dataset.active = "";
						} else {
							delete ref.current.dataset.active;
						}
						if (isPending) {
							ref.current.dataset.pending = "";
						} else {
							delete ref.current.dataset.pending;
						}
					}
					return classNames(
						"ui-nav-link",
						typeof className === "function" ? className({ isActive, isPending }) : className,
					);
				}}
			>
				{children}
			</ReactRouterNavLink>
			{prefetch === "render" && <PrefetchPageLinks page={props.to.toString()} />}
			{shouldPrefetch && prefetch === "intent" && <PrefetchPageLinks page={props.to.toString()} />}
		</>
	);
}
