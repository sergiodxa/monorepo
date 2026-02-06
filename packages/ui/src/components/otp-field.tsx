import type {
	ChangeEvent,
	ClipboardEvent,
	ComponentProps,
	FocusEvent,
	KeyboardEvent,
	MutableRefObject,
	ReactNode,
} from "react";

import { cn } from "@pkg/cn";
import {
	cloneElement,
	createContext,
	isValidElement,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { TextField as AriaTextField } from "react-aria-components";

type AllowedCharacterChecker = (character: string) => boolean;

interface OtpFieldContextValue {
	activeIndex: number;
	allowedCharacters: AllowedCharacterChecker;
	autoComplete: string;
	inputMode: ComponentProps<"input">["inputMode"];
	isDisabled: boolean;
	isInvalid: boolean;
	isReadOnly: boolean;
	isRequired: boolean;
	length: number;
	placeholder?: string;
	setActiveIndex: (index: number) => void;
	setSlotValue: (index: number, value: string) => void;
	applyInput: (index: number, value: string) => void;
	focusSlot: (index: number) => void;
	inputRefs: MutableRefObject<Array<HTMLInputElement | null>>;
	slots: string[];
	ariaLabel?: string;
}

let OtpFieldContext = createContext<OtpFieldContextValue | null>(null);

function normalizeAllowedCharacters(allowedCharacters?: RegExp): AllowedCharacterChecker {
	let matcher = allowedCharacters ?? /\d/;
	let flags = matcher.flags.replace(/g/g, "").replace(/y/g, "");
	let normalized = new RegExp(matcher.source, flags);

	return (character) => normalized.test(character);
}

function normalizeToSlots(value: string, length: number, isAllowed: AllowedCharacterChecker) {
	let characters: string[] = [];
	for (let character of value) {
		if (!isAllowed(character)) continue;
		characters.push(character);
		if (characters.length >= length) break;
	}

	return Array.from({ length }, (_, index) => characters[index] ?? "");
}

export namespace OtpField {
	export interface Props extends Omit<
		ComponentProps<typeof AriaTextField>,
		"className" | "value" | "defaultValue" | "onChange"
	> {
		className?: cn.ClassName;
		length?: number;
		value?: string;
		defaultValue?: string;
		onChange?: (value: string) => void;
		name?: string;
		autoFocus?: boolean;
		inputMode?: ComponentProps<"input">["inputMode"];
		autoComplete?: string;
		allowedCharacters?: RegExp;
		placeholder?: string;
	}

	export interface SlotsProps extends Omit<ComponentProps<"div">, "className" | "children"> {
		className?: cn.ClassName;
		separator?: ReactNode;
	}

	export interface SlotProps extends Omit<
		ComponentProps<"input">,
		"className" | "value" | "defaultValue" | "onChange" | "type" | "inputMode"
	> {
		className?: cn.ClassName;
		index: number;
	}

	export interface SeparatorProps extends Omit<ComponentProps<"span">, "className"> {
		className?: cn.ClassName;
	}
}

export function OtpField({
	className,
	length = 6,
	value,
	defaultValue,
	onChange,
	name,
	autoFocus = false,
	inputMode = "numeric",
	autoComplete = "one-time-code",
	allowedCharacters,
	placeholder,
	isDisabled,
	isInvalid,
	isReadOnly,
	isRequired,
	children,
	"aria-label": ariaLabel,
	...props
}: OtpField.Props) {
	let isControlled = value !== undefined;
	let isAllowed = useMemo(() => normalizeAllowedCharacters(allowedCharacters), [allowedCharacters]);
	let initialSlots = useMemo(
		() => normalizeToSlots(value ?? defaultValue ?? "", length, isAllowed),
		[defaultValue, isAllowed, length, value],
	);

	let [uncontrolledSlots, setUncontrolledSlots] = useState(() => initialSlots);
	let [activeIndex, setActiveIndex] = useState(() => {
		let firstEmpty = initialSlots.findIndex((slot) => slot === "");
		return firstEmpty === -1 ? Math.max(0, length - 1) : firstEmpty;
	});

	let slots = isControlled ? normalizeToSlots(value ?? "", length, isAllowed) : uncontrolledSlots;
	let slotsRef = useRef(slots);
	slotsRef.current = slots; // Keep ref in sync without useEffect
	let inputRefs = useRef<Array<HTMLInputElement | null>>([]);
	let didAutoFocus = useRef(false);

	// Handle length/allowedCharacters changes
	useEffect(() => {
		if (!isControlled) {
			setUncontrolledSlots((previous) => normalizeToSlots(previous.join(""), length, isAllowed));
		}
		setActiveIndex((previous) => Math.min(previous, Math.max(0, length - 1)));
		inputRefs.current = inputRefs.current.slice(0, length);
	}, [isAllowed, isControlled, length]);

	let updateSlots = useCallback(
		(nextSlots: string[]) => {
			if (!isControlled) setUncontrolledSlots(nextSlots);
			onChange?.(nextSlots.join(""));
		},
		[isControlled, onChange],
	);

	let focusSlot = useCallback(
		(index: number) => {
			if (index < 0 || index >= length) return;
			let target = inputRefs.current[index];
			if (!target) return;
			target.focus();
			target.select();
		},
		[length],
	);

	let setSlotValue = useCallback(
		(index: number, slotValue: string) => {
			let nextSlots = [...slotsRef.current];
			nextSlots[index] = slotValue;
			updateSlots(nextSlots);
		},
		[updateSlots],
	);

	let applyInput = useCallback(
		(index: number, inputValue: string) => {
			let nextSlots = [...slotsRef.current];
			let characters = normalizeToSlots(inputValue, length - index, isAllowed).filter(Boolean);
			if (characters.length === 0) {
				setSlotValue(index, "");
				return;
			}
			characters.forEach((character, offset) => {
				nextSlots[index + offset] = character;
			});
			updateSlots(nextSlots);
			let nextIndex = Math.min(index + characters.length, length - 1);
			setActiveIndex(nextIndex);
			focusSlot(nextIndex);
		},
		[focusSlot, isAllowed, length, setSlotValue, updateSlots],
	);

	useEffect(() => {
		if (!autoFocus || didAutoFocus.current || isDisabled) return;
		didAutoFocus.current = true;
		let firstEmpty = slots.findIndex((slot) => slot === "");
		let index = firstEmpty === -1 ? Math.max(0, length - 1) : firstEmpty;
		requestAnimationFrame(() => focusSlot(index));
	}, [autoFocus, focusSlot, isDisabled, length, slots]);

	let contextValue = useMemo<OtpFieldContextValue>(
		() => ({
			activeIndex,
			allowedCharacters: isAllowed,
			autoComplete,
			inputMode,
			isDisabled: !!isDisabled,
			isInvalid: !!isInvalid,
			isReadOnly: !!isReadOnly,
			isRequired: !!isRequired,
			length,
			placeholder,
			setActiveIndex,
			setSlotValue,
			applyInput,
			focusSlot,
			inputRefs,
			slots,
			ariaLabel,
		}),
		[
			activeIndex,
			autoComplete,
			focusSlot,
			inputMode,
			isAllowed,
			isDisabled,
			isInvalid,
			isReadOnly,
			isRequired,
			length,
			placeholder,
			ariaLabel,
			setSlotValue,
			slots,
			applyInput,
		],
	);

	return (
		<AriaTextField
			{...props}
			aria-label={ariaLabel}
			isDisabled={isDisabled}
			isInvalid={isInvalid}
			isReadOnly={isReadOnly}
			isRequired={isRequired}
			className={cn("ui-otp", className)}
		>
			{(renderProps) => (
				<OtpFieldContext.Provider value={contextValue}>
					{name ? <input type="hidden" name={name} value={slots.join("")} /> : null}
					{typeof children === "function" ? children(renderProps) : children}
				</OtpFieldContext.Provider>
			)}
		</AriaTextField>
	);
}

OtpField.Slots = function OtpFieldSlots({ className, separator, ...props }: OtpField.SlotsProps) {
	let context = useContext(OtpFieldContext);
	if (!context) throw new Error("OtpField.Slots must be used within OtpField");

	let { length, isDisabled, isInvalid } = context;
	let renderSeparator = (index: number) => {
		if (!separator || index >= length - 1) return null;
		if (isValidElement(separator)) {
			return cloneElement(separator, { key: `sep-${index}` });
		}
		return (
			<span key={`sep-${index}`} className="ui-otp-separator" aria-hidden>
				{separator}
			</span>
		);
	};

	return (
		<div
			{...props}
			className={cn("ui-otp-group", className)}
			role="group"
			data-disabled={isDisabled ? "" : undefined}
			data-invalid={isInvalid ? "" : undefined}
		>
			{Array.from({ length }, (_, index) => [
				<OtpField.Slot key={`slot-${index}`} index={index} />,
				renderSeparator(index),
			])}
		</div>
	);
};

OtpField.Slot = function OtpFieldSlot({
	className,
	index,
	onKeyDown,
	onPaste,
	onFocus,
	...props
}: OtpField.SlotProps) {
	let context = useContext(OtpFieldContext);
	if (!context) throw new Error("OtpField.Slot must be used within OtpField");

	let {
		activeIndex,
		applyInput,
		autoComplete,
		focusSlot,
		inputMode,
		inputRefs,
		isDisabled,
		isInvalid,
		isReadOnly,
		isRequired,
		length,
		placeholder,
		setActiveIndex,
		setSlotValue,
		slots,
		ariaLabel,
	} = context;

	let value = slots[index] ?? "";

	let handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		if (isDisabled || isReadOnly) return;
		applyInput(index, event.currentTarget.value);
	};

	let handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		onKeyDown?.(event);
		if (event.defaultPrevented) return;

		if (event.key === "ArrowLeft") {
			event.preventDefault();
			setActiveIndex(Math.max(0, index - 1));
			focusSlot(index - 1);
			return;
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			setActiveIndex(Math.min(length - 1, index + 1));
			focusSlot(index + 1);
			return;
		}
		if (event.key === "Home") {
			event.preventDefault();
			setActiveIndex(0);
			focusSlot(0);
			return;
		}
		if (event.key === "End") {
			event.preventDefault();
			setActiveIndex(length - 1);
			focusSlot(length - 1);
			return;
		}
		if (event.key === "Backspace") {
			event.preventDefault();
			if (isDisabled || isReadOnly) return;
			if (value !== "") {
				setSlotValue(index, "");
				return;
			}
			let previousIndex = Math.max(0, index - 1);
			setSlotValue(previousIndex, "");
			setActiveIndex(previousIndex);
			focusSlot(previousIndex);
			return;
		}
		if (event.key === "Delete") {
			event.preventDefault();
			if (isDisabled || isReadOnly) return;
			setSlotValue(index, "");
		}
	};

	let handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
		onPaste?.(event);
		if (event.defaultPrevented || isDisabled || isReadOnly) return;
		event.preventDefault();
		applyInput(index, event.clipboardData.getData("text"));
	};

	let handleFocus = (event: FocusEvent<HTMLInputElement>) => {
		onFocus?.(event);
		if (event.defaultPrevented) return;
		setActiveIndex(index);
		event.currentTarget.select();
	};

	return (
		<input
			{...props}
			ref={(node) => {
				inputRefs.current[index] = node;
			}}
			autoComplete={autoComplete}
			className={cn("ui-otp-slot", className)}
			data-disabled={isDisabled ? "" : undefined}
			data-filled={value ? "" : undefined}
			data-invalid={isInvalid ? "" : undefined}
			disabled={isDisabled}
			inputMode={inputMode}
			maxLength={1}
			placeholder={placeholder}
			readOnly={isReadOnly}
			required={isRequired}
			aria-invalid={isInvalid || undefined}
			aria-label={
				ariaLabel
					? `${ariaLabel} digit ${index + 1} of ${length}`
					: `Digit ${index + 1} of ${length}`
			}
			value={value}
			tabIndex={activeIndex === index ? 0 : -1}
			type="text"
			onChange={handleChange}
			onFocus={handleFocus}
			onKeyDown={handleKeyDown}
			onPaste={handlePaste}
		/>
	);
};

OtpField.Separator = function OtpFieldSeparator({ className, ...props }: OtpField.SeparatorProps) {
	return (
		<span {...props} className={cn("ui-otp-separator", className)} aria-hidden>
			{props.children}
		</span>
	);
};
