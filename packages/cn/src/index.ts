import type { ClassValue } from "clsx";
import type { CSSProperties } from "react";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type ClassName = ClassValue;
export type ClassNameRecord<Key extends string> = { [K in Key]?: ClassName };

type Style = CSSProperties & { [key: `--${string}`]: string };
export type StyleRecord<Key extends string> = { [K in Key]?: Style };

export function cn(...classes: ClassName[]): string {
	return twMerge(clsx(...classes));
}
