# Payment Profile — Phase A Design Spec
**Date:** 2026-04-27
**Scope:** Bank details storage, settings UI, and provider eligibility gates. No live payment processing (PayPal/UPI transfers deferred to Phase B).

---

## 1. Goal

Allow users and providers to save their bank/UPI payment details once. Use those details as an eligibility gate: a user cannot send a service request to a provider who has not yet filled in their bank details.

---

## 2. Data Model

### New table: `payment_profiles`

One-to-one with `users` via `user_id` (UUID FK, unique constraint).

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | PK |
| `user_id` | UUID | No | FK → users.id, unique |
| `account_holder_name` | String | No | 2–60 chars, alpha/space only |
| `account_number_encrypted` | Text | No | Fernet-encrypted at rest |
| `account_number_last4` | String(4) | No | Stored plaintext for masked display |
| `ifsc_code` | String(11) | No | Format-validated (regex) |
| `branch` | String | No | Auto-entered by user, not from API |
| `upi_id` | String | Yes | Provider only (e.g. `name@bank`) |
| `upi_qr_image_url` | String | Yes | Provider only — uploaded image URL |
| `created_at` | DateTime | No | UTC, naive |
| `updated_at` | DateTime | No | UTC, naive, auto-updated |

### Relationship on `User`
```python
payment_profile: Mapped[Optional["PaymentProfile"]] = relationship(
    back_populates="user", uselist=False, cascade="all, delete-orphan"
)
```

### Helper property
```python
@property
def has_bank_details(self) -> bool:
    p = self.payment_profile
    return (
        p is not None
        and bool(p.account_holder_name)
        and bool(p.account_number_encrypted)
        and bool(p.ifsc_code)
        and bool(p.branch)
    )
```

### Migration
File: `backend/alembic/versions/27_04_2026_add_payment_profiles.py`

---

## 3. Encryption

- Library: `cryptography` (Fernet, already a transitive dependency via `python-jose`; add explicitly to `requirements.txt` if not present).
- Key: stored in `backend/.env` as `PAYMENT_ENCRYPTION_KEY` (base64 Fernet key, generated once via `Fernet.generate_key()`).
- Added to `backend/app/core/config.py` as `payment_encryption_key: str`.
- Helper module: `backend/app/core/encryption.py` — `encrypt(value: str) -> str` and `decrypt(value: str) -> str`.
- On write: encrypt full account number, store last 4 digits separately.
- On read (GET own profile): return `account_number_last4` only (masked display as `XXXXXX{last4}`). Full decryption never exposed via API.

---

## 4. Backend API

New router: `backend/app/api/payment/endpoints.py`  
Prefix: `/api/v1/payment`  
Registered in `backend/app/main.py`.

### Endpoints

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/payment/user` | USER | Get own payment profile (masked) |
| POST | `/payment/user` | USER | Create or update user payment profile |
| GET | `/payment/provider` | SERVICER | Get own payment profile (masked) |
| POST | `/payment/provider` | SERVICER | Create or update provider payment profile (includes UPI fields) |
| GET | `/payment/provider/{provider_id}/status` | USER | Returns `{"has_payment_profile": bool}` — no sensitive data |

### Schemas (`backend/app/api/payment/schemas.py`)

**UserPaymentProfileCreate:**
```
account_holder_name: str (2–60)
account_number: str (9–18 digits, confirmed via frontend)
ifsc_code: str (regex: ^[A-Z]{4}0[A-Z0-9]{6}$)
branch: str
```

**ProviderPaymentProfileCreate** (extends above):
```
upi_id: Optional[str] (pattern: .+@.+)
upi_qr_image_url: Optional[str]
```

**PaymentProfileRead** (response, always masked):
```
id: UUID
account_holder_name: str
account_number_masked: str  # "XXXXXX1234"
ifsc_code: str
branch: str
upi_id: Optional[str]
upi_qr_image_url: Optional[str]
created_at: datetime
updated_at: datetime
```

**ProviderPaymentStatusRead:**
```
provider_id: UUID
has_payment_profile: bool
```

---

## 5. Provider List Annotation

Endpoint: `GET /services/providers` (existing).  
Change: add `has_payment_profile: bool` to the provider list response, populated via a single batch query (same pattern as `completed_jobs` annotation).  
No change to sort order or existing fields.

---

## 6. Frontend — Settings Pages

### `/user/settings/payment`
- New tab "Payment" added to the existing settings tab bar.
- Sections:
  - **Bank Account** — Name, Account Number, Confirm Account Number, IFSC (regex validated inline), Branch.
  - Show masked account number once saved (`XXXXXX1234`).
  - "Edit" button re-opens the form.
- No UPI section for users.

### `/service/settings/payment`
- New tab "Payment" in the provider settings tab bar.
- Sections:
  - **Bank Account** — same fields as user.
  - **UPI** — UPI ID (text), UPI QR (image upload).
- Completion status badges: ✅ Bank, ✅ UPI (green if filled, grey if not).

### IFSC Validation (frontend)
Regex: `/^[A-Z]{4}0[A-Z0-9]{6}$/i` — applied on blur, inline error message.

### Confirm Account Number
Two separate inputs. On submit, JS checks they match before calling the API. No confirm field sent to backend.

---

## 7. Provider Dashboard Banner

File: `frontend/app/service/dashboard/page.tsx`  
On page load, call `GET /payment/provider`. If response is 404 (no profile) or `account_number_encrypted` is missing, show a non-dismissable banner:

> "Add your bank details to start accepting jobs → [Complete Setup]"

Link goes to `/service/settings/payment`.

---

## 8. Provider List — Eligibility Gate (User Side)

File: `frontend/app/user/providers/page.tsx` (and wherever provider cards are rendered for service requests).

- Each provider card reads `has_payment_profile` from the list response.
- If `false`: show badge "Not yet accepting bookings" and disable the "Send Request" button with a tooltip "This provider hasn't set up payment details yet."
- If `true`: normal flow, button active.

No change to the backend booking creation or request submission logic.

---

## 9. Validation Rules

| Field | Rule |
|---|---|
| `account_holder_name` | Required, 2–60 chars, letters and spaces only |
| `account_number` | Numeric, 9–18 digits, must match confirm field |
| `ifsc_code` | Regex `^[A-Z]{4}0[A-Z0-9]{6}$` (case-insensitive input, stored uppercase) |
| `branch` | Required, 1–100 chars |
| `upi_id` | Optional, pattern `.+@.+` |
| `upi_qr_image_url` | Optional, valid image URL or upload path |

---

## 10. What Does NOT Change

- Booking creation logic (`POST /bookings/create`)
- Booking status flow (Pending → Accepted → In Progress → Completed)
- Receipt / confirm / flag / complaint endpoints
- Provider rating / points system
- Emergency SOS flow
- Service request creation endpoint (gate is enforced at UI only, via `has_payment_profile` flag)
- Admin / Secretary portals

---

## 11. Files Created / Modified

### New
- `backend/app/payment/domain/model.py` — `PaymentProfile` model
- `backend/app/api/payment/endpoints.py` — router
- `backend/app/api/payment/schemas.py` — Pydantic schemas
- `backend/app/core/encryption.py` — Fernet helpers
- `backend/alembic/versions/27_04_2026_add_payment_profiles.py`
- `frontend/app/user/settings/payment/page.tsx`
- `frontend/app/service/settings/payment/page.tsx`

### Modified
- `backend/app/auth/domain/model.py` — add `payment_profile` relationship to `User`
- `backend/app/core/config.py` — add `PAYMENT_ENCRYPTION_KEY`
- `backend/app/main.py` — register payment router
- `backend/requirements.txt` — ensure `cryptography` is listed
- `backend/.env` — add `PAYMENT_ENCRYPTION_KEY`
- `frontend/app/user/settings/*/page.tsx` — add Payment tab to tab bar
- `frontend/app/service/settings/*/page.tsx` — add Payment tab to tab bar
- `frontend/app/service/dashboard/page.tsx` — add missing-payment-details banner
- `frontend/app/user/providers/page.tsx` — eligibility gate on provider cards
- Provider list schema/endpoint — add `has_payment_profile` annotation

---

## 12. Out of Scope (Phase B)

- PayPal OAuth connect
- Live payment transfer (Systematic Flow)
- UPI payment initiation (Direct Flow panel)
- Transaction ID storage
- Refund / dispute via payment rail
- Audit log for payment detail edits
- Block edits while payment in-flight
