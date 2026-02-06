import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@pkg/cn";
import { createContext, useContext, useMemo, useState } from "react";

/**
 * Base component for Avatar and Logo - handles image loading state management.
 * Not exported publicly, used internally by Avatar and Logo.
 */

export type ImagePlaceholderStatus = "idle" | "loaded" | "error";
export type ImagePlaceholderSize = "sm" | "md" | "lg";

export interface ImagePlaceholderContextValue {
	status: ImagePlaceholderStatus;
	setStatus: (status: ImagePlaceholderStatus) => void;
}

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

let ImagePlaceholderContext = createContext<ImagePlaceholderContextValue | null>(null);

export function useImagePlaceholderContext(componentName: string) {
	let context = useContext(ImagePlaceholderContext);
	if (!context) {
		throw new Error(`${componentName} compound components must be used within ${componentName}`);
	}
	return context;
}

export function ImagePlaceholderRoot({
	children,
	className,
	size = "md",
	...props
}: ImagePlaceholderRootProps) {
	let [status, setStatus] = useState<ImagePlaceholderStatus>("idle");

	let value = useMemo(() => ({ status, setStatus }), [status]);

	return (
		<span {...props} data-status={status} data-size={size} className={cn(className)}>
			<ImagePlaceholderContext.Provider value={value}>{children}</ImagePlaceholderContext.Provider>
		</span>
	);
}

export function ImagePlaceholderImage({
	className,
	onLoad,
	onError,
	src,
	alt,
	...props
}: ImagePlaceholderImageProps) {
	let context = useContext(ImagePlaceholderContext);

	return (
		<img
			{...props}
			src={src}
			alt={alt}
			className={cn(className)}
			data-status={context?.status}
			onLoad={(event) => {
				context?.setStatus("loaded");
				onLoad?.(event);
			}}
			onError={(event) => {
				context?.setStatus("error");
				onError?.(event);
			}}
		/>
	);
}

export function ImagePlaceholderFallback({
	className,
	children,
	...props
}: ImagePlaceholderFallbackProps) {
	let context = useContext(ImagePlaceholderContext);

	if (context?.status === "loaded") return null;

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
