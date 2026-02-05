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

Import the component styles in your app's CSS:

```css
@import "@pkg/ui/styles.css";
```

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
<Alert variant="warning">
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
type Color = Button.Color; // "primary" | "neutral" | "danger" | "warning"
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
	if (isFailure(result)) return badRequet({ issues: result.issues });
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

### Alerts

```tsx
import { Alert } from "@pkg/ui";

<Alert variant="info">
  <Alert.Icon><InfoIcon /></Alert.Icon>
  <Alert.Content>
    <Alert.Title>Information</Alert.Title>
    <Alert.Description>This is an informational message.</Alert.Description>
  </Alert.Content>
</Alert>

<Alert variant="danger" live="assertive">
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
<Alert variant="success" live="polite">...</Alert>   {/* Default: polite */}
<Alert variant="danger" live="assertive">...</Alert> {/* Urgent messages */}
<Alert variant="info" live="off">...</Alert>         {/* Static alerts */}
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
