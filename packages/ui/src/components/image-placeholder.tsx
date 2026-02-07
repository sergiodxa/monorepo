import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@pkg/cn";

/**
 * Base component for Avatar and Logo.
 * Not exported publicly, used internally by Avatar and Logo.
 *
 * The app is responsible for deciding whether to render Image or Fallback.
 * Typically: image ? <Image src={image} /> : <Fallback>initials</Fallback>
 */

export type ImagePlaceholderSize = "sm" | "md" | "lg";

export interface ImagePlaceholderRootProps extends Omit<
	ComponentPropsWithoutRef<"span">,
	"className" | "children"
> {
	children: ReactNode;
	className?: cn.ClassName;
	size?: ImagePlaceholderSize;
}

export interface ImagePlaceholderImageProps extends Omit<
	ComponentPropsWithoutRef<"img">,
	"className" | "src" | "alt"
> {
	src: string;
	alt: string;
	className?: cn.ClassName;
}

export interface ImagePlaceholderFallbackProps extends Omit<
	ComponentPropsWithoutRef<"span">,
	"className" | "children"
> {
	children: ReactNode;
	className?: cn.ClassName;
}

export interface ImagePlaceholderBadgeProps extends Omit<
	ComponentPropsWithoutRef<"span">,
	"className"
> {
	className?: cn.ClassName;
}

export function ImagePlaceholderRoot({
	children,
	className,
	size = "md",
	...props
}: ImagePlaceholderRootProps) {
	return (
		<span {...props} data-size={size} className={cn(className)}>
			{children}
		</span>
	);
}

export function ImagePlaceholderImage({
	className,
	src,
	alt,
	...props
}: ImagePlaceholderImageProps) {
	return <img {...props} src={src} alt={alt} className={cn(className)} />;
}

export function ImagePlaceholderFallback({
	className,
	children,
	...props
}: ImagePlaceholderFallbackProps) {
	return (
		<span {...props} className={cn(className)}>
			{children}
		</span>
	);
}

export function ImagePlaceholderBadge({
	className,
	children,
	...props
}: ImagePlaceholderBadgeProps) {
	return (
		<span {...props} className={cn(className)}>
			{children}
		</span>
	);
}

// Keep for backwards compatibility but it's now a no-op
export function useImagePlaceholderContext(_componentName: string) {
	return null;
}
