import { cn } from "@pkg/cn";
import { useId } from "react";
import {
	FieldError as AriaFieldError,
	Input as AriaInput,
	Label as AriaLabel,
	Slider as AriaSlider,
	SliderOutput as AriaSliderOutput,
	SliderThumb as AriaSliderThumb,
	SliderTrack as AriaSliderTrack,
	Text as AriaText,
} from "react-aria-components";

export function Label({ children, ...props }: React.ComponentProps<typeof AriaLabel>) {
	return (
		<AriaLabel {...props} className={cn("text-sm font-semibold", props.className)}>
			{children}
		</AriaLabel>
	);
}

export function Input(
	props: Omit<React.ComponentProps<typeof AriaInput>, "list"> & {
		datalist?: Array<{ value: string; label: string }>;
	},
) {
	let id = useId();

	return (
		<>
			<AriaInput
				{...props}
				list={id}
				className={cn(
					"user-invalid:outline-red-500 rounded border border-solid border-neutral-400 px-4 py-2 ring-0 user-invalid:outline-2 focus:outline-2 focus:outline-primary-500",
					props.className,
				)}
			/>
			{props.datalist && props.datalist.length > 0 && (
				<datalist id={id}>
					{props.datalist.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</datalist>
			)}
		</>
	);
}

export function Description({
	children,
	...props
}: Omit<React.ComponentProps<typeof AriaText>, "slot">) {
	return (
		<AriaText
			{...props}
			slot="description"
			className={cn("text-sm text-neutral-500 dark:text-neutral-400", props.className)}
		>
			{children}
		</AriaText>
	);
}

export function Group({ children }: { children: React.ReactNode }) {
	return <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

export function FieldError(props: React.ComponentProps<typeof AriaFieldError>) {
	return (
		<AriaFieldError
			{...props}
			className={cn("text-sm text-danger-500 dark:text-danger-400", props.className)}
		/>
	);
}

export function Slider(props: {
	name: string;
	minValue: number;
	maxValue: number;
	step: number;
	defaultValue?: number;
	formatOptions?: Intl.NumberFormatOptions;

	label: string;
	minValueLabel?: string;
	maxValueLabel?: string;
}) {
	return (
		<AriaSlider
			defaultValue={props.defaultValue}
			minValue={props.minValue}
			maxValue={props.maxValue}
			step={props.step}
			formatOptions={props.formatOptions}
			className="flex w-full flex-col"
		>
			<Label>{props.label}</Label>

			<AriaSliderTrack className="relative w-full py-4">
				<div className="absolute top-3.5 left-0 h-1 w-full rounded-full bg-neutral-200">
					<div
						className="absolute top-0 left-0 h-full rounded-full bg-primary-300"
						// style={{
						// 	width: `${(constrainedValue / (maxValue - minValue)) * 100}%`,
						// }}
					/>
				</div>
				<AriaSliderThumb
					name={props.name}
					className="flex size-4 items-center justify-center rounded-full bg-primary-300"
				/>
			</AriaSliderTrack>

			<div className="flex justify-between text-sm text-neutral-500">
				{props.minValueLabel && <span>{props.minValueLabel}</span>}
				<span className="font-medium">
					<AriaSliderOutput />
				</span>
				{props.maxValueLabel && <span>{props.maxValueLabel}</span>}
			</div>
		</AriaSlider>
	);
}
