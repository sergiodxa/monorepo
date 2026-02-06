import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Section as AriaSection } from "react-aria-components";

export namespace Section {
	export interface Props<T extends object> extends Omit<
		ComponentProps<typeof AriaSection<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}
}

export function Section<T extends object>({ className, ...props }: Section.Props<T>) {
	return <AriaSection {...props} className={cn("ui-section", className)} />;
}
