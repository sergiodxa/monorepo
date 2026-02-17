# ADR-004: Admin Panel and User Profile

## Status

Accepted

## Context

The auth server needs administrative capabilities to manage OAuth clients and user subjects, as well as a self-service profile page for authenticated users.

Currently:

- Admins have no way to view or manage clients through the UI
- Admins cannot view or manage user accounts
- Users cannot view or edit their own profile information
- The `subjects.role` field exists but isn't used for access control

## Decision

Implement an admin panel accessible only to users with `role === "admin"` and a profile section for all authenticated users.

### Admin Panel (`/admin/*`)

**Access Control:**

- Middleware checks `subject.role === "admin"`
- Non-admins are redirected to `/sessions`

**Features:**

1. **Dashboard** (`/admin`) - Stats overview with cards showing:
   - Total clients count
   - Total subjects count
   - Active sessions count

2. **Clients Management** (`/admin/clients/*`):
   - List all clients with pagination
   - Create new clients (secret auto-generated, shown only once)
   - View client details
   - Edit client (name, URIs, option to regenerate secret)
   - Delete client (with confirmation dialog)

3. **Subjects Management** (`/admin/subjects/*`):
   - List all subjects with pagination
   - View subject details and their sessions
   - Edit subject (display name, username, role)
   - No create (users must sign up)
   - No delete (for data integrity)

### User Profile (`/profile/*`)

**Access Control:**

- Available to all authenticated users (via `_authenticated` layout)

**Features:**

1. **View Profile** (`/profile`) - Display current user's info
2. **Edit Profile** (`/profile/edit`) - Update display name, username, avatar URL

### Navigation

Admin panel uses a toolbar-based navigation (similar to blog CMS):

- Dashboard | Clients | Subjects

### Security Considerations

1. **Client Secrets**: Only displayed once at creation time. Stored in database but never shown again in UI.

2. **Role-based Access**: Admin routes protected by middleware checking `subject.role`.

3. **Confirmation Dialogs**: Destructive actions (delete) require user confirmation via `@pkg/ui` confirm dialog.

4. **Self-service Limits**: Users can only edit their own profile, not their email (identity) or role.

## Implementation

### Route Structure

```
_authenticated.admin/           - Admin layout with nav + role check
_authenticated.admin._index/    - Dashboard with stats
_authenticated.admin.clients/   - Clients list
_authenticated.admin.clients_.new/
_authenticated.admin.clients_.$clientId/
_authenticated.admin.clients_.$clientId_.edit/
_authenticated.admin.subjects/  - Subjects list
_authenticated.admin.subjects_.$subjectId/
_authenticated.admin.subjects_.$subjectId_.edit/
_authenticated.profile/         - User profile view
_authenticated.profile_.edit/   - Edit profile
```

### Model Extensions

**Client:**

- `findAll(db, { limit, offset })` - Paginated list
- `count(db)` - Total count
- `create(db, input)` - Create with auto-generated secret
- `update(db, id, input)` - Update fields
- `delete(db, id)` - Delete client

**Subject:**

- `findAll(db, { limit, offset })` - Paginated list
- `count(db)` - Total count

**Session:**

- `countActive(db)` - Count non-expired sessions

### Shared Components

- `app-header.tsx` - Page header with title and optional action buttons
- `stat-card.tsx` - Card displaying a stat with label, value, and description

## Consequences

### Positive

- Admins can manage OAuth clients without database access
- Admins can view and moderate user accounts
- Users have self-service profile management
- Role-based access control properly enforced
- Consistent UI patterns from uptime app (stat cards, app header)

### Negative

- Additional routes and components to maintain
- Need to be careful about exposing sensitive data (secrets, emails)

### Future Considerations

- Avatar file upload to R2 (currently URL-only)
- Audit logging for admin actions
- Bulk operations for clients/subjects
- Search functionality for large lists
