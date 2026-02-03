import type { ClassValue } from "clsx";
import type { CSSProperties } from "react";

import { clsx } from "clsx";
import { extendTailwindMerge, twMerge } from "tailwind-merge";

export type ClassName = ClassValue;
export type ClassNameRecord<Key extends string> = { [K in Key]?: ClassName };

type Style = CSSProperties & { [key: `--${string}`]: string };
export type StyleRecord<Key extends string> = { [K in Key]?: Style };

export function cn(...classes: ClassName[]): string {
	return twMerge(clsx(...classes));
}

export namespace extendClassName {
	export type Config = Parameters<typeof extendTailwindMerge>[0];
}

export function extendClassName(config: extendClassName.Config) {
	let customTwMerge = extendTailwindMerge(config);
	return (...classes: ClassName[]): string => {
		return customTwMerge(clsx(...classes));
	};
}
