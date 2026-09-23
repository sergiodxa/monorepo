/**
 * The live preview each component page opens with, and the source that produces it.
 * The catalogue renders as server HTML and works before any script loads, so a preview
 * is this page importing the component and rendering it — the real component under the
 * real stylesheet, rather than a picture of one or a bundler running in the browser.
 *
 * Each entry pairs the markup with the text of that same markup, so the code a reader
 * copies is the code that drew what they are looking at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/ui";

import {
	BoldIcon,
	CheckIcon,
	ChevronDownIcon,
	CircleAlertIcon,
	CircleCheckIcon,
	ClipboardIcon,
	DownloadIcon,
	FileTextIcon,
	InboxIcon,
	ItalicIcon,
	ScissorsIcon,
	ThumbsUpIcon,
	VolumeXIcon,
} from "@sdxc/icons";
import { bs, is } from "@sdxc/u/size";
import {
	Accordion,
	Alert,
	AlertDialog,
	AspectRatio,
	Attachment,
	Avatar,
	Badge,
	Breadcrumbs,
	Bubble,
	Button,
	Calendar,
	Card,
	Carousel,
	Chart,
	Checkbox,
	CheckboxGroup,
	ColorArea,
	ColorField,
	ColorPicker,
	ColorSlider,
	ColorSwatch,
	ColorSwatchPicker,
	ColorWheel,
	ComboBox,
	Command,
	Confirm,
	ContextMenu,
	DateField,
	DatePicker,
	DateRangePicker,
	Description,
	Dialog,
	Disclosure,
	Drawer,
	DropIndicator,
	DropZone,
	Empty,
	FieldError,
	FileTrigger,
	Form,
	GridList,
	Group,
	Header,
	Heading,
	HeadingScope,
	HoverCard,
	ImagePlaceholder,
	Input,
	Item,
	Keyboard,
	Label,
	Link,
	LinkButton,
	ListBox,
	Logo,
	Marker,
	Menu,
	Menubar,
	Message,
	MessageScroller,
	Meter,
	Modal,
	NavLink,
	NavigationMenu,
	NumberField,
	OtpField,
	OverlayArrow,
	Pagination,
	Popover,
	ProgressBar,
	RadioGroup,
	RangeCalendar,
	ScrollArea,
	SearchField,
	Section,
	Select,
	SelectionIndicator,
	SentinelRow,
	Separator,
	SharedElement,
	Sheet,
	Sidebar,
	Skeleton,
	Slider,
	Spinner,
	Switch,
	Table,
	Tabs,
	TagGroup,
	Text,
	TextArea,
	TextField,
	TimeField,
	Toast,
	ToggleButton,
	Toolbar,
	Tooltip,
	Tree,
	Typeset,
} from "@sdxc/ui";

import { RESIZABLE_CODE, ResizablePreview } from "~/resources/components/previews/resizable";

/** One page's hero: what to render, and the source that renders it. */
/**
 * What a preview knows about the reader before anything hydrates, read from the request
 * the page was asked for, so an example that would otherwise wait for the browser draws
 * correctly on the first paint.
 */
export interface PreviewRequest {
	/** Whether the reader's keyboard carries the Apple modifier glyphs. */
	appleKeyboard: boolean;
}

export interface ComponentPreview {
	/** The markup as a reader would write it. */
	code: string;
	/** The same markup, drawn per request rather than held as a built node. */
	render: (request: PreviewRequest) => RemixNode;
	/**
	 * Whether the example meets the edges of its frame. A component that is a whole page's
	 * shell has its own edges, and a band of canvas around them reads as part of the
	 * component rather than as the space the preview puts around it.
	 */
	flush?: boolean;
}

/**
 * The preview for each component, keyed by the slug its page answers to. A component
 * with no entry here shows its documented example as source instead, which is the
 * honest fallback: a preview that needs data the page cannot invent would show a
 * fixture rather than the component.
 */
export const COMPONENT_PREVIEWS: Record<string, ComponentPreview> = {
	accordion: {
		code: `<Accordion>
	<Accordion.Item>
		<Accordion.Trigger>
			Do you offer refunds?
			<ChevronDownIcon data-slot="icon" aria-hidden="true" />
		</Accordion.Trigger>
		<Accordion.Content>
			<p>Within thirty days of the charge, for any reason.</p>
		</Accordion.Content>
	</Accordion.Item>
</Accordion>`,
		render: () => (
			<Accordion>
				<Accordion.Item>
					<Accordion.Trigger>
						Do you offer refunds?
						<ChevronDownIcon data-slot="icon" aria-hidden="true" />
					</Accordion.Trigger>
					<Accordion.Content>
						<p>Within thirty days of the charge, for any reason.</p>
					</Accordion.Content>
				</Accordion.Item>
			</Accordion>
		),
	},

	alert: {
		code: `<Alert color="danger">
	<Alert.Icon><CircleAlertIcon /></Alert.Icon>
	<Alert.Content>
		<Alert.Title>Payment failed</Alert.Title>
		<Alert.Description>The card on file was declined.</Alert.Description>
	</Alert.Content>
</Alert>`,
		render: () => (
			<Alert color="danger">
				<Alert.Icon>
					<CircleAlertIcon />
				</Alert.Icon>
				<Alert.Content>
					<Alert.Title>Payment failed</Alert.Title>
					<Alert.Description>The card on file was declined.</Alert.Description>
				</Alert.Content>
			</Alert>
		),
	},

	"alert-dialog": {
		code: `<Button commandfor="preview-alert" command="show-modal" color="danger">Delete project</Button>
<AlertDialog id="preview-alert" aria-labelledby="preview-alert-title">
	<AlertDialog.Header>
		<AlertDialog.Title id="preview-alert-title">Delete this project?</AlertDialog.Title>
		<AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
	</AlertDialog.Header>
	<AlertDialog.Footer>
		<AlertDialog.Cancel commandfor="preview-alert">Cancel</AlertDialog.Cancel>
		<AlertDialog.Action commandfor="preview-alert">Delete</AlertDialog.Action>
	</AlertDialog.Footer>
</AlertDialog>`,
		render: () => (
			<>
				<Button commandfor="preview-alert" command="show-modal" color="danger">
					Delete project
				</Button>
				<AlertDialog id="preview-alert" aria-labelledby="preview-alert-title">
					<AlertDialog.Header>
						<AlertDialog.Title id="preview-alert-title">Delete this project?</AlertDialog.Title>
						<AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel commandfor="preview-alert">Cancel</AlertDialog.Cancel>
						<AlertDialog.Action commandfor="preview-alert">Delete</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog>
			</>
		),
	},

	"aspect-ratio": {
		code: `<AspectRatio ratio="16 / 9" mix={[is("20rem")]}>
	<div />
</AspectRatio>`,
		render: () => (
			<AspectRatio ratio="16 / 9" mix={[is("20rem")]}>
				<div mix={[is("100%"), bs("100%")]} />
			</AspectRatio>
		),
	},

	attachment: {
		code: `<Attachment state="uploading">
	<Attachment.Media><FileTextIcon aria-hidden="true" /></Attachment.Media>
	<Attachment.Content>
		<Attachment.Title state="uploading">quarterly-report.pdf</Attachment.Title>
		<Attachment.Description>Uploading…</Attachment.Description>
	</Attachment.Content>
</Attachment>`,
		render: () => (
			<Attachment state="uploading">
				<Attachment.Media>
					<FileTextIcon aria-hidden="true" />
				</Attachment.Media>
				<Attachment.Content>
					<Attachment.Title state="uploading">quarterly-report.pdf</Attachment.Title>
					<Attachment.Description>Uploading…</Attachment.Description>
				</Attachment.Content>
			</Attachment>
		),
	},

	avatar: {
		code: `<Avatar>
	<Avatar.Fallback>SX</Avatar.Fallback>
</Avatar>`,
		render: () => (
			<Avatar>
				<Avatar.Fallback>SX</Avatar.Fallback>
			</Avatar>
		),
	},

	badge: {
		code: `<Badge>New</Badge>
<Badge color="success" variant="secondary">
	<Badge.Icon><CheckIcon /></Badge.Icon>
	<Badge.Text>Active</Badge.Text>
</Badge>
<Badge color="danger" variant="outline">Failed</Badge>`,
		render: () => (
			<>
				<Badge>New</Badge>
				<Badge color="success" variant="secondary">
					<Badge.Icon>
						<CheckIcon />
					</Badge.Icon>
					<Badge.Text>Active</Badge.Text>
				</Badge>
				<Badge color="danger" variant="outline">
					Failed
				</Badge>
			</>
		),
	},

	breadcrumbs: {
		code: `<Breadcrumbs aria-label="Breadcrumb">
	<Breadcrumbs.List>
		<Breadcrumbs.Item><Breadcrumbs.Link href="/">Home</Breadcrumbs.Link></Breadcrumbs.Item>
		<Breadcrumbs.Item><Breadcrumbs.Link href="/docs" aria-current="page">Docs</Breadcrumbs.Link></Breadcrumbs.Item>
	</Breadcrumbs.List>
</Breadcrumbs>`,
		render: () => (
			<Breadcrumbs aria-label="Breadcrumb">
				<Breadcrumbs.List>
					<Breadcrumbs.Item>
						<Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
					</Breadcrumbs.Item>
					<Breadcrumbs.Item>
						<Breadcrumbs.Link href="/docs" aria-current="page">
							Docs
						</Breadcrumbs.Link>
					</Breadcrumbs.Item>
				</Breadcrumbs.List>
			</Breadcrumbs>
		),
	},

	bubble: {
		code: `<Bubble align="end">
	<Bubble.Content>Shipping tomorrow.</Bubble.Content>
</Bubble>`,
		render: () => (
			<Bubble align="end">
				<Bubble.Content>Shipping tomorrow.</Bubble.Content>
			</Bubble>
		),
	},

	button: {
		code: `<Button type="button">Save</Button>
<Button variant="outline" color="neutral">Cancel</Button>
<Button variant="ghost" color="danger">Delete</Button>`,
		render: () => (
			<>
				<Button type="button">Save</Button>
				<Button type="button" variant="outline" color="neutral">
					Cancel
				</Button>
				<Button type="button" variant="ghost" color="danger">
					Delete
				</Button>
			</>
		),
	},

	calendar: {
		code: `<Calendar aria-label="Start date" name="startDate" />`,
		render: () => <Calendar aria-label="Start date" name="startDate" />,
	},

	card: {
		code: `<Card>
	<Card.Header>
		<Card.Title>Team plan</Card.Title>
		<Card.Description>Everything in Pro, plus shared billing.</Card.Description>
	</Card.Header>
	<Card.Content>Ten seats, priced per seat.</Card.Content>
	<Card.Footer><Button>Upgrade</Button></Card.Footer>
</Card>`,
		render: () => (
			<Card mix={[is("22rem")]}>
				<Card.Header>
					<Card.Title>Team plan</Card.Title>
					<Card.Description>Everything in Pro, plus shared billing.</Card.Description>
				</Card.Header>
				<Card.Content>Ten seats, priced per seat.</Card.Content>
				<Card.Footer>
					<Button type="button">Upgrade</Button>
				</Card.Footer>
			</Card>
		),
	},

	carousel: {
		code: `<Carousel aria-label="Gallery">
	<Carousel.Viewport id="preview-gallery">
		<Carousel.Track>
			<Carousel.Slide>One</Carousel.Slide>
			<Carousel.Slide>Two</Carousel.Slide>
		</Carousel.Track>
	</Carousel.Viewport>
	<Carousel.Controls>
		<Carousel.Previous commandfor="preview-gallery" aria-label="Previous" />
		<Carousel.Next commandfor="preview-gallery" aria-label="Next" />
	</Carousel.Controls>
</Carousel>`,
		render: () => (
			<Carousel aria-label="Gallery" mix={[is("22rem")]}>
				<Carousel.Viewport id="preview-gallery">
					<Carousel.Track>
						<Carousel.Slide>One</Carousel.Slide>
						<Carousel.Slide>Two</Carousel.Slide>
					</Carousel.Track>
				</Carousel.Viewport>
				<Carousel.Controls>
					<Carousel.Previous commandfor="preview-gallery" aria-label="Previous" />
					<Carousel.Next commandfor="preview-gallery" aria-label="Next" />
				</Carousel.Controls>
			</Carousel>
		),
	},

	chart: {
		code: `<Chart width={360} height={160} xDomain={[0, 4]} yDomain={[0, 100]} aria-label="Revenue">
	<Chart.Line
		points={[
			{ x: 0, y: 20, label: "January: 20" },
			{ x: 1, y: 55, label: "February: 55" },
			{ x: 2, y: 40, label: "March: 40" },
			{ x: 3, y: 90, label: "April: 90" },
			{ x: 4, y: 70, label: "May: 70" },
		]}
	/>
</Chart>`,
		render: () => (
			<Chart width={360} height={160} xDomain={[0, 4]} yDomain={[0, 100]} aria-label="Revenue">
				<Chart.Line
					points={[
						{ x: 0, y: 20, label: "January: 20" },
						{ x: 1, y: 55, label: "February: 55" },
						{ x: 2, y: 40, label: "March: 40" },
						{ x: 3, y: 90, label: "April: 90" },
						{ x: 4, y: 70, label: "May: 70" },
					]}
				/>
			</Chart>
		),
	},

	checkbox: {
		code: `<Checkbox name="terms">I accept the terms</Checkbox>`,
		render: () => <Checkbox name="terms">I accept the terms</Checkbox>,
	},

	"checkbox-group": {
		code: `<CheckboxGroup aria-labelledby="preview-fruits">
	<Label id="preview-fruits">Fruits</Label>
	<Checkbox name="fruits" value="apple">Apple</Checkbox>
	<Checkbox name="fruits" value="banana">Banana</Checkbox>
</CheckboxGroup>`,
		render: () => (
			<CheckboxGroup aria-labelledby="preview-fruits">
				<Label id="preview-fruits">Fruits</Label>
				<Checkbox name="fruits" value="apple">
					Apple
				</Checkbox>
				<Checkbox name="fruits" value="banana">
					Banana
				</Checkbox>
			</CheckboxGroup>
		),
	},

	"color-area": {
		code: `<ColorArea aria-label="Saturation and brightness" hue={210} defaultSaturation={80} defaultValue={70}>
	<ColorArea.SaturationThumb aria-label="Saturation" />
	<ColorArea.ValueThumb aria-label="Brightness" />
</ColorArea>`,
		render: () => (
			<ColorArea
				aria-label="Saturation and brightness"
				hue={210}
				defaultSaturation={80}
				defaultValue={70}
			>
				<ColorArea.SaturationThumb aria-label="Saturation" />
				<ColorArea.ValueThumb aria-label="Brightness" />
			</ColorArea>
		),
	},

	"color-field": {
		code: `<ColorField label="Accent color" name="accentColor" defaultValue="#3b82f6" />`,
		render: () => <ColorField label="Accent color" name="accentColor" defaultValue="#3b82f6" />,
	},

	"color-picker": {
		code: `<ColorPicker label="Accent color" name="accentColor" defaultValue="#3b82f6" />`,
		render: () => <ColorPicker label="Accent color" name="accentColor" defaultValue="#3b82f6" />,
	},

	"color-slider": {
		code: `<ColorSlider channel="hue" defaultValue={210}>
	<ColorSlider.Track>
		<ColorSlider.Thumb id="preview-hue" aria-label="Hue" />
	</ColorSlider.Track>
</ColorSlider>`,
		render: () => (
			<ColorSlider channel="hue" defaultValue={210} mix={[is("18rem")]}>
				<ColorSlider.Track>
					<ColorSlider.Thumb id="preview-hue" aria-label="Hue" />
				</ColorSlider.Track>
			</ColorSlider>
		),
	},

	"color-swatch": {
		code: `<ColorSwatch value="#3b82f6" />`,
		render: () => <ColorSwatch value="#3b82f6" />,
	},

	"color-swatch-picker": {
		code: `<ColorSwatchPicker aria-label="Accent color" name="accentColor">
	<ColorSwatchPicker.Swatch value="#ef4444" aria-label="Red" />
	<ColorSwatchPicker.Swatch value="#3b82f6" aria-label="Blue" defaultChecked />
	<ColorSwatchPicker.Swatch value="#22c55e" aria-label="Green" />
</ColorSwatchPicker>`,
		render: () => (
			<ColorSwatchPicker aria-label="Accent color" name="accentColor">
				<ColorSwatchPicker.Swatch value="#ef4444" aria-label="Red" />
				<ColorSwatchPicker.Swatch value="#3b82f6" aria-label="Blue" defaultChecked />
				<ColorSwatchPicker.Swatch value="#22c55e" aria-label="Green" />
			</ColorSwatchPicker>
		),
	},

	"color-wheel": {
		code: `<ColorWheel aria-label="Hue" defaultValue={210} />`,
		render: () => <ColorWheel aria-label="Hue" defaultValue={210} />,
	},

	combobox: {
		code: `<ComboBox>
	<Label htmlFor="preview-fruit">Fruit</Label>
	<ComboBox.Group>
		<ComboBox.Input id="preview-fruit" name="fruit" list="preview-fruit-options" />
		<ComboBox.Button aria-label="Show fruits" />
	</ComboBox.Group>
	<datalist id="preview-fruit-options">
		<option value="Apple" />
		<option value="Banana" />
	</datalist>
</ComboBox>`,
		render: () => (
			<ComboBox>
				<Label htmlFor="preview-fruit">Fruit</Label>
				<ComboBox.Group>
					<ComboBox.Input id="preview-fruit" name="fruit" list="preview-fruit-options" />
					<ComboBox.Button aria-label="Show fruits" />
				</ComboBox.Group>
				<datalist id="preview-fruit-options">
					<option value="Apple" />
					<option value="Banana" />
				</datalist>
			</ComboBox>
		),
	},

	command: {
		code: `<Command aria-label="Commands">
	<Command.Input aria-label="Commands" placeholder="Type a command…" />
	<Command.List>
		<Command.Item value="new-file">New file</Command.Item>
		<Command.Item value="new-folder">New folder</Command.Item>
	</Command.List>
	<Command.Empty>Nothing matches.</Command.Empty>
</Command>`,
		render: () => (
			<Command aria-label="Commands" mix={[is("22rem")]}>
				<Command.Input aria-label="Commands" placeholder="Type a command…" />
				<Command.List>
					<Command.Item value="new-file">New file</Command.Item>
					<Command.Item value="new-folder">New folder</Command.Item>
				</Command.List>
				<Command.Empty>Nothing matches.</Command.Empty>
			</Command>
		),
	},

	confirm: {
		code: `<Button commandfor="preview-confirm" command="show-modal" color="danger">Delete project</Button>
<Confirm
	id="preview-confirm"
	title="Delete this project?"
	description="This cannot be undone."
	confirmLabel="Delete"
	cancelLabel="Cancel"
/>`,
		render: () => (
			<>
				<Button commandfor="preview-confirm" command="show-modal" color="danger">
					Delete project
				</Button>
				<Confirm
					id="preview-confirm"
					title="Delete this project?"
					description="This cannot be undone."
					confirmLabel="Delete"
					cancelLabel="Cancel"
				/>
			</>
		),
	},

	"context-menu": {
		code: `<ContextMenu id="preview-context" aria-label="Row actions">
	<ContextMenu.Item href="#view">View</ContextMenu.Item>
	<ContextMenu.Item href="#edit">Edit</ContextMenu.Item>
</ContextMenu>`,
		render: () => (
			<ContextMenu id="preview-context" aria-label="Row actions">
				<ContextMenu.Item href="#view">View</ContextMenu.Item>
				<ContextMenu.Item href="#edit">Edit</ContextMenu.Item>
			</ContextMenu>
		),
	},

	"date-field": {
		code: `<DateField label="Birthday" name="birthday" />`,
		render: () => <DateField label="Birthday" name="birthday" />,
	},

	"date-picker": {
		code: `<DatePicker label="Birthday" name="birthday" />`,
		render: () => <DatePicker label="Birthday" name="birthday" />,
	},

	"date-range-picker": {
		code: `<DateRangePicker startLabel="Check in" endLabel="Check out" startName="checkIn" endName="checkOut" />`,
		render: () => (
			<DateRangePicker
				startLabel="Check in"
				endLabel="Check out"
				startName="checkIn"
				endName="checkOut"
			/>
		),
	},

	description: {
		code: `<Description id="preview-hint">At least twelve characters.</Description>`,
		render: () => <Description id="preview-hint">At least twelve characters.</Description>,
	},

	dialog: {
		code: `<Button commandfor="preview-dialog" command="show-modal">Open dialog</Button>
<Dialog id="preview-dialog" aria-labelledby="preview-dialog-title">
	<Dialog.Header>
		<Dialog.Title id="preview-dialog-title">Rename project</Dialog.Title>
		<Dialog.Description>Pick a name the team will recognise.</Dialog.Description>
	</Dialog.Header>
	<Dialog.Footer>
		<Button commandfor="preview-dialog" command="close">Save</Button>
	</Dialog.Footer>
	<Dialog.Close commandfor="preview-dialog" aria-label="Close" />
</Dialog>`,
		render: () => (
			<>
				<Button commandfor="preview-dialog" command="show-modal">
					Open dialog
				</Button>
				<Dialog id="preview-dialog" aria-labelledby="preview-dialog-title">
					<Dialog.Header>
						<Dialog.Title id="preview-dialog-title">Rename project</Dialog.Title>
						<Dialog.Description>Pick a name the team will recognise.</Dialog.Description>
					</Dialog.Header>
					<Dialog.Footer>
						<Button commandfor="preview-dialog" command="close">
							Save
						</Button>
					</Dialog.Footer>
					<Dialog.Close commandfor="preview-dialog" aria-label="Close" />
				</Dialog>
			</>
		),
	},

	disclosure: {
		code: `<Disclosure>
	<Disclosure.Trigger>Do you offer refunds?</Disclosure.Trigger>
	<Disclosure.Panel>
		<p>Within thirty days of the charge, for any reason.</p>
	</Disclosure.Panel>
</Disclosure>`,
		render: () => (
			<Disclosure>
				<Disclosure.Trigger>Do you offer refunds?</Disclosure.Trigger>
				<Disclosure.Panel>
					<p>Within thirty days of the charge, for any reason.</p>
				</Disclosure.Panel>
			</Disclosure>
		),
	},

	drawer: {
		code: `<Button commandfor="preview-drawer" command="show-modal">Open drawer</Button>
<Drawer id="preview-drawer" placement="right" aria-labelledby="preview-drawer-title">
	<Drawer.Header>
		<Drawer.Title id="preview-drawer-title">Cart</Drawer.Title>
	</Drawer.Header>
	<Drawer.Close commandfor="preview-drawer" aria-label="Close" />
</Drawer>`,
		render: () => (
			<>
				<Button commandfor="preview-drawer" command="show-modal">
					Open drawer
				</Button>
				<Drawer id="preview-drawer" placement="right" aria-labelledby="preview-drawer-title">
					<Drawer.Header>
						<Drawer.Title id="preview-drawer-title">Cart</Drawer.Title>
					</Drawer.Header>
					<Drawer.Close commandfor="preview-drawer" aria-label="Close" />
				</Drawer>
			</>
		),
	},

	"drop-indicator": {
		code: `<DropIndicator isDropTarget />`,
		render: () => <DropIndicator isDropTarget />,
	},

	"drop-zone": {
		code: `<DropZone name="attachments" multiple>Drop files here, or browse.</DropZone>`,
		render: () => (
			<DropZone name="attachments" multiple>
				Drop files here, or browse.
			</DropZone>
		),
	},

	empty: {
		code: `<Empty>
	<Empty.Icon><InboxIcon /></Empty.Icon>
	<Empty.Title>Nothing here yet</Empty.Title>
	<Empty.Description>Messages you receive will show up here.</Empty.Description>
	<Empty.Action><Button>Compose</Button></Empty.Action>
</Empty>`,
		render: () => (
			<Empty>
				<Empty.Icon>
					<InboxIcon />
				</Empty.Icon>
				<Empty.Title>Nothing here yet</Empty.Title>
				<Empty.Description>Messages you receive will show up here.</Empty.Description>
				<Empty.Action>
					<Button type="button">Compose</Button>
				</Empty.Action>
			</Empty>
		),
	},

	"field-error": {
		code: `<FieldError id="preview-email-error">Enter an email address.</FieldError>`,
		render: () => <FieldError id="preview-email-error">Enter an email address.</FieldError>,
	},

	"file-trigger": {
		code: `<FileTrigger name="avatar" accept="image/png, image/jpeg">Choose a file</FileTrigger>`,
		render: () => (
			<FileTrigger name="avatar" accept="image/png, image/jpeg">
				Choose a file
			</FileTrigger>
		),
	},

	form: {
		code: `<Form method="post">
	<TextField name="email" label="Email" type="email" />
	<Button type="submit">Send</Button>
</Form>`,
		render: () => (
			<Form method="post">
				<TextField name="email" label="Email" type="email" />
				<Button type="submit">Send</Button>
			</Form>
		),
	},

	"grid-list": {
		code: `<GridList aria-label="Playlist">
	<GridList.Item id="track-1">Intro</GridList.Item>
	<GridList.Item id="track-2">Chorus</GridList.Item>
</GridList>`,
		render: () => (
			<GridList aria-label="Playlist" mix={[is("20rem")]}>
				<GridList.Item id="track-1">Intro</GridList.Item>
				<GridList.Item id="track-2">Chorus</GridList.Item>
			</GridList>
		),
	},

	group: {
		code: `<Group>
	<Button variant="outline" color="neutral">−</Button>
	<Button variant="outline" color="neutral">+</Button>
</Group>`,
		render: () => (
			<Group>
				<Button type="button" variant="outline" color="neutral">
					−
				</Button>
				<Button type="button" variant="outline" color="neutral">
					+
				</Button>
			</Group>
		),
	},

	header: {
		code: `<Header>Fruits</Header>`,
		render: () => <Header>Fruits</Header>,
	},

	heading: {
		code: `<Heading level={2}>Section title</Heading>`,
		render: () => <Heading level={2}>Section title</Heading>,
	},

	"heading-scope": {
		code: `<HeadingScope>
	<Heading>Document title</Heading>
	<HeadingScope>
		<Heading>Section title</Heading>
	</HeadingScope>
</HeadingScope>`,
		render: () => (
			<HeadingScope>
				<Heading>Document title</Heading>
				<HeadingScope>
					<Heading>Section title</Heading>
				</HeadingScope>
			</HeadingScope>
		),
	},

	"hover-card": {
		code: `<HoverCard>
	<HoverCard.Trigger><Link href="#sergiodxa">@sergiodxa</Link></HoverCard.Trigger>
	<HoverCard.Content aria-label="About sergiodxa">
		<p>Writes small packages built on web standards.</p>
	</HoverCard.Content>
</HoverCard>`,
		render: () => (
			<HoverCard>
				<HoverCard.Trigger>
					<Link href="#sergiodxa">@sergiodxa</Link>
				</HoverCard.Trigger>
				<HoverCard.Content aria-label="About sergiodxa">
					<p>Writes small packages built on web standards.</p>
				</HoverCard.Content>
			</HoverCard>
		),
	},

	"image-placeholder": {
		code: `<ImagePlaceholder>
	<ImagePlaceholder.Fallback>SX</ImagePlaceholder.Fallback>
</ImagePlaceholder>`,
		render: () => (
			<ImagePlaceholder>
				<ImagePlaceholder.Fallback>SX</ImagePlaceholder.Fallback>
			</ImagePlaceholder>
		),
	},

	input: {
		code: `<Label htmlFor="preview-email">Email</Label>
<Input id="preview-email" type="email" />`,
		render: () => (
			<>
				<Label htmlFor="preview-email">Email</Label>
				<Input id="preview-email" type="email" />
			</>
		),
	},

	item: {
		code: `<Item>
	<Item.Media><FileTextIcon aria-hidden="true" /></Item.Media>
	<Item.Content>
		<Item.Title>quarterly-report.pdf</Item.Title>
		<Item.Description>2.4 MB</Item.Description>
	</Item.Content>
	<Item.Actions>
		<Button aria-label="Download"><DownloadIcon /></Button>
	</Item.Actions>
</Item>`,
		render: () => (
			<Item mix={[is("24rem")]}>
				<Item.Media>
					<FileTextIcon aria-hidden="true" />
				</Item.Media>
				<Item.Content>
					<Item.Title>quarterly-report.pdf</Item.Title>
					<Item.Description>2.4 MB</Item.Description>
				</Item.Content>
				<Item.Actions>
					<Button type="button" aria-label="Download">
						<DownloadIcon />
					</Button>
				</Item.Actions>
			</Item>
		),
	},

	keyboard: {
		code: `<Keyboard>⌘K</Keyboard>`,
		render: () => <Keyboard>⌘K</Keyboard>,
	},

	label: {
		code: `<Label htmlFor="preview-name">Full name</Label>`,
		render: () => <Label htmlFor="preview-name">Full name</Label>,
	},

	link: {
		code: `<Link href="/docs">Read the docs</Link>`,
		render: () => <Link href="/docs">Read the docs</Link>,
	},

	"link-button": {
		code: `<LinkButton href="/docs/packages">Browse the packages</LinkButton>`,
		render: () => <LinkButton href="/docs/packages">Browse the packages</LinkButton>,
	},

	listbox: {
		code: `<ListBox aria-label="Theme">
	<ListBox.Item value="light" defaultChecked>Light</ListBox.Item>
	<ListBox.Item value="dark">Dark</ListBox.Item>
	<ListBox.Item value="system">System</ListBox.Item>
</ListBox>`,
		render: () => (
			<ListBox aria-label="Theme" mix={[is("18rem")]}>
				<ListBox.Item value="light" defaultChecked>
					Light
				</ListBox.Item>
				<ListBox.Item value="dark">Dark</ListBox.Item>
				<ListBox.Item value="system">System</ListBox.Item>
			</ListBox>
		),
	},

	logo: {
		code: `<Logo>
	<Logo.Fallback>SX</Logo.Fallback>
</Logo>`,
		render: () => (
			<Logo>
				<Logo.Fallback>SX</Logo.Fallback>
			</Logo>
		),
	},

	marker: {
		code: `<Marker color="success">
	<Marker.Icon><CheckIcon /></Marker.Icon>
	<Marker.Content>Delivered</Marker.Content>
</Marker>`,
		render: () => (
			<Marker color="success">
				<Marker.Icon>
					<CheckIcon />
				</Marker.Icon>
				<Marker.Content>Delivered</Marker.Content>
			</Marker>
		),
	},

	menu: {
		code: `<Button commandfor="preview-menu" command="toggle-popover">Account</Button>
<Menu id="preview-menu" aria-label="Account">
	<Menu.Item href="#profile">Profile</Menu.Item>
	<Menu.Item href="#billing">Billing</Menu.Item>
	<Menu.Separator />
	<Menu.Item danger>Sign out</Menu.Item>
</Menu>`,
		render: () => (
			<>
				<Button commandfor="preview-menu" command="toggle-popover">
					Account
				</Button>
				<Menu id="preview-menu" aria-label="Account">
					<Menu.Item href="#profile">Profile</Menu.Item>
					<Menu.Item href="#billing">Billing</Menu.Item>
					<Menu.Separator />
					<Menu.Item danger>Sign out</Menu.Item>
				</Menu>
			</>
		),
	},

	menubar: {
		code: `<Menubar aria-label="Application">
	<Menubar.Trigger commandfor="preview-file-menu">File</Menubar.Trigger>
	<Menu id="preview-file-menu" aria-label="File">
		<Menu.Item>New</Menu.Item>
		<Menu.Item>Open</Menu.Item>
	</Menu>
</Menubar>`,
		render: () => (
			<Menubar aria-label="Application">
				<Menubar.Trigger commandfor="preview-file-menu">File</Menubar.Trigger>
				<Menu id="preview-file-menu" aria-label="File">
					<Menu.Item>New</Menu.Item>
					<Menu.Item>Open</Menu.Item>
				</Menu>
			</Menubar>
		),
	},

	message: {
		code: `<Message>
	<Message.Avatar>
		<Avatar><Avatar.Fallback>SX</Avatar.Fallback></Avatar>
	</Message.Avatar>
	<Message.Header><strong>Sergio</strong></Message.Header>
	<Message.Content><Bubble>Shipping tomorrow.</Bubble></Message.Content>
	<Message.Footer>
		<Button aria-label="Like"><ThumbsUpIcon /></Button>
	</Message.Footer>
</Message>`,
		render: () => (
			<Message>
				<Message.Avatar>
					<Avatar>
						<Avatar.Fallback>SX</Avatar.Fallback>
					</Avatar>
				</Message.Avatar>
				<Message.Header>
					<strong>Sergio</strong>
				</Message.Header>
				<Message.Content>
					<Bubble>Shipping tomorrow.</Bubble>
				</Message.Content>
				<Message.Footer>
					<Button type="button" aria-label="Like">
						<ThumbsUpIcon />
					</Button>
				</Message.Footer>
			</Message>
		),
	},

	"message-scroller": {
		code: `<MessageScroller mix={[bs("12rem")]}>
	<MessageScroller.Viewport>
		<MessageScroller.Content>
			<MessageScroller.Item messageId="turn-1" scrollAnchor>Shipping tomorrow.</MessageScroller.Item>
		</MessageScroller.Content>
	</MessageScroller.Viewport>
	<MessageScroller.Button aria-label="Jump to latest" />
</MessageScroller>`,
		render: () => (
			<MessageScroller mix={[bs("12rem"), is("22rem")]}>
				<MessageScroller.Viewport>
					<MessageScroller.Content>
						<MessageScroller.Item messageId="turn-1" scrollAnchor>
							Shipping tomorrow.
						</MessageScroller.Item>
					</MessageScroller.Content>
				</MessageScroller.Viewport>
				<MessageScroller.Button aria-label="Jump to latest" />
			</MessageScroller>
		),
	},

	meter: {
		code: `<Meter>
	<Meter.Indicator value={45} max={100} aria-label="Storage used" />
	<Meter.ValueLabel>45% used</Meter.ValueLabel>
</Meter>`,
		render: () => (
			<Meter mix={[is("18rem")]}>
				<Meter.Indicator value={45} max={100} aria-label="Storage used" />
				<Meter.ValueLabel>45% used</Meter.ValueLabel>
			</Meter>
		),
	},

	modal: {
		code: `<Button commandfor="preview-modal" command="show-modal">Open modal</Button>
<Modal id="preview-modal" aria-labelledby="preview-modal-title">
	<Modal.Header>
		<Modal.Title id="preview-modal-title">Welcome</Modal.Title>
	</Modal.Header>
</Modal>`,
		render: () => (
			<>
				<Button commandfor="preview-modal" command="show-modal">
					Open modal
				</Button>
				<Modal id="preview-modal" aria-labelledby="preview-modal-title">
					<Modal.Header>
						<Modal.Title id="preview-modal-title">Welcome</Modal.Title>
					</Modal.Header>
				</Modal>
			</>
		),
	},

	"nav-link": {
		code: `<NavLink href="/docs" color="brand">Documentation</NavLink>`,
		render: () => (
			<NavLink href="/docs" color="brand">
				Documentation
			</NavLink>
		),
	},

	"navigation-menu": {
		code: `<NavigationMenu aria-label="Primary">
	<NavigationMenu.List>
		<NavigationMenu.Item>
			<NavigationMenu.Link href="/">Home</NavigationMenu.Link>
		</NavigationMenu.Item>
		<NavigationMenu.Item>
			<NavigationMenu.Link href="/docs">Docs</NavigationMenu.Link>
		</NavigationMenu.Item>
	</NavigationMenu.List>
</NavigationMenu>`,
		render: () => (
			<NavigationMenu aria-label="Primary">
				<NavigationMenu.List>
					<NavigationMenu.Item>
						<NavigationMenu.Link href="/">Home</NavigationMenu.Link>
					</NavigationMenu.Item>
					<NavigationMenu.Item>
						<NavigationMenu.Link href="/docs">Docs</NavigationMenu.Link>
					</NavigationMenu.Item>
				</NavigationMenu.List>
			</NavigationMenu>
		),
	},

	"number-field": {
		code: `<NumberField>
	<Label htmlFor="preview-quantity">Quantity</Label>
	<NumberField.Group>
		<NumberField.DecrementButton aria-label="Decrement" />
		<NumberField.Input id="preview-quantity" name="quantity" min={0} max={10} defaultValue={1} />
		<NumberField.IncrementButton aria-label="Increment" />
	</NumberField.Group>
</NumberField>`,
		render: () => (
			<NumberField>
				<Label htmlFor="preview-quantity">Quantity</Label>
				<NumberField.Group>
					<NumberField.DecrementButton aria-label="Decrement" />
					<NumberField.Input
						id="preview-quantity"
						name="quantity"
						min={0}
						max={10}
						defaultValue={1}
					/>
					<NumberField.IncrementButton aria-label="Increment" />
				</NumberField.Group>
			</NumberField>
		),
	},

	"otp-field": {
		code: `<Label htmlFor="preview-otp">One-time code</Label>
<OtpField id="preview-otp" name="code" />`,
		render: () => (
			<>
				<Label htmlFor="preview-otp">One-time code</Label>
				<OtpField id="preview-otp" name="code" />
			</>
		),
	},

	"overlay-arrow": {
		code: `<OverlayArrow placement="bottom">
	<svg width={12} height={12} viewBox="0 0 12 12"><path d="M0 0 L6 6 L12 0" /></svg>
</OverlayArrow>`,
		render: () => (
			<OverlayArrow placement="bottom">
				<svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
					<path d="M0 0 L6 6 L12 0" />
				</svg>
			</OverlayArrow>
		),
	},

	pagination: {
		code: `<Pagination aria-label="Pagination">
	<Pagination.List>
		<Pagination.Item><Pagination.Link href="?page=1" aria-current="page">1</Pagination.Link></Pagination.Item>
		<Pagination.Item><Pagination.Link href="?page=2">2</Pagination.Link></Pagination.Item>
	</Pagination.List>
</Pagination>`,
		render: () => (
			<Pagination aria-label="Pagination">
				<Pagination.List>
					<Pagination.Item>
						<Pagination.Link href="?page=1" aria-current="page">
							1
						</Pagination.Link>
					</Pagination.Item>
					<Pagination.Item>
						<Pagination.Link href="?page=2">2</Pagination.Link>
					</Pagination.Item>
				</Pagination.List>
			</Pagination>
		),
	},

	popover: {
		code: `<Button commandfor="preview-popover" command="toggle-popover">Account</Button>
<Popover id="preview-popover" placement="bottom-start">
	<p>Signed in as sergiodxa.</p>
</Popover>`,
		render: () => (
			<>
				<Button commandfor="preview-popover" command="toggle-popover">
					Account
				</Button>
				<Popover id="preview-popover" placement="bottom-start">
					<p>Signed in as sergiodxa.</p>
				</Popover>
			</>
		),
	},

	"progress-bar": {
		code: `<ProgressBar>
	<ProgressBar.Indicator value={70} max={100} aria-label="Upload progress" />
	<ProgressBar.ValueLabel>70%</ProgressBar.ValueLabel>
</ProgressBar>`,
		render: () => (
			<ProgressBar mix={[is("18rem")]}>
				<ProgressBar.Indicator value={70} max={100} aria-label="Upload progress" />
				<ProgressBar.ValueLabel>70%</ProgressBar.ValueLabel>
			</ProgressBar>
		),
	},

	"radio-group": {
		code: `<RadioGroup aria-label="Shipping">
	<RadioGroup.Radio value="standard">Standard</RadioGroup.Radio>
	<RadioGroup.Radio value="express">Express</RadioGroup.Radio>
</RadioGroup>`,
		render: () => (
			<RadioGroup aria-label="Shipping">
				<RadioGroup.Radio value="standard">Standard</RadioGroup.Radio>
				<RadioGroup.Radio value="express">Express</RadioGroup.Radio>
			</RadioGroup>
		),
	},

	"range-calendar": {
		code: `<RangeCalendar startLabel="Check in" endLabel="Check out" startName="checkIn" endName="checkOut" />`,
		render: () => (
			<RangeCalendar
				startLabel="Check in"
				endLabel="Check out"
				startName="checkIn"
				endName="checkOut"
			/>
		),
	},

	resizable: { code: RESIZABLE_CODE, render: () => <ResizablePreview /> },

	"scroll-area": {
		code: `<ScrollArea>
	<ScrollArea.Viewport>
		<p>A long changelog, scrolled inside its own frame.</p>
	</ScrollArea.Viewport>
</ScrollArea>`,
		render: () => (
			<ScrollArea mix={[is("22rem"), bs("8rem")]}>
				<ScrollArea.Viewport>
					<p>A long changelog, scrolled inside its own frame.</p>
				</ScrollArea.Viewport>
			</ScrollArea>
		),
	},

	"search-field": {
		code: `<SearchField>
	<Label htmlFor="preview-search">Search</Label>
	<SearchField.Input id="preview-search" name="q" placeholder="Search the docs" />
</SearchField>`,
		render: () => (
			<SearchField>
				<Label htmlFor="preview-search">Search</Label>
				<SearchField.Input id="preview-search" name="q" placeholder="Search the docs" />
			</SearchField>
		),
	},

	section: {
		code: `<ListBox aria-label="Settings">
	<Section aria-labelledby="preview-account">
		<Header id="preview-account">Account</Header>
		<ListBox.Item value="profile">Profile</ListBox.Item>
		<ListBox.Item value="billing">Billing</ListBox.Item>
	</Section>
</ListBox>`,
		render: () => (
			<ListBox aria-label="Settings" mix={[is("18rem")]}>
				<Section aria-labelledby="preview-account">
					<Header id="preview-account">Account</Header>
					<ListBox.Item value="profile">Profile</ListBox.Item>
					<ListBox.Item value="billing">Billing</ListBox.Item>
				</Section>
			</ListBox>
		),
	},

	select: {
		code: `<Select aria-label="Country">
	<Select.Option value="">Pick one</Select.Option>
	<Select.Option value="ar">Argentina</Select.Option>
	<Select.Option value="es">Spain</Select.Option>
</Select>`,
		render: () => (
			<Select aria-label="Country">
				<Select.Option value="">Pick one</Select.Option>
				<Select.Option value="ar">Argentina</Select.Option>
				<Select.Option value="es">Spain</Select.Option>
			</Select>
		),
	},

	"selection-indicator": {
		code: `<SelectionIndicator aria-selected="true"><CheckIcon /></SelectionIndicator>`,
		render: () => (
			<SelectionIndicator aria-selected="true">
				<CheckIcon />
			</SelectionIndicator>
		),
	},

	separator: {
		code: `<Separator />`,
		render: () => <Separator />,
	},

	"shared-element": {
		code: `<SharedElement id="preview-cover">
	<Badge>Cover</Badge>
</SharedElement>`,
		render: () => (
			<SharedElement id="preview-cover">
				<Badge>Cover</Badge>
			</SharedElement>
		),
	},

	sheet: {
		code: `<Button commandfor="preview-sheet" command="show-modal">Open sheet</Button>
<Sheet id="preview-sheet" side="right" aria-labelledby="preview-sheet-title">
	<Sheet.Header>
		<Sheet.Title id="preview-sheet-title">Cart</Sheet.Title>
		<Sheet.Description>Two items, ready to check out.</Sheet.Description>
	</Sheet.Header>
	<Sheet.Close commandfor="preview-sheet" aria-label="Close" />
</Sheet>`,
		render: () => (
			<>
				<Button commandfor="preview-sheet" command="show-modal">
					Open sheet
				</Button>
				<Sheet id="preview-sheet" side="right" aria-labelledby="preview-sheet-title">
					<Sheet.Header>
						<Sheet.Title id="preview-sheet-title">Cart</Sheet.Title>
						<Sheet.Description>Two items, ready to check out.</Sheet.Description>
					</Sheet.Header>
					<Sheet.Close commandfor="preview-sheet" aria-label="Close" />
				</Sheet>
			</>
		),
	},

	skeleton: {
		code: `<Skeleton mix={[is("14rem"), bs("1rem")]} />`,
		render: () => <Skeleton mix={[is("14rem"), bs("1rem")]} />,
	},

	slider: {
		code: `<Slider aria-label="Volume" min={0} max={100} defaultValue={40}>
	<Slider.Output />
	<Slider.Track>
		<Slider.Thumb />
	</Slider.Track>
</Slider>`,
		render: () => (
			<Slider aria-label="Volume" min={0} max={100} defaultValue={40} mix={[is("18rem")]}>
				<Slider.Output />
				<Slider.Track>
					<Slider.Thumb />
				</Slider.Track>
			</Slider>
		),
	},

	spinner: {
		code: `<Spinner aria-label="Loading" />`,
		render: () => <Spinner aria-label="Loading" />,
	},

	switch: {
		code: `<Switch name="notifications" defaultChecked>Email notifications</Switch>`,
		render: () => (
			<Switch name="notifications" defaultChecked>
				Email notifications
			</Switch>
		),
	},

	table: {
		code: `<Table aria-label="Packages">
	<Table.Header>
		<Table.Row>
			<Table.Column>Name</Table.Column>
			<Table.Column>Version</Table.Column>
		</Table.Row>
	</Table.Header>
	<Table.Body>
		<Table.Row>
			<Table.Cell>@sdxc/result</Table.Cell>
			<Table.Cell>2026.9.17</Table.Cell>
		</Table.Row>
	</Table.Body>
</Table>`,
		render: () => (
			<Table aria-label="Packages">
				<Table.Header>
					<Table.Row>
						<Table.Column>Name</Table.Column>
						<Table.Column>Version</Table.Column>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					<Table.Row>
						<Table.Cell>@sdxc/result</Table.Cell>
						<Table.Cell>2026.9.17</Table.Cell>
					</Table.Row>
				</Table.Body>
			</Table>
		),
	},

	tabs: {
		code: `<Tabs>
	<Tabs.List aria-label="Settings">
		<Tabs.Tab href="#profile" aria-selected="true">Profile</Tabs.Tab>
		<Tabs.Tab href="#billing" aria-selected="false">Billing</Tabs.Tab>
	</Tabs.List>
	<Tabs.Panels>
		<Tabs.Panel>Your name and avatar.</Tabs.Panel>
	</Tabs.Panels>
</Tabs>`,
		render: () => (
			<Tabs mix={[is("22rem")]}>
				<Tabs.List aria-label="Settings">
					<Tabs.Tab href="#profile" aria-selected="true">
						Profile
					</Tabs.Tab>
					<Tabs.Tab href="#billing" aria-selected="false">
						Billing
					</Tabs.Tab>
				</Tabs.List>
				<Tabs.Panels>
					<Tabs.Panel>Your name and avatar.</Tabs.Panel>
				</Tabs.Panels>
			</Tabs>
		),
	},

	"tag-group": {
		code: `<TagGroup aria-label="Skills">
	<TagGroup.List>
		<TagGroup.Tag color="brand">Design</TagGroup.Tag>
		<TagGroup.Tag color="success">Shipped</TagGroup.Tag>
	</TagGroup.List>
</TagGroup>`,
		render: () => (
			<TagGroup aria-label="Skills">
				<TagGroup.List>
					<TagGroup.Tag color="brand">Design</TagGroup.Tag>
					<TagGroup.Tag color="success">Shipped</TagGroup.Tag>
				</TagGroup.List>
			</TagGroup>
		),
	},

	text: {
		code: `<Text>Small TypeScript packages built on web standards.</Text>`,
		render: () => <Text>Small TypeScript packages built on web standards.</Text>,
	},

	"text-field": {
		code: `<TextField label="Email" type="email" name="email" />`,
		render: () => <TextField label="Email" type="email" name="email" />,
	},

	textarea: {
		code: `<Label htmlFor="preview-bio">Bio</Label>
<TextArea id="preview-bio" name="bio" />`,
		render: () => (
			<>
				<Label htmlFor="preview-bio">Bio</Label>
				<TextArea id="preview-bio" name="bio" />
			</>
		),
	},

	"time-field": {
		code: `<TimeField label="Start time" name="startTime" />`,
		render: () => <TimeField label="Start time" name="startTime" />,
	},

	toast: {
		code: `<Toast color="success">
	<Toast.Icon><CircleCheckIcon /></Toast.Icon>
	<Toast.Content>
		<Toast.Title>Saved</Toast.Title>
		<Toast.Description>Your changes are live.</Toast.Description>
	</Toast.Content>
	<Toast.Close aria-label="Dismiss" />
</Toast>`,
		render: () => (
			<Toast color="success">
				<Toast.Icon>
					<CircleCheckIcon />
				</Toast.Icon>
				<Toast.Content>
					<Toast.Title>Saved</Toast.Title>
					<Toast.Description>Your changes are live.</Toast.Description>
				</Toast.Content>
				<Toast.Close aria-label="Dismiss" />
			</Toast>
		),
	},

	"toggle-button": {
		code: `<ToggleButton aria-pressed="true" aria-label="Mute"><VolumeXIcon /></ToggleButton>`,
		render: () => (
			<ToggleButton aria-pressed="true" aria-label="Mute">
				<VolumeXIcon />
			</ToggleButton>
		),
	},

	toolbar: {
		code: `<Toolbar aria-label="Editor">
	<Button variant="ghost" aria-label="Bold"><BoldIcon /></Button>
	<Button variant="ghost" aria-label="Italic"><ItalicIcon /></Button>
	<Button variant="ghost" aria-label="Cut"><ScissorsIcon /></Button>
	<Button variant="ghost" aria-label="Paste"><ClipboardIcon /></Button>
</Toolbar>`,
		render: () => (
			<Toolbar aria-label="Editor">
				<Button type="button" variant="ghost" aria-label="Bold">
					<BoldIcon />
				</Button>
				<Button type="button" variant="ghost" aria-label="Italic">
					<ItalicIcon />
				</Button>
				<Button type="button" variant="ghost" aria-label="Cut">
					<ScissorsIcon />
				</Button>
				<Button type="button" variant="ghost" aria-label="Paste">
					<ClipboardIcon />
				</Button>
			</Toolbar>
		),
	},

	tooltip: {
		code: `<button popovertarget="preview-tooltip" aria-describedby="preview-tooltip">Save</button>
<Tooltip id="preview-tooltip">Saves without leaving the page.</Tooltip>`,
		render: () => (
			<>
				<button type="button" popovertarget="preview-tooltip" aria-describedby="preview-tooltip">
					Save
				</button>
				<Tooltip id="preview-tooltip">Saves without leaving the page.</Tooltip>
			</>
		),
	},

	tree: {
		code: `<Tree aria-label="Files">
	<Tree.Item id="src">
		<Tree.ItemContent>
			<Tree.ExpandButton aria-label="Expand" />
			src
		</Tree.ItemContent>
		<Tree.Item id="src-index">
			<Tree.ItemContent>index.ts</Tree.ItemContent>
		</Tree.Item>
	</Tree.Item>
</Tree>`,
		render: () => (
			<Tree aria-label="Files" mix={[is("18rem")]}>
				<Tree.Item id="src">
					<Tree.ItemContent>
						<Tree.ExpandButton aria-label="Expand" />
						src
					</Tree.ItemContent>
					<Tree.Item id="src-index">
						<Tree.ItemContent>index.ts</Tree.ItemContent>
					</Tree.Item>
				</Tree.Item>
			</Tree>
		),
	},

	typeset: {
		code: `<Typeset preset="reading">
	<h2>What holds the set together</h2>
	<p>Every fallible entry point answers with a Result.</p>
</Typeset>`,
		render: () => (
			<Typeset preset="reading">
				<h2>What holds the set together</h2>
				<p>Every fallible entry point answers with a Result.</p>
			</Typeset>
		),
	},

	sidebar: {
		code: `<Sidebar.Provider>
	<Sidebar collapsible="icon">
		<Sidebar.Header>sdxc</Sidebar.Header>
		<Sidebar.Content>
			<Sidebar.Nav aria-label="Docs">
				<Sidebar.Menu>
					<Sidebar.MenuItem><Sidebar.MenuLink href="/docs">Docs</Sidebar.MenuLink></Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.Nav>
		</Sidebar.Content>
	</Sidebar>
	<Sidebar.Inset>The page</Sidebar.Inset>
</Sidebar.Provider>`,
		render: () => (
			<Sidebar.Provider>
				<Sidebar collapsible="icon">
					<Sidebar.Header>sdxc</Sidebar.Header>
					<Sidebar.Content>
						<Sidebar.Nav aria-label="Docs">
							<Sidebar.Menu>
								<Sidebar.MenuItem>
									<Sidebar.MenuLink href="/docs">Docs</Sidebar.MenuLink>
								</Sidebar.MenuItem>
							</Sidebar.Menu>
						</Sidebar.Nav>
					</Sidebar.Content>
				</Sidebar>
				<Sidebar.Inset>The page</Sidebar.Inset>
			</Sidebar.Provider>
		),
	},

	"sentinel-row": {
		code: `<SentinelRow>Loading more…</SentinelRow>`,
		render: () => <SentinelRow>Loading more…</SentinelRow>,
	},
};
