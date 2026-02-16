# @pkg/ui

A styled, accessible UI component library built on React Aria Components with Tailwind CSS v4.

## Installation

```bash
bun add @pkg/ui
```

### Peer Dependencies

Ensure these are installed in your app:

```bash
bun add react react-dom react-router
```

## Setup

### 1. Import Styles

Import the component styles in your app's CSS using `@import`:

```css
@import "tailwindcss";

@import "@pkg/ui/styles.css";
```

> **Note:** The styles use Tailwind v4's `@utility` directive and must be processed by Tailwind. Import the file from your main stylesheet so Tailwind can pick it up.

### 2. Define Theme Tokens

Components use semantic color tokens. Define these in your Tailwind v4 `@theme` block:

```css
@theme {
	/* Neutral palette (gray) */
	--color-neutral-50: oklch(0.985 0 0);
	--color-neutral-100: oklch(0.97 0 0);
	--color-neutral-200: oklch(0.922 0 0);
	--color-neutral-300: oklch(0.87 0 0);
	--color-neutral-400: oklch(0.708 0 0);
	--color-neutral-500: oklch(0.556 0 0);
	--color-neutral-600: oklch(0.439 0 0);
	--color-neutral-700: oklch(0.371 0 0);
	--color-neutral-800: oklch(0.269 0 0);
	--color-neutral-900: oklch(0.205 0 0);
	--color-neutral-950: oklch(0.145 0 0);

	/* Primary palette (customize hue) */
	--color-primary-50: oklch(0.97 0.02 250);
	--color-primary-100: oklch(0.94 0.04 250);
	--color-primary-200: oklch(0.88 0.08 250);
	--color-primary-300: oklch(0.8 0.12 250);
	--color-primary-400: oklch(0.7 0.16 250);
	--color-primary-500: oklch(0.6 0.18 250);
	--color-primary-600: oklch(0.52 0.18 250);
	--color-primary-700: oklch(0.44 0.16 250);
	--color-primary-800: oklch(0.36 0.14 250);
	--color-primary-900: oklch(0.28 0.1 250);
	--color-primary-950: oklch(0.2 0.08 250);

	/* Danger palette (red) */
	--color-danger-50: oklch(0.97 0.02 25);
	--color-danger-100: oklch(0.94 0.04 25);
	--color-danger-200: oklch(0.88 0.1 25);
	--color-danger-300: oklch(0.8 0.15 25);
	--color-danger-400: oklch(0.7 0.18 25);
	--color-danger-500: oklch(0.6 0.2 25);
	--color-danger-600: oklch(0.52 0.2 25);
	--color-danger-700: oklch(0.44 0.18 25);
	--color-danger-800: oklch(0.36 0.15 25);
	--color-danger-900: oklch(0.28 0.12 25);
	--color-danger-950: oklch(0.2 0.08 25);

	/* Warning palette (amber) */
	--color-warning-50: oklch(0.97 0.02 85);
	--color-warning-100: oklch(0.94 0.06 85);
	--color-warning-200: oklch(0.88 0.12 85);
	--color-warning-300: oklch(0.8 0.16 85);
	--color-warning-400: oklch(0.7 0.18 85);
	--color-warning-500: oklch(0.6 0.18 85);
	--color-warning-600: oklch(0.52 0.18 85);
	--color-warning-700: oklch(0.44 0.16 85);
	--color-warning-800: oklch(0.36 0.14 85);
	--color-warning-900: oklch(0.28 0.1 85);
	--color-warning-950: oklch(0.2 0.08 85);

	/* Success palette (green) */
	--color-success-50: oklch(0.98 0.02 155);
	--color-success-100: oklch(0.96 0.05 155);
	--color-success-200: oklch(0.92 0.09 155);
	--color-success-300: oklch(0.86 0.15 155);
	--color-success-400: oklch(0.78 0.2 155);
	--color-success-500: oklch(0.7 0.2 155);
	--color-success-600: oklch(0.62 0.18 155);
	--color-success-700: oklch(0.52 0.14 155);
	--color-success-800: oklch(0.44 0.11 155);
	--color-success-900: oklch(0.38 0.09 155);
	--color-success-950: oklch(0.26 0.06 155);
}
```

### 3. Configure Router Provider

For client-side navigation with `Link` and `NavLink`, wrap your app with React Aria's `RouterProvider`:

```tsx
import { RouterProvider } from "react-aria-components";
import { useNavigate, useHref } from "react-router";

function App() {
	let navigate = useNavigate();

	return (
		<RouterProvider navigate={navigate} useHref={useHref}>
			{/* Your app */}
		</RouterProvider>
	);
}
```

## Component Patterns

### Color System & Inheritance

Components use a shared color system with five semantic colors: `primary`, `neutral`, `success`, `warning`, and `danger`. The default color is `neutral`.

```tsx
import { Button, Card, Badge } from "@pkg/ui";

// Explicit color
<Button color="primary">Primary Button</Button>
<Button color="danger">Danger Button</Button>

// Default is neutral
<Button>Neutral Button</Button>
```

**Color Inheritance:** Colors cascade from parent to child components via React Context. Any component with a `color` prop both consumes and provides color to its children:

```tsx
// All nested components inherit the Card's color
<Card color="danger">
	<Card.Header>
		<Card.Title>Danger Zone</Card.Title>
	</Card.Header>
	<Card.Footer>
		<Button>Inherits danger</Button>
		<Button color="neutral">Explicit neutral override</Button>
	</Card.Footer>
</Card>
```

**Building Custom Colored Components:** Use the exported hooks to integrate with the color system:

```tsx
import { useColor, ColorProvider, type Color } from "@pkg/ui";

function CustomComponent({ color: colorProp }: { color?: Color }) {
	let color = useColor(colorProp); // Resolves from prop or context

	return (
		<ColorProvider color={color}>
			<div data-color={color}>{/* Children will inherit this color */}</div>
		</ColorProvider>
	);
}
```

### Semantic Color Variables

The library defines semantic CSS variables that map color shades to specific uses. These variables automatically adapt to light/dark mode.

| Variable                        | Purpose             | Light | Dark  |
| ------------------------------- | ------------------- | ----- | ----- |
| `--ui-{color}-bg-tint`          | Subtle background   | 50    | 950   |
| `--ui-{color}-bg-tint-hover`    | Tint hover state    | 100   | 900   |
| `--ui-{color}-bg-tint-pressed`  | Tint pressed state  | 200   | 800   |
| `--ui-{color}-bg-solid`         | Solid background    | 600   | 600   |
| `--ui-{color}-bg-solid-hover`   | Solid hover state   | 700   | 700   |
| `--ui-{color}-bg-solid-pressed` | Solid pressed state | 800   | 800   |
| `--ui-{color}-border`           | Subtle border       | 200   | 800   |
| `--ui-{color}-border-strong`    | Strong border       | 600   | 600   |
| `--ui-{color}-ring`             | Focus ring          | 500   | 500   |
| `--ui-{color}-fg`               | Foreground text     | 600   | 400   |
| `--ui-{color}-fg-muted`         | Muted text          | 500   | 400   |
| `--ui-{color}-fg-emphasis`      | Emphasized text     | 900   | 100   |
| `--ui-{color}-fg-on-solid`      | Text on solid bg    | white | white |

**Neutral is special:** Solid backgrounds use inverted shades (dark on light, light on dark) for better contrast:

| Variable                        | Light | Dark |
| ------------------------------- | ----- | ---- |
| `--ui-neutral-bg-solid`         | 900   | 100  |
| `--ui-neutral-bg-solid-hover`   | 800   | 200  |
| `--ui-neutral-bg-solid-pressed` | 700   | 300  |
| `--ui-neutral-fg-on-solid`      | white | 900  |

**Using in custom styles:**

```css
/* Your app's CSS */
.custom-card {
	background-color: var(--ui-primary-bg-tint);
	border-color: var(--ui-primary-border);
	color: var(--ui-primary-fg-emphasis);
}

.custom-card:hover {
	background-color: var(--ui-primary-bg-tint-hover);
}
```

### Data Attributes for Variants

Components use data attributes instead of conditional classes. CSS handles all styling:

```tsx
<Button color="primary" variant="solid" size="md">
	Click me
</Button>
// Renders: <button class="ui-button" data-color="primary" data-variant="solid" data-size="md">
```

### Compound Components

Multi-part components use the `Component.SubComponent` pattern:

```tsx
<Alert color="warning">
	<Alert.Icon>
		<WarningIcon />
	</Alert.Icon>
	<Alert.Content>
		<Alert.Title>Warning</Alert.Title>
		<Alert.Description>Something needs attention.</Alert.Description>
	</Alert.Content>
	<Alert.Action>
		<Button size="sm">Dismiss</Button>
	</Alert.Action>
</Alert>
```

### TypeScript Namespaces

Props are exported via namespaces for clean imports:

```tsx
import { Button } from "@pkg/ui";

// Access props type
type Props = Button.Props;

// Access variant types
type Color = Button.Color; // "primary" | "neutral" | "danger" | "warning" | "success"
type Variant = Button.Variant; // "solid" | "outline" | "ghost"
type Size = Button.Size; // "sm" | "md" | "lg"
```

### className with cn.ClassName

All `className` props accept the `cn.ClassName` type from `@pkg/cn`, allowing arrays and objects:

```tsx
<Button className={["custom-class", isActive && "active", { "opacity-50": isDisabled }]}>
	Flexible className
</Button>
```

## Components

### Buttons

```tsx
import { Button, LinkButton, ToggleButton, ToggleButtonGroup } from "@pkg/ui";

<Button color="primary" variant="solid" size="md">Save</Button>
<Button color="danger" variant="outline">Delete</Button>
<Button color="neutral" variant="ghost">Cancel</Button>

<LinkButton href="/settings">Settings</LinkButton>

<ToggleButton>Toggle</ToggleButton>

<ToggleButtonGroup selectionMode="single">
  <ToggleButton id="left">Left</ToggleButton>
  <ToggleButton id="center">Center</ToggleButton>
  <ToggleButton id="right">Right</ToggleButton>
</ToggleButtonGroup>
```

### Links & Navigation

```tsx
import { Link, NavLink, Breadcrumbs, Breadcrumb } from "@pkg/ui";

// Link with prefetching
<Link href="/about" prefetch="intent">About</Link>
<Link href="/delete" color="danger">Delete Account</Link>

// NavLink for navigation menus (has isActive/isPending states)
<NavLink href="/dashboard" color="primary">Dashboard</NavLink>

// Breadcrumbs
<Breadcrumbs>
  <Breadcrumb href="/">Home</Breadcrumb>
  <Breadcrumb href="/products">Products</Breadcrumb>
  <Breadcrumb>Current Page</Breadcrumb>
</Breadcrumbs>
```

### Forms

```tsx
import {
	Form,
	Label,
	Input,
	TextArea,
	TextField,
	SearchField,
	NumberField,
	Description,
	FieldError,
	Group,
} from "@pkg/ui";

// Basic form with validation
<Form method="post" issues={actionData?.issues}>
	<TextField name="email" type="email" isRequired>
		<Label>Email</Label>
		<Input />
		<Description>We'll never share your email.</Description>
		<FieldError />
	</TextField>

	<TextField name="bio">
		<Label>Bio</Label>
		<TextArea />
		<FieldError />
	</TextField>

	<SearchField name="query">
		<Label>Search</Label>
		<Group>
			<Input />
			<SearchField.ClearButton />
		</Group>
	</SearchField>

	<NumberField name="quantity" minValue={1} maxValue={100}>
		<Label>Quantity</Label>
		<Group>
			<NumberField.DecrementButton />
			<Input />
			<NumberField.IncrementButton />
		</Group>
	</NumberField>

	<Button type="submit">Submit</Button>
</Form>;
```

### Form Validation with @pkg/validate

The Form component integrates with Standard Schema validators:

```tsx
// In your action
import { validate, isFailure } from "@pkg/validate";
import { object, string, email } from "valibot";

let schema = object({
	email: string([email()]),
	name: string(),
});

export async function action({ request }: Route.ActionProps) {
	let result = await validate(request, schema);
	if (isFailure(result)) return badRequest({ issues: result.issues });
	// Handle success...
}

// In your component
export default function Component({ actionData }: Route.ComponentProps) {
	return (
		<Form method="post" issues={actionData?.issues}>
			<TextField name="email">
				<Label>Email</Label>
				<Input />
				<FieldError /> {/* Automatically shows validation errors */}
			</TextField>
			<Button type="submit">Submit</Button>
		</Form>
	);
}
```

### Selection Controls

```tsx
import {
  Checkbox,
  CheckboxGroup,
  Switch,
  RadioGroup,
  Radio,
  Select,
  ListBox,
  ComboBox,
} from "@pkg/ui";

// Checkbox Group
<CheckboxGroup>
  <Label>Features</Label>
  <Checkbox value="notifications">Notifications</Checkbox>
  <Checkbox value="newsletter">Newsletter</Checkbox>
  <Checkbox value="updates">Product Updates</Checkbox>
</CheckboxGroup>

// Checkbox with color
<Checkbox color="primary">Remember me</Checkbox>
<Checkbox color="danger">Delete all data</Checkbox>

// Switch
<Switch>Enable notifications</Switch>

// Radio Group
<RadioGroup>
  <Label>Plan</Label>
  <Radio value="free">Free</Radio>
  <Radio value="pro">Pro</Radio>
  <Radio value="enterprise">Enterprise</Radio>
</RadioGroup>

// Select
<Select name="country">
  <Label>Country</Label>
  <Select.Trigger>
    <Select.Value />
  </Select.Trigger>
  <Popover>
    <ListBox>
      <Select.Item id="us">United States</Select.Item>
      <Select.Item id="uk">United Kingdom</Select.Item>
      <Select.Section>
        <Header>Europe</Header>
        <Select.Item id="de">Germany</Select.Item>
        <Select.Item id="fr">France</Select.Item>
      </Select.Section>
    </ListBox>
  </Popover>
</Select>

// ComboBox
<ComboBox name="framework">
  <Label>Framework</Label>
  <Group>
    <Input />
    <ComboBox.Button />
  </Group>
  <Popover>
    <ListBox>
      <ListBox.Item id="react">React</ListBox.Item>
      <ListBox.Item id="vue">Vue</ListBox.Item>
      <ListBox.Item id="angular">Angular</ListBox.Item>
    </ListBox>
  </Popover>
</ComboBox>
```

### Tabs

```tsx
import { Tabs } from "@pkg/ui";

<Tabs>
	<Tabs.List>
		<Tabs.Tab id="account">Account</Tabs.Tab>
		<Tabs.Tab id="billing">Billing</Tabs.Tab>
		<Tabs.Tab id="team">Team</Tabs.Tab>
	</Tabs.List>
	<Tabs.Panels>
		<Tabs.Panel id="account">Account settings...</Tabs.Panel>
		<Tabs.Panel id="billing">Billing info...</Tabs.Panel>
		<Tabs.Panel id="team">Team members...</Tabs.Panel>
	</Tabs.Panels>
</Tabs>;
```

### Tables

```tsx
import { Table } from "@pkg/ui";

<Table aria-label="Users" selectionMode="multiple">
	<Table.Header>
		<Table.Column isRowHeader>Name</Table.Column>
		<Table.Column>Email</Table.Column>
		<Table.Column>Role</Table.Column>
	</Table.Header>
	<Table.Body>
		<Table.Row>
			<Table.Cell>John Doe</Table.Cell>
			<Table.Cell>john@example.com</Table.Cell>
			<Table.Cell>Admin</Table.Cell>
		</Table.Row>
		<Table.Row>
			<Table.Cell>Jane Smith</Table.Cell>
			<Table.Cell>jane@example.com</Table.Cell>
			<Table.Cell>User</Table.Cell>
		</Table.Row>
	</Table.Body>
</Table>;

// Resizable columns
<Table.ResizableContainer>
	<Table aria-label="Files">
		<Table.Header>
			<Table.Column isRowHeader allowsResizing>
				Name
				<Table.ColumnResizer />
			</Table.Column>
			<Table.Column allowsResizing>
				Size
				<Table.ColumnResizer />
			</Table.Column>
			<Table.Column>Date</Table.Column>
		</Table.Header>
		<Table.Body>{/* rows */}</Table.Body>
	</Table>
</Table.ResizableContainer>;
```

### Overlays

```tsx
import { Dialog, DialogTrigger, Modal, Popover, Tooltip, TooltipTrigger, Menu } from "@pkg/ui";

// Dialog with Modal
<DialogTrigger>
  <Button>Open Dialog</Button>
  <Modal>
    <Dialog>
      <Dialog.Heading>Confirm Action</Dialog.Heading>
      <Dialog.Content>Are you sure?</Dialog.Content>
      <Dialog.Footer>
        <Button slot="close" variant="ghost">Cancel</Button>
        <Button>Confirm</Button>
      </Dialog.Footer>
    </Dialog>
  </Modal>
</DialogTrigger>

// Tooltip
<TooltipTrigger>
  <Button>Hover me</Button>
  <Tooltip>Helpful information</Tooltip>
</TooltipTrigger>

// Menu
<Menu>
  <Menu.Trigger>
    <Button>Actions</Button>
  </Menu.Trigger>
  <Popover>
    <Menu.Item onAction={() => console.log("edit")}>Edit</Menu.Item>
    <Menu.Item onAction={() => console.log("duplicate")}>Duplicate</Menu.Item>
    <Menu.Separator />
    <Menu.Item onAction={() => console.log("delete")}>Delete</Menu.Item>
  </Popover>
</Menu>

// Menu with sections and submenus
<Menu>
  <Menu.Trigger>
    <Button>File</Button>
  </Menu.Trigger>
  <Popover>
    <Menu.Section>
      <Header>Actions</Header>
      <Menu.Item>New</Menu.Item>
      <Menu.Item>Open</Menu.Item>
    </Menu.Section>
    <Menu.Section>
      <Menu.SubmenuTrigger>
        <Menu.Item>Share</Menu.Item>
        <Popover>
          <Menu>
            <Menu.Item>Email</Menu.Item>
            <Menu.Item>Link</Menu.Item>
          </Menu>
        </Popover>
      </Menu.SubmenuTrigger>
    </Menu.Section>
  </Popover>
</Menu>

// Menu with keyboard shortcuts
<Menu>
  <Menu.Trigger>
    <Button>Edit</Button>
  </Menu.Trigger>
  <Popover>
    <Menu.Item>
      <Text slot="label">Cut</Text>
      <Keyboard>Cmd+X</Keyboard>
    </Menu.Item>
    <Menu.Item>
      <Text slot="label">Copy</Text>
      <Keyboard>Cmd+C</Keyboard>
    </Menu.Item>
  </Popover>
</Menu>
```

### AlertDialog

AlertDialog is similar to Dialog but designed for confirmations and important decisions that require user acknowledgment.

```tsx
import { AlertDialog, AlertDialogTrigger } from "@pkg/ui";

<AlertDialogTrigger>
	<Button color="danger">Delete</Button>
	<AlertDialog>
		<AlertDialog.Heading>Delete Item?</AlertDialog.Heading>
		<AlertDialog.Description>This action cannot be undone.</AlertDialog.Description>
		<AlertDialog.Footer>
			<Button slot="close" variant="ghost">
				Cancel
			</Button>
			<Button color="danger">Delete</Button>
		</AlertDialog.Footer>
	</AlertDialog>
</AlertDialogTrigger>;
```

### ConfirmDialog

ConfirmDialog provides a programmatic way to show confirmation dialogs from anywhere in your app.

```tsx
import { ConfirmDialog, confirm } from "@pkg/ui";

// Add ConfirmDialog to your app root
function App() {
	return (
		<>
			{/* Your app */}
			<ConfirmDialog />
		</>
	);
}

// Use confirm() anywhere
async function handleDelete() {
	let confirmed = await confirm({
		title: "Delete item?",
		description: "This cannot be undone.",
		confirmLabel: "Delete",
		cancelLabel: "Cancel",
	});
	if (confirmed) {
		// Perform delete
	}
}
```

### Progress & Meters

```tsx
import { Slider, Meter, ProgressBar } from "@pkg/ui";

// Slider
<Slider defaultValue={50} minValue={0} maxValue={100}>
  <Label>Volume</Label>
  <Slider.Output />
  <Slider.Track>
    <Slider.Thumb />
  </Slider.Track>
</Slider>

// Meter (for known value ranges)
<Meter value={75} minValue={0} maxValue={100}>
  <Label>Storage</Label>
  <Meter.ValueLabel />
  <Meter.Track>
    <Meter.Fill />
  </Meter.Track>
</Meter>

// Progress Bar (for loading states)
<ProgressBar value={60}>
  <Label>Loading</Label>
  <ProgressBar.ValueLabel />
  <ProgressBar.Track>
    <ProgressBar.Fill />
  </ProgressBar.Track>
</ProgressBar>

// Indeterminate progress
<ProgressBar isIndeterminate>
  <Label>Processing...</Label>
</ProgressBar>
```

### Dates

```tsx
import {
  Calendar,
  RangeCalendar,
  DateField,
  DatePicker,
  DateRangePicker,
  TimeField,
} from "@pkg/ui";

// Calendar
<Calendar>
  <Calendar.Header>
    <Calendar.PreviousButton />
    <Calendar.Heading />
    <Calendar.NextButton />
  </Calendar.Header>
  <Calendar.Grid>
    <Calendar.GridHeader>
      {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
    </Calendar.GridHeader>
    <Calendar.GridBody>
      {(date) => <Calendar.Cell date={date} />}
    </Calendar.GridBody>
  </Calendar.Grid>
</Calendar>

// Range Calendar (uses Calendar sub-components for composition)
<RangeCalendar>
  <Calendar.Header>
    <Calendar.PreviousButton />
    <Calendar.Heading />
    <Calendar.NextButton />
  </Calendar.Header>
  <Calendar.Grid>
    <Calendar.GridHeader>
      {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
    </Calendar.GridHeader>
    <Calendar.GridBody>
      {(date) => <Calendar.Cell date={date} />}
    </Calendar.GridBody>
  </Calendar.Grid>
</RangeCalendar>

// Date Field
<DateField name="birthdate">
  <Label>Birth Date</Label>
  <DateField.Input />
</DateField>

// Time Field
<TimeField name="time">
  <Label>Meeting Time</Label>
  <TimeField.Input />
</TimeField>

// Date Picker
<DatePicker name="appointment">
  <Label>Appointment</Label>
  <Group>
    <DatePicker.Input />
    <DatePicker.Button />
  </Group>
  <Popover>
    <DatePicker.Dialog>
      <DatePicker.Calendar />
    </DatePicker.Dialog>
  </Popover>
</DatePicker>

// Date Range Picker
<DateRangePicker name="trip">
  <Label>Trip Dates</Label>
  <DateRangePicker.Group>
    <DateRangePicker.StartInput />
    <span>-</span>
    <DateRangePicker.EndInput />
    <DateRangePicker.Button />
  </DateRangePicker.Group>
  <Popover>
    <DateRangePicker.Dialog>
      <RangeCalendar>
        <Calendar.Header>
          <Calendar.PreviousButton />
          <Calendar.Heading />
          <Calendar.NextButton />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>
            {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
          </Calendar.GridHeader>
          <Calendar.GridBody>
            {(date) => <Calendar.Cell date={date} />}
          </Calendar.GridBody>
        </Calendar.Grid>
      </RangeCalendar>
    </DateRangePicker.Dialog>
  </Popover>
</DateRangePicker>
```

### Collections

```tsx
import { TagGroup, GridList, Tree, Header, Section } from "@pkg/ui";

// Tag Group
<TagGroup selectionMode="multiple">
  <Label>Categories</Label>
  <TagGroup.List>
    <TagGroup.Tag id="react">React</TagGroup.Tag>
    <TagGroup.Tag id="vue">Vue</TagGroup.Tag>
    <TagGroup.Tag id="angular">Angular</TagGroup.Tag>
  </TagGroup.List>
</TagGroup>

// Grid List (reorderable)
<GridList aria-label="Tasks" selectionMode="multiple" dragAndDropHooks={hooks}>
  <GridList.Item>
    <GridList.DragHandle />
    Task 1
  </GridList.Item>
  <GridList.Item>
    <GridList.DragHandle />
    Task 2
  </GridList.Item>
</GridList>

// Grid List with sections
<GridList aria-label="Files">
  <GridList.Section>
    <GridList.Header>Documents</GridList.Header>
    <GridList.Item>Report.pdf</GridList.Item>
    <GridList.Item>Notes.txt</GridList.Item>
  </GridList.Section>
  <GridList.Section>
    <GridList.Header>Images</GridList.Header>
    <GridList.Item>Photo.jpg</GridList.Item>
  </GridList.Section>
</GridList>

// Tree (hierarchical data)
<Tree aria-label="Files">
  <Tree.Item id="documents" textValue="Documents">
    <Tree.ItemContent>
      <Tree.ExpandButton />
      Documents
    </Tree.ItemContent>
    <Tree.Item id="report">
      <Tree.ItemContent>Report.pdf</Tree.ItemContent>
    </Tree.Item>
  </Tree.Item>
  <Tree.Item id="images" textValue="Images">
    <Tree.ItemContent>
      <Tree.ExpandButton />
      Images
    </Tree.ItemContent>
  </Tree.Item>
</Tree>
```

### Layout & Disclosure

```tsx
import { Separator, Toolbar, Disclosure } from "@pkg/ui";

// Separator
<Separator />
<Separator orientation="vertical" />

// Toolbar
<Toolbar>
  <Button>Bold</Button>
  <Button>Italic</Button>
  <Separator orientation="vertical" />
  <Button>Link</Button>
</Toolbar>

// Disclosure (accordion-like)
<Disclosure>
  <Disclosure.Trigger>Show Details</Disclosure.Trigger>
  <Disclosure.Panel>
    Hidden content that expands when triggered.
  </Disclosure.Panel>
</Disclosure>

// Disclosure Group (only one open at a time)
<Disclosure.Group>
  <Disclosure id="faq-1">
    <Disclosure.Trigger>What is this?</Disclosure.Trigger>
    <Disclosure.Panel>This is an FAQ section.</Disclosure.Panel>
  </Disclosure>
  <Disclosure id="faq-2">
    <Disclosure.Trigger>How does it work?</Disclosure.Trigger>
    <Disclosure.Panel>It uses React Aria Components.</Disclosure.Panel>
  </Disclosure>
</Disclosure.Group>
```

### Accordion

Accordion is a specialized component for displaying multiple collapsible sections.

```tsx
import { Accordion } from "@pkg/ui";

<Accordion>
	<Accordion.Item id="item-1">
		<Accordion.Trigger>Section 1</Accordion.Trigger>
		<Accordion.Panel>Content for section 1</Accordion.Panel>
	</Accordion.Item>
	<Accordion.Item id="item-2">
		<Accordion.Trigger>Section 2</Accordion.Trigger>
		<Accordion.Panel>Content for section 2</Accordion.Panel>
	</Accordion.Item>
</Accordion>;
```

### Card

Card is a container component for grouping related content with optional header, content, and footer sections.

```tsx
import { Card } from "@pkg/ui";

<Card color="neutral">
	<Card.Header>
		<Card.Title>Card Title</Card.Title>
		<Card.Description>Optional description</Card.Description>
	</Card.Header>
	<Card.Content>Main card content goes here.</Card.Content>
	<Card.Footer>
		<Button>Action</Button>
	</Card.Footer>
</Card>;
```

### AspectRatio

AspectRatio maintains a consistent aspect ratio for its content, useful for images and videos.

```tsx
import { AspectRatio } from "@pkg/ui";

<AspectRatio ratio={16 / 9}>
	<img src="/image.jpg" alt="..." className="object-cover w-full h-full" />
</AspectRatio>;
```

### Alerts

```tsx
import { Alert } from "@pkg/ui";

<Alert color="primary">
  <Alert.Icon><InfoIcon /></Alert.Icon>
  <Alert.Content>
    <Alert.Title>Information</Alert.Title>
    <Alert.Description>This is an informational message.</Alert.Description>
  </Alert.Content>
</Alert>

<Alert color="danger" live="assertive">
  <Alert.Icon><ErrorIcon /></Alert.Icon>
  <Alert.Content>
    <Alert.Title>Error</Alert.Title>
    <Alert.Description>Something went wrong.</Alert.Description>
  </Alert.Content>
  <Alert.Action>
    <Button size="sm" color="danger" variant="outline">Retry</Button>
  </Alert.Action>
</Alert>
```

### Badge

Badge is a small label component for displaying status, counts, or categories.

```tsx
import { Badge } from "@pkg/ui";

<Badge color="primary">New</Badge>
<Badge color="success">Active</Badge>
<Badge color="warning">Pending</Badge>
<Badge color="danger">Error</Badge>
<Badge color="neutral">Default</Badge>
```

### File Handling

```tsx
import { FileTrigger, DropZone } from "@pkg/ui";

// File Trigger
<FileTrigger onSelect={(files) => console.log(files)} acceptedFileTypes={["image/*"]}>
  <Button>Upload Image</Button>
</FileTrigger>

// Drop Zone
<DropZone onDrop={(e) => console.log(e.items)}>
  <Text>Drop files here</Text>
</DropZone>
```

### Avatar

Circular image placeholder for user profiles with fallback support and grouping.

```tsx
import { Avatar } from "@pkg/ui";

// Basic avatar with image
<Avatar size="md">
  <Avatar.Image src="/user.jpg" alt="John Doe" />
  <Avatar.Fallback>JD</Avatar.Fallback>
</Avatar>

// Avatar sizes: sm, md, lg
<Avatar size="sm">
  <Avatar.Image src="/user.jpg" alt="User" />
  <Avatar.Fallback>U</Avatar.Fallback>
</Avatar>

// Avatar with status badge
<Avatar>
  <Avatar.Image src="/user.jpg" alt="User" />
  <Avatar.Fallback>JD</Avatar.Fallback>
  <Avatar.Badge className="bg-success-500" />
</Avatar>

// Avatar group (stacked avatars)
<Avatar.Group>
  <Avatar size="sm">
    <Avatar.Image src="/user1.jpg" alt="User 1" />
    <Avatar.Fallback>U1</Avatar.Fallback>
  </Avatar>
  <Avatar size="sm">
    <Avatar.Image src="/user2.jpg" alt="User 2" />
    <Avatar.Fallback>U2</Avatar.Fallback>
  </Avatar>
  <Avatar size="sm">
    <Avatar.Image src="/user3.jpg" alt="User 3" />
    <Avatar.Fallback>U3</Avatar.Fallback>
  </Avatar>
  <Avatar.Group.Count>+5</Avatar.Group.Count>
</Avatar.Group>
```

### Logo

Similar to Avatar but with rounded corners instead of circular shape. Ideal for company logos and brand images.

```tsx
import { Logo } from "@pkg/ui";

// Basic logo with image
<Logo size="md">
  <Logo.Image src="/company-logo.png" alt="Acme Inc" />
  <Logo.Fallback>AC</Logo.Fallback>
</Logo>

// Logo sizes: sm, md, lg
<Logo size="lg">
  <Logo.Image src="/logo.png" alt="Company" />
  <Logo.Fallback>CO</Logo.Fallback>
</Logo>

// Logo with badge
<Logo>
  <Logo.Image src="/logo.png" alt="Company" />
  <Logo.Fallback>CO</Logo.Fallback>
  <Logo.Badge className="bg-primary-500" />
</Logo>

// Logo group
<Logo.Group>
  <Logo size="sm">
    <Logo.Image src="/logo1.png" alt="Company 1" />
    <Logo.Fallback>C1</Logo.Fallback>
  </Logo>
  <Logo size="sm">
    <Logo.Image src="/logo2.png" alt="Company 2" />
    <Logo.Fallback>C2</Logo.Fallback>
  </Logo>
  <Logo.Group.Count>+3</Logo.Group.Count>
</Logo.Group>
```

### Spinner

Loading indicator with customizable colors and sizes. Uses React Aria's ProgressBar with `isIndeterminate` for proper accessibility.

```tsx
import { Spinner } from "@pkg/ui";

// Basic spinner (defaults to neutral color via ColorContext)
<Spinner aria-label="Loading" />

// Spinner with explicit color
<Spinner color="primary" aria-label="Loading" />

// Spinner sizes: sm, md, lg
<Spinner size="lg" aria-label="Loading" />

// Spinner inherits color from parent
<Card color="danger">
  <Spinner /> {/* Inherits danger color */}
</Card>

// Button with loading state (Spinner inherits Button's color)
<Button isPending>Saving...</Button>
```

### Carousel

Horizontal scrolling carousel for images, cards, or any content.

```tsx
import { Carousel } from "@pkg/ui";

// Basic carousel
<Carousel aria-label="Featured items">
  <Carousel.Viewport>
    <Carousel.Track>
      <Carousel.Slide>Slide 1</Carousel.Slide>
      <Carousel.Slide>Slide 2</Carousel.Slide>
      <Carousel.Slide>Slide 3</Carousel.Slide>
    </Carousel.Track>
  </Carousel.Viewport>
  <Carousel.Controls>
    <Carousel.Previous />
    <Carousel.Next />
  </Carousel.Controls>
</Carousel>

// Carousel with custom buttons
<Carousel aria-label="Products">
  <Carousel.Viewport>
    <Carousel.Track>
      {products.map((product) => (
        <Carousel.Slide key={product.id}>
          <ProductCard product={product} />
        </Carousel.Slide>
      ))}
    </Carousel.Track>
  </Carousel.Viewport>
  <Carousel.Previous>
    <Button slot="previous" variant="outline">Back</Button>
  </Carousel.Previous>
  <Carousel.Next>
    <Button slot="next" variant="outline">Forward</Button>
  </Carousel.Next>
</Carousel>
```

### Command

Command palette for searching and executing actions. Features built-in filtering.

```tsx
import { Command } from "@pkg/ui";

// Basic command palette
<Command>
  <Command.Input placeholder="Search..." />
  <Command.List>
    <Command.Item onAction={() => console.log("new")}>New File</Command.Item>
    <Command.Item onAction={() => console.log("open")}>Open File</Command.Item>
    <Command.Item onAction={() => console.log("save")}>Save</Command.Item>
  </Command.List>
  <Command.Empty>No results found.</Command.Empty>
</Command>

// Command palette in a dialog
<DialogTrigger>
  <Button>Open Command Palette</Button>
  <Modal>
    <Dialog>
      <Command>
        <Command.Input placeholder="Type a command..." />
        <Command.List>
          <Command.Item textValue="Settings">
            <SettingsIcon />
            Settings
          </Command.Item>
          <Command.Item textValue="Profile">
            <UserIcon />
            Profile
          </Command.Item>
        </Command.List>
      </Command>
    </Dialog>
  </Modal>
</DialogTrigger>
```

### ContextMenu

Right-click context menu with support for submenus, checkboxes, and radio groups.

```tsx
import { ContextMenu } from "@pkg/ui";

// Basic context menu
<ContextMenu>
  <ContextMenu.Trigger>
    <div className="p-4 border">Right-click me</div>
  </ContextMenu.Trigger>
  <ContextMenu.Content>
    <ContextMenu.Item onAction={() => console.log("cut")}>Cut</ContextMenu.Item>
    <ContextMenu.Item onAction={() => console.log("copy")}>Copy</ContextMenu.Item>
    <ContextMenu.Item onAction={() => console.log("paste")}>Paste</ContextMenu.Item>
    <ContextMenu.Separator />
    <ContextMenu.Item danger onAction={() => console.log("delete")}>Delete</ContextMenu.Item>
  </ContextMenu.Content>
</ContextMenu>

// Context menu with groups and shortcuts
<ContextMenu>
  <ContextMenu.Trigger>
    <div>Right-click for options</div>
  </ContextMenu.Trigger>
  <ContextMenu.Content>
    <ContextMenu.Group>
      <ContextMenu.Label>Edit</ContextMenu.Label>
      <ContextMenu.Item>
        Cut
        <ContextMenu.Shortcut>Cmd+X</ContextMenu.Shortcut>
      </ContextMenu.Item>
      <ContextMenu.Item>
        Copy
        <ContextMenu.Shortcut>Cmd+C</ContextMenu.Shortcut>
      </ContextMenu.Item>
    </ContextMenu.Group>
    <ContextMenu.Separator />
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger>Share</ContextMenu.SubTrigger>
      <ContextMenu.SubContent>
        <ContextMenu.Item>Email</ContextMenu.Item>
        <ContextMenu.Item>Slack</ContextMenu.Item>
      </ContextMenu.SubContent>
    </ContextMenu.Sub>
  </ContextMenu.Content>
</ContextMenu>
```

### HoverCard

Card that appears on hover, useful for previews and additional information.

```tsx
import { HoverCard, HoverCardTrigger } from "@pkg/ui";

// Basic hover card
<HoverCardTrigger>
  <Link href="/user/john">@john</Link>
  <HoverCard>
    <div className="p-4">
      <Avatar>
        <Avatar.Image src="/john.jpg" alt="John" />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar>
      <h4>John Doe</h4>
      <p>Software Engineer at Acme Inc.</p>
    </div>
  </HoverCard>
</HoverCardTrigger>

// Hover card with custom delays
<HoverCardTrigger openDelay={200} closeDelay={100}>
  <span>Hover for details</span>
  <HoverCard showArrow={false}>
    <p>Quick preview content</p>
  </HoverCard>
</HoverCardTrigger>
```

### Sheet

Slide-in panel from the left or right side of the screen.

```tsx
import { Sheet, SheetTrigger } from "@pkg/ui";

// Basic sheet (slides from right by default)
<SheetTrigger>
  <Button>Open Sheet</Button>
  <Sheet.Overlay isDismissable>
    <Sheet side="right">
      <Sheet.Content>
        <Sheet.Header>
          <Sheet.Title>Settings</Sheet.Title>
          <Sheet.Description>Configure your preferences.</Sheet.Description>
        </Sheet.Header>
        <div className="p-4">
          {/* Sheet content */}
        </div>
        <Sheet.Footer>
          <Button variant="outline" slot="close">Cancel</Button>
          <Button slot="close">Save</Button>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet>
  </Sheet.Overlay>
</SheetTrigger>

// Sheet from left side
<SheetTrigger>
  <Button>Open Navigation</Button>
  <Sheet.Overlay isDismissable>
    <Sheet side="left">
      <Sheet.Content>
        <Sheet.Header>
          <Sheet.Title>Navigation</Sheet.Title>
        </Sheet.Header>
        <nav>{/* Navigation items */}</nav>
      </Sheet.Content>
    </Sheet>
  </Sheet.Overlay>
</SheetTrigger>
```

### Drawer

Slide-in panel from the top or bottom of the screen, ideal for mobile interfaces.

```tsx
import { Drawer } from "@pkg/ui";
import { DialogTrigger } from "@pkg/ui";

// Drawer from bottom (default)
<DialogTrigger>
  <Button>Open Drawer</Button>
  <Drawer.Overlay isDismissable>
    <Drawer placement="bottom">
      <div className="p-4">
        <h2>Drawer Content</h2>
        <p>This slides up from the bottom.</p>
      </div>
    </Drawer>
  </Drawer.Overlay>
</DialogTrigger>

// Drawer from top
<DialogTrigger>
  <Button>Show Notification</Button>
  <Drawer.Overlay>
    <Drawer placement="top">
      <div className="p-4">
        <p>Notification content here</p>
      </div>
    </Drawer>
  </Drawer.Overlay>
</DialogTrigger>
```

### Toaster

Toast notifications using Sonner. Add the Toaster component once at your app root.

```tsx
import { Toaster } from "@pkg/ui";
import { toast } from "sonner";

// Add Toaster to your app root
function App() {
  return (
    <>
      {/* Your app content */}
      <Toaster position="bottom-right" />
    </>
  );
}

// Show toasts from anywhere
<Button onPress={() => toast("Event created")}>
  Show Toast
</Button>

<Button onPress={() => toast.success("Successfully saved!")}>
  Success Toast
</Button>

<Button onPress={() => toast.error("Something went wrong")}>
  Error Toast
</Button>

<Button onPress={() => toast.promise(saveData(), {
  loading: "Saving...",
  success: "Saved!",
  error: "Failed to save",
})}>
  Promise Toast
</Button>
```

### Sidebar

Collapsible sidebar navigation with support for mobile, keyboard shortcuts, and nested menus.

```tsx
import { Sidebar, useSidebar } from "@pkg/ui";

// Basic sidebar layout
<Sidebar.Provider defaultOpen>
	<Sidebar variant="sidebar" collapsible="icon" side="left">
		<Sidebar.Header>
			<Logo>
				<Logo.Image src="/logo.png" alt="App" />
				<Logo.Fallback>A</Logo.Fallback>
			</Logo>
		</Sidebar.Header>

		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.GroupLabel>Navigation</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuLink href="/dashboard" active tooltip="Dashboard">
								<DashboardIcon />
								<span>Dashboard</span>
							</Sidebar.MenuLink>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem>
							<Sidebar.MenuLink href="/projects" tooltip="Projects">
								<ProjectsIcon />
								<span>Projects</span>
							</Sidebar.MenuLink>
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>

		<Sidebar.Footer>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltip="Settings">
						<SettingsIcon />
						<span>Settings</span>
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Footer>

		<Sidebar.Rail />
	</Sidebar>

	<Sidebar.Inset>
		<header>
			<Sidebar.Trigger>
				<MenuIcon />
			</Sidebar.Trigger>
		</header>
		<main>{/* Page content */}</main>
	</Sidebar.Inset>
</Sidebar.Provider>;

// Using the sidebar hook
function SidebarToggle() {
	let { state, toggleSidebar } = useSidebar();
	return <Button onPress={toggleSidebar}>{state === "expanded" ? "Collapse" : "Expand"}</Button>;
}
```

### OtpField

One-time password input with support for pasting, keyboard navigation, and validation.

```tsx
import { OtpField, Label, FieldError } from "@pkg/ui";

// Basic OTP field
<OtpField length={6} name="code" aria-label="Verification code">
  <Label>Enter verification code</Label>
  <OtpField.Slots />
  <FieldError />
</OtpField>

// OTP with separator
<OtpField length={6}>
  <Label>Code</Label>
  <OtpField.Slots separator="-" />
</OtpField>

// OTP with custom pattern (letters allowed)
<OtpField
  length={4}
  allowedCharacters={/[A-Z0-9]/i}
  inputMode="text"
  autoComplete="one-time-code"
>
  <Label>Backup code</Label>
  <OtpField.Slots />
</OtpField>

// Controlled OTP field
function VerificationForm() {
  let [code, setCode] = useState("");

  return (
    <OtpField value={code} onChange={setCode} length={6}>
      <Label>Enter the code sent to your email</Label>
      <OtpField.Slots />
    </OtpField>
  );
}
```

### Pagination

Navigation for paginated content with links and buttons.

```tsx
import {
	Pagination,
	PaginationList,
	PaginationItem,
	PaginationLink,
	PaginationButton,
} from "@pkg/ui";

// Basic pagination
<Pagination aria-label="Pagination">
	<PaginationList>
		<PaginationItem>
			<PaginationButton aria-label="Previous page" isDisabled>
				Previous
			</PaginationButton>
		</PaginationItem>
		<PaginationItem>
			<PaginationLink href="/items?page=1" isCurrent>
				1
			</PaginationLink>
		</PaginationItem>
		<PaginationItem>
			<PaginationLink href="/items?page=2">2</PaginationLink>
		</PaginationItem>
		<PaginationItem>
			<PaginationLink href="/items?page=3">3</PaginationLink>
		</PaginationItem>
		<PaginationItem>
			<PaginationButton aria-label="Next page">Next</PaginationButton>
		</PaginationItem>
	</PaginationList>
</Pagination>;
```

### NavigationMenu

Horizontal navigation menu with dropdown support for complex navigation structures.

```tsx
import { NavigationMenu } from "@pkg/ui";

// Basic navigation menu
<NavigationMenu>
	<NavigationMenu.List>
		<NavigationMenu.Item>
			<NavigationMenu.Link href="/products">Products</NavigationMenu.Link>
		</NavigationMenu.Item>
		<NavigationMenu.Item>
			<NavigationMenu.Trigger>Solutions</NavigationMenu.Trigger>
			<NavigationMenu.Content>
				<div className="p-4 grid gap-2">
					<NavigationMenu.Link href="/solutions/enterprise">Enterprise</NavigationMenu.Link>
					<NavigationMenu.Link href="/solutions/startups">Startups</NavigationMenu.Link>
					<NavigationMenu.Link href="/solutions/developers">Developers</NavigationMenu.Link>
				</div>
			</NavigationMenu.Content>
		</NavigationMenu.Item>
		<NavigationMenu.Item>
			<NavigationMenu.Link href="/pricing">Pricing</NavigationMenu.Link>
		</NavigationMenu.Item>
	</NavigationMenu.List>
</NavigationMenu>;
```

### Resizable

Resizable panels with drag handles and keyboard support.

```tsx
import { Resizable } from "@pkg/ui";

// Horizontal resizable panels
<Resizable orientation="horizontal">
  <Resizable.Panel defaultSize={30} minSize={20}>
    <div className="p-4">Left Panel</div>
  </Resizable.Panel>
  <Resizable.Handle />
  <Resizable.Panel defaultSize={70}>
    <div className="p-4">Right Panel</div>
  </Resizable.Panel>
</Resizable>

// Vertical resizable panels
<Resizable orientation="vertical" className="h-96">
  <Resizable.Panel defaultSize={50} minSize={20} maxSize={80}>
    <div className="p-4">Top Panel</div>
  </Resizable.Panel>
  <Resizable.Handle />
  <Resizable.Panel>
    <div className="p-4">Bottom Panel</div>
  </Resizable.Panel>
</Resizable>

// Controlled resizable
function ControlledPanels() {
  let [sizes, setSizes] = useState([30, 70]);

  return (
    <Resizable sizes={sizes} onSizesChange={setSizes}>
      <Resizable.Panel>Panel 1</Resizable.Panel>
      <Resizable.Handle />
      <Resizable.Panel>Panel 2</Resizable.Panel>
    </Resizable>
  );
}
```

### ScrollArea

Custom scrollable area with styled scrollbars.

```tsx
import { ScrollArea } from "@pkg/ui";

// Vertical scroll area
<ScrollArea className="h-72 w-48">
  <ScrollArea.Viewport>
    <div className="p-4">
      {/* Long content */}
    </div>
  </ScrollArea.Viewport>
</ScrollArea>

// Horizontal scroll area
<ScrollArea className="w-96">
  <ScrollArea.Viewport orientation="horizontal">
    <div className="flex gap-4 p-4">
      {items.map((item) => (
        <div key={item.id} className="w-48 shrink-0">{item.name}</div>
      ))}
    </div>
  </ScrollArea.Viewport>
</ScrollArea>

// Both directions
<ScrollArea className="h-72 w-96">
  <ScrollArea.Viewport orientation="both">
    <div className="w-200 h-150">
      {/* Large content */}
    </div>
  </ScrollArea.Viewport>
</ScrollArea>
```

### Skeleton

Placeholder loading state for content.

```tsx
import { Skeleton } from "@pkg/ui";

// Basic skeleton
<Skeleton className="h-4 w-48" />

// Card skeleton
<div className="flex items-center gap-4">
  <Skeleton className="h-12 w-12 rounded-full" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-4 w-24" />
  </div>
</div>

// List skeleton
<div className="space-y-3">
  {[1, 2, 3].map((i) => (
    <Skeleton key={i} className="h-16 w-full rounded" />
  ))}
</div>
```

### Empty

Empty state component for when there's no content to display.

```tsx
import { Empty, Button } from "@pkg/ui";

// Basic empty state
<Empty color="neutral">
  <Empty.Icon>
    <InboxIcon />
  </Empty.Icon>
  <Empty.Title>No messages</Empty.Title>
  <Empty.Description>You don't have any messages yet.</Empty.Description>
  <Empty.Action>
    <Button>Compose</Button>
  </Empty.Action>
</Empty>

// Empty state with different colors
<Empty color="primary">
  <Empty.Icon>
    <SearchIcon />
  </Empty.Icon>
  <Empty.Title>No results found</Empty.Title>
  <Empty.Description>Try adjusting your search criteria.</Empty.Description>
</Empty>

// Error empty state
<Empty color="danger">
  <Empty.Icon>
    <AlertIcon />
  </Empty.Icon>
  <Empty.Title>Failed to load</Empty.Title>
  <Empty.Description>Something went wrong. Please try again.</Empty.Description>
  <Empty.Action>
    <Button color="danger" variant="outline">Retry</Button>
  </Empty.Action>
</Empty>
```

## Customizing Styles

All components use Tailwind v4 `@utility` with `:where()` for zero specificity, making them easy to override:

```css
/* Your app's CSS - easily override any component */
.ui-button {
	border-radius: theme(borderRadius.full); /* Make all buttons fully rounded */
}

.ui-button[data-color="primary"][data-variant="solid"] {
	background: linear-gradient(to right, var(--color-primary-500), var(--color-primary-600));
}
```

## Accessibility

All components are built on React Aria Components, providing:

- Full keyboard navigation
- Screen reader announcements
- Focus management
- ARIA attributes
- Touch-friendly interactions

The `Alert` component includes `aria-live` regions for dynamic content:

```tsx
<Alert color="success" live="polite">...</Alert>   {/* Default: polite */}
<Alert color="danger" live="assertive">...</Alert> {/* Urgent messages */}
<Alert color="primary" live="off">...</Alert>       {/* Static alerts */}
```

## Utility Components

These are generic components useful for building custom patterns:

```tsx
import {
  Header,
  Heading,
  Text,
  Section,
  Keyboard,
  OverlayArrow,
  DropIndicator,
  SelectionIndicator,
  SharedElement,
} from "@pkg/ui";

// Header - for section headers in menus, lists, etc.
<Header>Section Title</Header>

// Heading - for dialog titles and headings
<Heading>Dialog Title</Heading>

// Text - generic text with slot support
<Text slot="label">Menu item label</Text>
<Text slot="description">Optional description</Text>

// Keyboard - display keyboard shortcuts
<Keyboard>Cmd+S</Keyboard>

// OverlayArrow - arrow pointing from popover to trigger
<Popover>
  <OverlayArrow>
    <svg width={12} height={12} viewBox="0 0 12 12">
      <path d="M0 0 L6 6 L12 0" />
    </svg>
  </OverlayArrow>
  {/* content */}
</Popover>

// DropIndicator - visual feedback during drag and drop
<GridList dragAndDropHooks={hooks}>
  {items.map((item) => (
    <>
      <DropIndicator target={{ type: "item", key: item.id, dropPosition: "before" }} />
      <GridList.Item key={item.id}>{item.name}</GridList.Item>
    </>
  ))}
</GridList>

// SelectionIndicator - checkmark in selection menus
<Menu selectionMode="single">
  <Menu.Item>
    <SelectionIndicator />
    <Text slot="label">Option 1</Text>
  </Menu.Item>
</Menu>

// SharedElement - view transitions between pages
<SharedElement id="hero-image">
  <img src="/hero.jpg" />
</SharedElement>
```

## Related Packages

- `@pkg/cn` - Used for className merging in all components
- [React Aria Components](https://react-spectrum.adobe.com/react-aria/components.html) - The accessibility foundation

## Tips

1. Import styles with `@import "@pkg/ui/styles.css"` in your CSS
2. Use the color system consistently - all components support the same 5 colors
3. Components use data attributes for styling - override with CSS selectors like `.ui-button[data-color="primary"]`
4. Wrap your app with `RouterProvider` for Link components to work with React Router
