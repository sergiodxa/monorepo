import type { ComponentProps, ReactElement, ReactNode } from "react";

import { cn } from "@pkg/cn";
import {
	Children,
	cloneElement,
	createContext,
	isValidElement,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	Input as AriaInput,
	ListBox as AriaListBox,
	ListBoxItem as AriaListBoxItem,
	TextField as AriaTextField,
} from "react-aria-components";

interface CommandContextValue {
	filterValue: string;
	setFilterValue: (value: string) => void;
}

const CommandContext = createContext<CommandContextValue | null>(null);

function getNodeText(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) {
		return node
			.map((item) => getNodeText(item as ReactNode))
			.filter(Boolean)
			.join(" ");
	}
	if (isValidElement(node)) {
		const element = node as ReactElement<{ children?: ReactNode }>;
		return getNodeText(element.props.children);
	}
	return "";
}

function getItemText(node: ReactNode): string {
	if (!isValidElement(node)) return "";
	const element = node as ReactElement<{
		children?: ReactNode;
		textValue?: string;
		"aria-label"?: string;
	}>;
	if (typeof element.props.textValue === "string") return element.props.textValue;
	if (typeof element.props["aria-label"] === "string") return element.props["aria-label"];
	return getNodeText(element.props.children);
}

function filterNode(node: ReactNode, filterText: string): ReactNode | null {
	if (!filterText) return node;
	if (typeof node === "string" || typeof node === "number") {
		return String(node).toLowerCase().includes(filterText) ? node : null;
	}
	if (!isValidElement(node)) return null;

	const element = node as ReactElement<{ children?: ReactNode }>;
	const isItem = element.type === Command.Item || element.type === AriaListBoxItem;
	if (isItem) {
		const itemText = getItemText(element).toLowerCase();
		return itemText.includes(filterText) ? element : null;
	}

	if (element.props.children != null) {
		const filteredChildren = Children.toArray(element.props.children)
			.map((child) => filterNode(child, filterText))
			.filter(Boolean) as ReactNode[];
		if (filteredChildren.length === 0) return null;
		return cloneElement(element, element.props, filteredChildren);
	}

	return null;
}

export namespace Command {
	export interface Props extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
	}

	export interface InputProps extends Omit<ComponentProps<typeof AriaTextField>, "className"> {
		className?: cn.ClassName;
		inputClassName?: cn.ClassName;
		inputProps?: Omit<ComponentProps<typeof AriaInput>, "className">;
		value?: string;
		defaultValue?: string;
		onChange?: (value: string) => void;
	}

	export interface ListProps<T extends object> extends Omit<
		ComponentProps<typeof AriaListBox<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface ItemProps extends Omit<ComponentProps<typeof AriaListBoxItem>, "className"> {
		className?: cn.ClassName;
	}

	export interface EmptyProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
	}
}

export function Command({ className, ...props }: Command.Props) {
	const [filterValue, setFilterValue] = useState("");
	const contextValue = useMemo(() => ({ filterValue, setFilterValue }), [filterValue]);

	return (
		<CommandContext.Provider value={contextValue}>
			<div {...props} className={cn("ui-command", className)} />
		</CommandContext.Provider>
	);
}

Command.Input = function CommandInput({
	className,
	inputClassName,
	inputProps,
	value,
	defaultValue,
	onChange,
	children,
	...props
}: Command.InputProps) {
	const context = useContext(CommandContext);
	const isControlled = value !== undefined;

	// Sync controlled value to context for filtering
	useEffect(() => {
		if (!context || !isControlled) return;
		context.setFilterValue(String(value));
	}, [context, isControlled, value]);

	const handleChange: ComponentProps<typeof AriaInput>["onChange"] = (event) => {
		let nextValue = event.currentTarget.value;
		context?.setFilterValue(nextValue);
		onChange?.(nextValue);
		inputProps?.onChange?.(event);
	};

	// Only pass value prop when controlled to allow AriaTextField to manage its own state
	const textFieldProps = isControlled
		? { ...inputProps, value, onChange: handleChange }
		: { ...inputProps, defaultValue: defaultValue ?? "", onChange: handleChange };

	return (
		<AriaTextField {...props} className={cn("ui-command-input", className)}>
			{children ?? (
				<AriaInput {...textFieldProps} className={cn("ui-command-input-field", inputClassName)} />
			)}
		</AriaTextField>
	);
};

function CommandListBase<T extends object>({
	className,
	children,
	...props
}: Command.ListProps<T>) {
	const context = useContext(CommandContext);
	const filterText = context?.filterValue.trim().toLowerCase() ?? "";
	const isRenderFunction = typeof children === "function";

	const filteredChildren = useMemo(() => {
		if (isRenderFunction) return [];
		return Children.toArray(children)
			.map((child) => filterNode(child, filterText))
			.filter(Boolean);
	}, [children, filterText, isRenderFunction]);

	// When children is a render function, pass it directly to AriaListBox
	if (isRenderFunction) {
		return (
			<AriaListBox {...props} className={cn("ui-command-list", className)}>
				{children}
			</AriaListBox>
		);
	}

	const effectiveChildren = filterText ? filteredChildren : Children.toArray(children);

	return (
		<AriaListBox {...props} className={cn("ui-command-list", className)}>
			{effectiveChildren}
		</AriaListBox>
	);
}

Command.List = CommandListBase;

Command.Item = function CommandItem({ className, ...props }: Command.ItemProps) {
	return <AriaListBoxItem {...props} className={cn("ui-command-item", className)} />;
};

Command.Empty = function CommandEmpty({ className, ...props }: Command.EmptyProps) {
	return <div {...props} className={cn("ui-command-empty", className)} />;
};
