import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@pkg/cn";

import {
	ImagePlaceholderBadge,
	ImagePlaceholderFallback,
	ImagePlaceholderImage,
	ImagePlaceholderRoot,
	type ImagePlaceholderSize,
} from "./image-placeholder";

export namespace Logo {
	export type Size = ImagePlaceholderSize;

	export interface Props extends Omit<ComponentPropsWithoutRef<"span">, "className" | "children"> {
		children: ReactNode;
		className?: cn.ClassName;
		size?: Size;
	}

	export interface ImageProps extends Omit<
		ComponentPropsWithoutRef<"img">,
		"className" | "src" | "alt"
	> {
		src: string;
		alt: string;
		className?: cn.ClassName;
	}

	export interface FallbackProps extends Omit<
		ComponentPropsWithoutRef<"span">,
		"className" | "children"
	> {
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface BadgeProps extends Omit<ComponentPropsWithoutRef<"span">, "className"> {
		className?: cn.ClassName;
	}

	export interface GroupProps extends Omit<ComponentPropsWithoutRef<"div">, "className"> {
		className?: cn.ClassName;
	}

	export interface GroupCountProps extends Omit<ComponentPropsWithoutRef<"span">, "className"> {
		className?: cn.ClassName;
	}
}

export function Logo({ children, className, size = "md", ...props }: Logo.Props) {
	return (
		<ImagePlaceholderRoot {...props} size={size} className={["ui-logo", className]}>
			{children}
		</ImagePlaceholderRoot>
	);
}

Logo.Image = function LogoImage({ className, ...props }: Logo.ImageProps) {
	return <ImagePlaceholderImage {...props} className={["ui-logo-image", className]} />;
};

Logo.Fallback = function LogoFallback({ className, children, ...props }: Logo.FallbackProps) {
	return (
		<ImagePlaceholderFallback {...props} className={["ui-logo-fallback", className]}>
			{children}
		</ImagePlaceholderFallback>
	);
};

Logo.Badge = function LogoBadge({ className, children, ...props }: Logo.BadgeProps) {
	return (
		<ImagePlaceholderBadge {...props} className={["ui-logo-badge", className]}>
			{children}
		</ImagePlaceholderBadge>
	);
};

function LogoGroup({ className, children, ...props }: Logo.GroupProps) {
	return (
		<div {...props} className={cn("ui-logo-group", className)}>
			{children}
		</div>
	);
}

function LogoGroupCount({ className, children, ...props }: Logo.GroupCountProps) {
	return (
		<span {...props} className={cn("ui-logo-group-count", className)}>
			{children}
		</span>
	);
}

LogoGroup.Count = LogoGroupCount;
Logo.Group = LogoGroup;
