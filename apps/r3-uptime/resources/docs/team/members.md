---
title: Team Members & Roles
description: Manage your team with Owner, Admin, and Member roles. Control who can access settings, API keys, and billing.
section:
  title: Team & Settings
  order: 3
order: 1
lastUpdated: 2026-02-14
---

Every team member is assigned one of three roles that determine what they can access and modify within your team's workspace.

## Role Permissions

### Owner

The Owner has complete control over the team and is typically the person who created it. There can only be one Owner per team.

Owners can:

- Access and modify all monitors, alerts, and status pages
- Manage billing and subscription settings
- Create and revoke API keys
- Invite, remove, and change roles of team members
- Modify team settings (name, URL slug, etc.)
- Transfer ownership to another Admin
- Delete the team entirely

### Admin

Admins have broad access to manage day-to-day operations but cannot perform destructive team-level actions.

Admins can:

- Access and modify all monitors, alerts, and status pages
- Create and revoke API keys
- Invite and remove team members
- Change member roles (promote to Admin or demote to Member)
- Modify team settings

Admins cannot:

- Access billing settings
- Transfer team ownership
- Delete the team

### Member

Members can work with monitors and status pages but have limited access to team-level settings.

Members can:

- View, create, edit, and delete monitors
- Manage alerts and notification preferences
- Create and manage status pages
- View team member list

Members cannot:

- Access or create API keys
- Invite or remove team members
- Change team settings
- Access billing information

## Changing Roles

Owners and Admins can change the role of any team member except the Owner.

1. Go to **Team Settings** > **Members**
2. Find the member whose role you want to change
3. Click the role dropdown next to their name
4. Select the new role (Admin or Member)

The change takes effect immediately. The member will see their updated permissions the next time they load the dashboard.

## Transferring Ownership

Only the current Owner can transfer ownership, and only to an existing Admin.

1. Go to **Team Settings** > **Members**
2. Find the Admin you want to make the new Owner
3. Click the three-dot menu next to their name
4. Select **Transfer Ownership**
5. Confirm the transfer

After the transfer:

- The selected Admin becomes the new Owner
- You become an Admin
- All billing responsibility transfers to the new Owner

This action cannot be undone without the new Owner's cooperation.

## Removing Team Members

Owners and Admins can remove any member except the Owner.

1. Go to **Team Settings** > **Members**
2. Find the member you want to remove
3. Click the three-dot menu next to their name
4. Select **Remove from team**
5. Confirm the removal

Removed members immediately lose access to the team. Any monitors, alerts, or status pages they created remain intact and are still accessible by other team members.

To remove yourself from a team, use the **Leave Team** option in your account settings. Owners cannot leave their team without first transferring ownership.
