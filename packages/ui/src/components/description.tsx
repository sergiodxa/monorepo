import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { Text } from "react-aria-components";

export namespace Description {
	export interface Props extends Omit<ComponentProps<typeof Text>, "slot" | "className"> {
		className?: cn.ClassName;
	}
}

export function Description({ className, ...props }: Description.Props) {
	return <Text {...props} slot="description" className={classNames("ui-description", className)} />;
}
