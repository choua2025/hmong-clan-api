# Design — Officers, Expenses, and Shared Assets

Extends the Vang clan system with three domains: who holds office, how money
leaves the association, and what the association owns.

Conventions carried over from `claude.md`: money is `Decimal(12,2)`, names are
bilingual (Hmong + Lao/English), access is scoped by role, and no OCR value is
ever trusted without a human confirming it.

---

## 1. Three decisions that shape everything below

### 1.1 Office is not a permission

`User.role` (`SUPER_ADMIN` / `LEADER` / `TREASURER` / `MEMBER`) answers *what
may this login do*. "President" answers *who does the association elect to
lead it*. These must not be merged:

- The president may be an elder with **no login at all**.
- Terms end. Permissions should not silently vanish when a term expires, nor
  linger when someone leaves office.
- You need history — "who was president in 2020?" — which an overwritten
  `role` column cannot answer.

So office is modelled as **`OfficeTerm`**, a dated record attached to a
`Member`. Granting a login remains a separate, deliberate act.

### 1.2 Expenses are not negative Payments

`Payment` is documented as the single settlement record for `Dues`,
`Donation`, and `AidContribution` — all money coming **in**. Reusing it for
outflow would mean every existing `SUM(amount)` silently starts mixing
directions, and a missed sign becomes a wrong balance in an audited ledger.

Outflow gets its own model, **`Expense`**, with its own lifecycle. Inflow
aggregates keep working untouched.

The two also differ in evidence and in who acts: an inflow is proven by a
transfer **slip** the payer uploads and the treasurer confirms; an outflow is
proven by a **receipt** and must be *approved before* the money moves.

### 1.3 Bulk assets are counted, not enumerated

200 chairs are one `Asset` row with `quantity = 200`, not 200 rows. Loans
record how many went out and how many came back; availability is derived.

---

## 2. Officers

```prisma
enum OfficePosition {
  PRESIDENT
  VICE_PRESIDENT
  SECRETARY
  TREASURER
  COMMITTEE_MEMBER
  ADVISOR          // elders in an advisory, non-executive capacity
}

/// A dated term of office held by a member. History is preserved: ending a
/// term never deletes the row.
model OfficeTerm {
  id       String @id @default(uuid())
  memberId String
  member   Member @relation("MemberOfficeTerms", fields: [memberId], references: [id], onDelete: Cascade)

  position   OfficePosition
  titleHmong String?
  titleLao   String?

  startedAt DateTime
  endedAt   DateTime?

  /// true while current, NULL once ended. Postgres treats NULLs as distinct,
  /// so the unique index below allows many past holders but only ONE current
  /// holder per position. Never store `false` here — use NULL.
  isCurrent Boolean?

  appointedById String?
  appointedBy   User?   @relation("OfficeTermAppointedBy", fields: [appointedById], references: [id], onDelete: SetNull)
  notes         String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([position, isCurrent])
  @@index([memberId])
}
```

**Rules**

- Ending a term sets `endedAt` and `isCurrent = null` in one transaction.
- Appointing while a term is current must end the incumbent's term first;
  the unique index makes a double-president impossible at the database level
  rather than by convention.
- `TREASURER` appears in both `OfficePosition` and `Role` deliberately —
  the office and the system permission are granted separately.

**If the association elects two vice-presidents**, add a `seat Int @default(1)`
column and widen the index to `@@unique([position, seat, isCurrent])`.

---

## 3. Expenses

```prisma
enum ExpenseCategory {
  FOOD
  VENUE
  TRANSPORT
  SUPPLIES
  HONORARIUM   // shamans, elders, musicians, officiants
  UTILITIES
  MAINTENANCE  // repair of an association asset
  ADMIN
  OTHER
}

enum ExpenseStatus {
  DRAFT
  SUBMITTED  // awaiting approval
  APPROVED   // cleared to pay, money has NOT moved yet
  REJECTED
  PAID       // money has left the association
  VOID
}

model Expense {
  id          String          @id @default(uuid())
  title       String
  titleLao    String?
  description String?
  category    ExpenseCategory @default(OTHER)

  amount   Decimal @db.Decimal(12, 2)
  currency String  @default("LAK")

  incurredAt DateTime @default(now())

  // What the spending relates to. All optional — an expense may be general
  // overhead tied to nothing.
  eventId   String?
  event     Event?         @relation(fields: [eventId], references: [id], onDelete: SetNull)
  aidCaseId String?
  aidCase   MutualAidCase? @relation(fields: [aidCaseId], references: [id], onDelete: SetNull)
  assetId   String?
  asset     Asset?         @relation(fields: [assetId], references: [id], onDelete: SetNull)

  // Payee is usually a vendor, not a clan member, so it is free text.
  payeeName  String?
  payeePhone String?

  /// Photo of the receipt or invoice — the outflow counterpart of Payment.slipUrl.
  receiptUrl String?

  status ExpenseStatus @default(DRAFT)

  requestedById String?
  requestedBy   User?   @relation("ExpenseRequestedBy", fields: [requestedById], references: [id], onDelete: SetNull)

  approvedById String?
  approvedBy   User?     @relation("ExpenseApprovedBy", fields: [approvedById], references: [id], onDelete: SetNull)
  approvedAt   DateTime?

  disbursedById String?
  disbursedBy   User?     @relation("ExpenseDisbursedBy", fields: [disbursedById], references: [id], onDelete: SetNull)
  disbursedAt   DateTime?

  rejectReason String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([eventId])
  @@index([incurredAt])
}
```

`Event` also gains a budget so plan and actual can be compared:

```prisma
budgetAmount Decimal? @db.Decimal(12, 2)
```

### Lifecycle

```
DRAFT ──submit──► SUBMITTED ──approve──► APPROVED ──disburse──► PAID
                      │
                      └──reject──► REJECTED        (VOID cancels an error)
```

**Separation of duties — the rule that makes this auditable:**

1. The **requester** cannot be the **approver**. Enforce in the service layer.
2. Approval requires a *current* `OfficeTerm` of `PRESIDENT` (or
   `VICE_PRESIDENT` when the president is the requester or absent), or
   `SUPER_ADMIN` as override.
3. Only `TREASURER` may move `APPROVED → PAID`, and only with a `receiptUrl`.
4. `amount` becomes immutable once `APPROVED`. Changing a figure after
   approval means voiding and re-raising.

Consider a threshold — expenses under, say, 500,000 LAK approvable by a
`LEADER`, above it requiring the president — held in config rather than code.

### Weddings and funerals

Both are already `Event` rows (`EventType.WEDDING` / `FUNERAL`), and a funeral
usually also has a `MutualAidCase`. That gives a complete picture per occasion:

| Flow | Model | Direction |
| --- | --- | --- |
| Contributions collected | `AidContribution` → `Payment` | in |
| Event-tied giving | `Donation` → `Payment` | in |
| Catering, tents, honoraria | `Expense` | out |

Net position for an event = confirmed donations + confirmed aid − paid
expenses, compared against `budgetAmount`.

---

## 4. Shared assets

```prisma
enum AssetCategory {
  KITCHENWARE      // pots, dishes, utensils for feasts
  FURNITURE        // chairs, tables
  TENT
  SOUND_EQUIPMENT
  CEREMONIAL       // drums, qeej, ritual items
  VEHICLE
  LAND
  BUILDING
  OTHER
}

enum AssetCondition { NEW GOOD FAIR POOR DAMAGED }
enum AssetStatus    { AVAILABLE UNDER_REPAIR DISPOSED }

model Asset {
  id          String        @id @default(uuid())
  nameHmong   String
  nameLatin   String
  category    AssetCategory @default(OTHER)
  description String?

  /// Bulk-tracked: 200 chairs are ONE row with quantity 200.
  quantity Int    @default(1)
  unit     String @default("piece")

  condition AssetCondition @default(GOOD)
  status    AssetStatus    @default(AVAILABLE)

  acquiredAt      DateTime?
  acquisitionCost Decimal?  @db.Decimal(12, 2)
  currency        String    @default("LAK")

  location String?
  photoUrl String?
  serialNo String?
  notes    String?

  loans    AssetLoan[]
  expenses Expense[]   // repairs and maintenance

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([category])
  @@index([status])
}

enum AssetLoanStatus { REQUESTED APPROVED OUT RETURNED OVERDUE LOST }

model AssetLoan {
  id      String @id @default(uuid())
  assetId String
  asset   Asset  @relation(fields: [assetId], references: [id], onDelete: Cascade)

  // Borrowing household, and optionally the member who collects it.
  householdId String?
  household   Household? @relation(fields: [householdId], references: [id], onDelete: SetNull)
  memberId    String?
  member      Member?    @relation("MemberAssetLoans", fields: [memberId], references: [id], onDelete: SetNull)

  // Usually borrowed FOR an event.
  eventId String?
  event   Event?  @relation(fields: [eventId], references: [id], onDelete: SetNull)

  quantity         Int @default(1)
  quantityReturned Int @default(0)

  status AssetLoanStatus @default(REQUESTED)

  requestedAt  DateTime  @default(now())
  dueAt        DateTime?
  checkedOutAt DateTime?
  returnedAt   DateTime?

  conditionOnReturn AssetCondition?
  depositAmount     Decimal? @db.Decimal(12, 2)
  feeAmount         Decimal? @db.Decimal(12, 2)
  currency          String   @default("LAK")

  approvedById String?
  approvedBy   User?   @relation("AssetLoanApprovedBy", fields: [approvedById], references: [id], onDelete: SetNull)
  notes        String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([assetId, status])
  @@index([eventId])
}
```

### Availability

Never store a free count — derive it, or two concurrent approvals will
over-commit the same chairs:

```
available(asset) = asset.quantity
                 − Σ (quantity − quantityReturned)
                   over loans WHERE status IN (APPROVED, OUT, OVERDUE)
```

Compute inside the same transaction that approves a loan, and reject if the
result would go negative.

### Lifecycle

```
REQUESTED ──approve──► APPROVED ──check out──► OUT ──return──► RETURNED
                                                │
                                    past dueAt ─┴─► OVERDUE ──► LOST
```

- Partial returns are supported: `quantityReturned < quantity` keeps the loan
  open rather than closing it short.
- Damage on return sets `conditionOnReturn` and should raise a linked
  `Expense` with `category = MAINTENANCE` and `assetId` set, which is how
  repair costs accumulate against an asset.
- `LOST` leaves `Asset.quantity` untouched — write-off is a deliberate
  separate edit, so shrinkage is never silent.

Land and buildings live here too, with `quantity = 1`. Deeds and titles attach
via the existing `Document` model rather than new columns.

---

## 5. Permissions

Additions to `docs/RBAC.md`:

| Action | SUPER_ADMIN | LEADER | TREASURER | MEMBER |
| --- | --- | --- | --- | --- |
| Appoint / end office terms | ✅ | view | view | view |
| View officer roster & history | ✅ | ✅ | ✅ | ✅ |
| Raise an expense | ✅ | ✅ | ✅ | ❌ |
| Approve an expense | ✅ | threshold | ❌ | ❌ |
| Disburse (mark PAID) | ✅ | ❌ | ✅ | ❌ |
| View expense line items | ✅ | ✅ | ✅ | see below |
| Manage asset register | ✅ | ✅ | ❌ | ❌ |
| Request an asset loan | ✅ | ✅ | ✅ | ✅ |
| Approve / check out / receive | ✅ | ✅ | ❌ | ❌ |
| Record deposits & fees | ✅ | ❌ | ✅ | ❌ |

Approval authority is checked against a **current `OfficeTerm`**, not against
`User.role` — that is the point of keeping them separate.

**Member visibility** is a governance choice, not a technical one. Mutual aid
is already deliberately transparent ("who gave, and how much"). The consistent
choice is to let members see event-level expense **totals by category**, while
payee names and receipts stay with officers. Flagged as an open question.

---

## 6. What this makes reportable

- Event profit-and-loss: budget vs donations in vs expenses out.
- True funeral cost: aid raised against what the association actually spent.
- Asset register: acquisition value, condition, current location, who holds it.
- Cost-per-asset over its life, via `MAINTENANCE` expenses.
- Officer roster and full term history.
- Outstanding and overdue loans.

---

## 7. Build order

Migrations must follow the foreign keys:

1. **`OfficeTerm`** — independent, ships alone. Unblocks the approval rules.
2. **`Asset` + `AssetLoan`** — independent of expenses.
3. **`Expense`** + `Event.budgetAmount` — references `Asset`, so it comes last.

Back-relations to add to existing models: `Member` (`officeTerms`,
`assetLoans`), `User` (appointed / requested / approved / disbursed /
loan-approved), `Event` (`expenses`, `assetLoans`, `budgetAmount`),
`MutualAidCase` (`expenses`), `Household` (`assetLoans`).

---

## 8. Open questions

1. **Is there a fund balance?** Inflows and outflows will both exist, but
   nothing answers *"how much money does the association hold right now?"*
   Deriving it as confirmed inflows − paid outflows works only if every
   movement is recorded. An opening balance and a cash/bank split would need
   a small `FundAccount` model. **This is the largest remaining gap.**
2. **Are deposits refundable money?** If a loan deposit is really held and
   returned, it is an inflow then an outflow, not a number on the loan.
   Modelled here as a plain column — fine if deposits are notional, wrong if
   cash actually changes hands.
3. **How much expense detail do ordinary members see?**
4. **One vice-president or several?** Decides whether `seat` is needed.
5. **Do overseas members pay in another currency?** Every model carries a
   `currency` column, but nothing converts between them; mixed-currency totals
   would be meaningless without a rate table.
