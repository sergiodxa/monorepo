import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@pkg/cn";

import {
	ImagePlaceholderBadge,
	ImagePlaceholderFallback,
	ImagePlaceholderImage,
	ImagePlaceholderRoot,
	type ImagePlaceholderSize,
} from "./image-placeholder";

export namespace Avatar {
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

export function Avatar({ children, className, size = "md", ...props }: Avatar.Props) {
	return (
		<ImagePlaceholderRoot {...props} size={size} className={["ui-avatar", className]}>
			{children}
		</ImagePlaceholderRoot>
	);
}

Avatar.Image = function AvatarImage({ className, ...props }: Avatar.ImageProps) {
	return <ImagePlaceholderImage {...props} className={["ui-avatar-image", className]} />;
};

Avatar.Fallback = function AvatarFallback({ className, children, ...props }: Avatar.FallbackProps) {
	return (
		<ImagePlaceholderFallback {...props} className={["ui-avatar-fallback", className]}>
			{children}
		</ImagePlaceholderFallback>
	);
};

Avatar.Badge = function AvatarBadge({ className, children, ...props }: Avatar.BadgeProps) {
	return (
		<ImagePlaceholderBadge {...props} className={["ui-avatar-badge", className]}>
			{children}
		</ImagePlaceholderBadge>
	);
};

function AvatarGroup({ className, children, ...props }: Avatar.GroupProps) {
	return (
		<div {...props} className={cn("ui-avatar-group", className)}>
			{children}
		</div>
	);
}

function AvatarGroupCount({ className, children, ...props }: Avatar.GroupCountProps) {
	return (
		<span {...props} className={cn("ui-avatar-group-count", className)}>
			{children}
		</span>
	);
}

AvatarGroup.Count = AvatarGroupCount;
Avatar.Group = AvatarGroup;
