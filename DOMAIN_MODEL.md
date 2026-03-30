# Domain Model

> Updated: <!-- date -->

## Context Map

```
[Identity & Access] ──upstream──▶ [All other contexts]
```

## Bounded Context 1: Identity & Access

### Aggregates
- **User**: id, name, email, image
- **Organization**: id, name, slug, logo
- **Invitation**: id, email, role, status, expiresAt

### Domain Events
- UserAuthenticated
- OrganizationCreated
- MemberInvited
- InvitationAccepted

### Routes
- `/(auth)/sign-in`
- `/(app)/settings`

---

<!-- Add more bounded contexts as the project evolves -->
