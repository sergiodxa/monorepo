import type { ClassValue } from "clsx";

import { clsx } from "clsx";
import { extendTailwindMerge, twMerge } from "tailwind-merge";

export namespace cn {
	export type ClassName = ClassValue;
	export type ClassNameRecord<Key extends string> = { [K in Key]?: cn.ClassName };
}

export function cn(...classes: cn.ClassName[]): string {
	return twMerge(clsx(...classes));
}

export namespace extendClassName {
	export type Config = Parameters<typeof extendTailwindMerge>[0];
	export type ClassName = cn.ClassName;
	export type ClassNameRecord<Key extends string> = cn.ClassNameRecord<Key>;
}

export function extendClassName(config: extendClassName.Config) {
	let customTwMerge = extendTailwindMerge(config);
	return (...classes: cn.ClassName[]): string => {
		return customTwMerge(clsx(...classes));
	};
}
