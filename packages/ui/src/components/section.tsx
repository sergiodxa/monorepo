import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
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
	return <AriaSection {...props} className={classNames("ui-section", className)} />;
}
