# Secretary Home Members Module — Design Spec

**Date:** 2026-04-13
**Status:** Approved

---

## Problem

The secretary currently can only assign a home number to users who have already signed up on the app. There is no way to register flat residents who have not joined the platform. The dashboard also has redundant sections (Society Members list, Society Homes grid) that duplicate dedicated pages.

---

## Solution

Introduce a standalone `HomeMember` entity that the secretary manages independently of app user accounts. Add a two-tab Members page (App Users + Home Members). Clean up the dashboard by removing the redundant sections.

---

## Backend

### New Model: `HomeMember`

File: `backend/app/home_member/domain/model.py`

```
Table: home_members
- id          UUID PK
- society_id  UUID FK → societies (cascade delete)
- full_name   String, not null
- family_members  Integer, not null (count of people in the flat)
- house_no    String, not null
- mobile      String, not null
- created_at  DateTime, default utcnow
```

### New Migration

File: `backend/alembic/versions/13_04_2026_add_home_members.py`

Creates the `home_members` table with the fields above.

### New Endpoints

Prefix: `/api/v1/secretary/home-members`
Auth: `SECRETARY` role only, scoped to their society.

| Method | Path | Description |
|---|---|---|
| POST | `/secretary/home-members` | Create a home member record |
| GET | `/secretary/home-members` | List all home members for the society |
| DELETE | `/secretary/home-members/{id}` | Delete a home member record |

### New Schemas

File: `backend/app/api/secretary/schemas.py` (extend existing file)

```
HomeMemberCreate:
  - full_name: str (required)
  - family_members: int (required, ≥ 1)
  - house_no: str (required)
  - mobile: str (required)

HomeMemberRead:
  - id: UUID
  - society_id: UUID
  - full_name: str
  - family_members: int
  - house_no: str
  - mobile: str
  - created_at: datetime
```

---

## Frontend

### Members Page (`/secretary/members`)

Redesigned with two tabs:

**Tab 1 — App Users** (existing content, unchanged logic)
- Shows signed-up users in the society
- Search by name/email
- Active/Inactive filter

**Tab 2 — Home Members** (new)
- Lists secretary-added resident records
- Sorted by `house_no` ascending, then `full_name`
- Each card shows: House No, Full Name, Family Members count, Mobile
- "Add Home Member" button in the page header (visible on this tab)
- Clicking opens a modal with 4 mandatory fields:
  - Full Name (text input)
  - Family Members (number input, min 1)
  - House No (text input)
  - Mobile Number (text input)
- Delete button on each record (with confirmation)

### Dashboard (`/secretary/dashboard`)

**Remove:**
- "Society Members" quick view list section
- "Society Homes" grid section
- The existing "Add Home" modal and all its state (`showAddHome`, `homeForm`, `addingHome`)
- The `Plus` and `Home` icon imports (if unused after removal)

**Keep:**
- Society card with inline edit
- 4 stats cards (Members, Open Alerts, Available Now, Total Providers)
- Recent Alerts panel
- Available Servicers panel
- Report Issue button + complaints modal

---

## Data Flow

```
Secretary clicks "Add Home Member"
  → Modal opens (4 fields, all mandatory)
    → POST /secretary/home-members
      → Backend validates society membership
        → Inserts into home_members table
          → Returns HomeMemberRead
            → Frontend appends to list, closes modal
```

---

## Constraints

- All 4 modal fields are mandatory — form submit disabled if any is empty
- `family_members` must be ≥ 1
- Records are scoped to the secretary's society (backend enforces this)
- Deletion is immediate (no soft-delete)
- No pagination needed (college project scale)
