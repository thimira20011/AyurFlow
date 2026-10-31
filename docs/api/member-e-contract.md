# Member E billing and invoicing API contract — TASK-SET-06 review draft

**Owner:** Member E. **Reviewer:** Member D. **Coordinator:** Member A.
**SRS:** BIL-01–06. **Acceptance target:** AT12.
**Status:** Implemented in `member-e/task-bill-02-invoice-lifecycle`. Proposed for Member D review.

---

## 1. Architectural Rules & Invariants

1. **Integer LKR Minor Units**:
   - All financial amounts (`unitPriceMinor`, `lineTotalMinor`, `totalMinor`, `amountMinor`, `paidMinor`, `outstandingMinor`) are 64-bit signed integers representing cents/cents-equivalent minor units (e.g. Rs. 1 500.00 = `150000`).
   - Floating-point arithmetic is strictly prohibited in billing code.
2. **Atomic Issuance & Immutability**:
   - Invoices start in `draft` status.
   - Line items can only be added to or removed from `draft` invoices.
   - Issuing an invoice (`POST /invoices/:id/issue`) locks the row, sums the lines, assigns `total_minor_units`, records `issued_by` and `issued_at`, sets status to `issued`, and writes an audit event in a single PostgreSQL transaction.
   - Once issued, line items and totals are strictly immutable. Any attempt to modify lines or void an issued invoice is rejected with HTTP 409 Conflict.
3. **Session & Role Authorization**:
   - Every protected billing endpoint is protected by `RequireSession` middleware (`__Host-ayurflow_session` cookie + `X-CSRF-Token` on state-changing requests).
   - In the database transaction, `checkRole` verifies that the actor account is active and holds the required role (`billing`, `receptionist`, or `report_reader`).
   - Administrator role alone does not grant billing permissions.
4. **Transactional Audit Logging**:
   - Every state change (`invoice.created`, `invoice.item_added`, `invoice.item_removed`, `invoice.issued`, `invoice.voided`, `receipt.posted`) writes to `audit_events` in the same database transaction.
   - If the audit write fails, the entire transaction rolls back.

---

## 2. API Endpoints

### 2.1 Invoices & Line Items (TASK-BILL-02)

#### `POST /api/v1/invoices`
Opens a new draft invoice for a registered patient.
- **Access:** `billing`, `receptionist`
- **Request Body:**
  ```json
  {
    "patientId": "30ad6d29-79b0-4028-93c4-614df48ec3ea"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "id": "e98e8210-9285-4428-b210-8591823901bc",
    "patientId": "30ad6d29-79b0-4028-93c4-614df48ec3ea",
    "status": "draft",
    "createdAt": "2026-10-26T16:45:00Z",
    "updatedAt": "2026-10-26T16:45:00Z"
  }
  ```

#### `GET /api/v1/invoices?patientId={uuid}&limit=25&after={uuid}`
Lists invoices for a specific patient, ordered by `createdAt DESC, id DESC`.
- **Access:** `billing`, `receptionist`
- **Response (`200 OK`):**
  ```json
  {
    "items": [
      {
        "id": "e98e8210-9285-4428-b210-8591823901bc",
        "patientId": "30ad6d29-79b0-4028-93c4-614df48ec3ea",
        "status": "issued",
        "totalMinor": 550000,
        "issuedAt": "2026-10-26T16:50:00Z",
        "issuedBy": "d02c1c97-7588-4455-a045-127158e311f6",
        "createdAt": "2026-10-26T16:45:00Z",
        "updatedAt": "2026-10-26T16:50:00Z"
      }
    ],
    "nextCursor": null
  }
  ```

#### `GET /api/v1/invoices/{id}`
Fetches an invoice along with all its item lines.
- **Access:** `billing`, `receptionist`
- **Response (`200 OK`):**
  ```json
  {
    "id": "e98e8210-9285-4428-b210-8591823901bc",
    "patientId": "30ad6d29-79b0-4028-93c4-614df48ec3ea",
    "status": "draft",
    "createdAt": "2026-10-26T16:45:00Z",
    "updatedAt": "2026-10-26T16:45:00Z",
    "items": [
      {
        "id": "893bc421-1200-4781-8192-381920381920",
        "invoiceId": "e98e8210-9285-4428-b210-8591823901bc",
        "description": "Ayurvedic Consultation",
        "quantity": 1,
        "unitPriceMinor": 250000,
        "lineTotalMinor": 250000,
        "createdAt": "2026-10-26T16:46:00Z"
      }
    ]
  }
  ```

#### `POST /api/v1/invoices/{id}/items`
Adds a line item to a draft invoice. Computed `lineTotalMinor = quantity * unitPriceMinor`.
- **Access:** `billing`
- **Request Body:**
  ```json
  {
    "description": "Shirodhara Oil 500g",
    "quantity": 2,
    "unitPriceMinor": 150000
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "id": "719ab210-3847-4921-9182-192837465019",
    "invoiceId": "e98e8210-9285-4428-b210-8591823901bc",
    "description": "Shirodhara Oil 500g",
    "quantity": 2,
    "unitPriceMinor": 150000,
    "lineTotalMinor": 300000,
    "createdAt": "2026-10-26T16:47:00Z"
  }
  ```

#### `DELETE /api/v1/invoices/{id}/items/{itemId}`
Removes an item from a draft invoice.
- **Access:** `billing`
- **Response (`204 No Content`)**

#### `POST /api/v1/invoices/{id}/issue`
Atomically issues a draft invoice and freezes its lines.
- **Access:** `billing`
- **Request Body:** `{}`
- **Response (`200 OK`):** Returns the issued invoice with `status: "issued"`, non-nil `totalMinor`, `issuedBy`, and `issuedAt`.

#### `POST /api/v1/invoices/{id}/void`
Voids a draft invoice (only permitted if no receipts have been posted).
- **Access:** `billing`
- **Response (`204 No Content`)**

---

### 2.2 Receipts & Balances (TASK-BILL-03 & TASK-BILL-04)

#### `POST /api/v1/invoices/{id}/receipts`
Posts a payment receipt against an issued invoice with retry safety.
- **Access:** `billing`
- **Request Body:**
  ```json
  {
    "operationId": "c990f6c9-d871-45ca-a4fc-16b25e09d4a7",
    "amountMinor": 300000,
    "paymentMethod": "cash",
    "label": "Front desk payment"
  }
  ```
- **Response (`201 Created` or `200 OK` on identical retry):**
  ```json
  {
    "id": "18293740-4829-4102-9812-384910293847",
    "invoiceId": "e98e8210-9285-4428-b210-8591823901bc",
    "operationId": "c990f6c9-d871-45ca-a4fc-16b25e09d4a7",
    "amountMinor": 300000,
    "paymentMethod": "cash",
    "label": "Front desk payment",
    "issuedAt": "2026-10-26T16:52:00Z",
    "issuedBy": "d02c1c97-7588-4455-a045-127158e311f6"
  }
  ```

#### `GET /api/v1/invoices/{id}/balance`
Returns the derived balance for an issued invoice (`total - sum(receipts)`).
- **Access:** `billing`, `receptionist`
- **Response (`200 OK`):**
  ```json
  {
    "invoiceId": "e98e8210-9285-4428-b210-8591823901bc",
    "totalMinor": 550000,
    "paidMinor": 300000,
    "outstandingMinor": 250000
  }
  ```

---

### 2.3 Reports (TASK-BILL-06)

#### `GET /api/v1/reports/billing/outstanding`
Returns all issued invoices that still have an unpaid balance, ordered by oldest `issuedAt` first.
- **Access:** `billing`, `report_reader`
- **Response (`200 OK`):**
  ```json
  {
    "generatedAt": "2026-10-26T16:55:00Z",
    "rows": [
      {
        "invoiceId": "e98e8210-9285-4428-b210-8591823901bc",
        "patientId": "30ad6d29-79b0-4028-93c4-614df48ec3ea",
        "issuedAt": "2026-10-26T16:50:00Z",
        "totalMinor": 550000,
        "paidMinor": 300000,
        "outstandingMinor": 250000,
        "ageDays": 0
      }
    ]
  }
  ```
