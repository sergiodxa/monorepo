import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { XIcon } from "lucide-react";
import {
	TagGroup as AriaTagGroup,
	TagList as AriaTagList,
	Tag as AriaTag,
	Button,
} from "react-aria-components";

export namespace TagGroup {
	export interface Props extends Omit<ComponentProps<typeof AriaTagGroup>, "className"> {
		className?: cn.ClassName;
	}

	export interface ListProps<T extends object> extends Omit<
		ComponentProps<typeof AriaTagList<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export type TagColor = "primary" | "neutral" | "danger" | "warning" | "success";

	export interface TagProps extends Omit<ComponentProps<typeof AriaTag>, "className"> {
		className?: cn.ClassName;
		color?: TagColor;
	}
}

export function TagGroup({ className, ...props }: TagGroup.Props) {
	return <AriaTagGroup {...props} className={cn("ui-tag-group", className)} />;
}

TagGroup.List = function TagGroupList<T extends object>({
	className,
	...props
}: TagGroup.ListProps<T>) {
	return <AriaTagList {...props} className={cn("ui-tag-list", className)} />;
};

TagGroup.Tag = function TagGroupTag({
	className,
	color = "neutral",
	children,
	...props
}: TagGroup.TagProps) {
	let textValue = typeof children === "string" ? children : undefined;

	return (
		<AriaTag
			{...props}
			textValue={textValue}
			data-color={color}
			className={cn("ui-tag", className)}
		>
			{(renderProps) => (
				<>
					{typeof children === "function" ? children(renderProps) : children}
					{renderProps.allowsRemoving && (
						<Button slot="remove" className="ui-tag-remove">
							<XIcon className="size-3" aria-hidden />
						</Button>
					)}
				</>
			)}
		</AriaTag>
	);
};
