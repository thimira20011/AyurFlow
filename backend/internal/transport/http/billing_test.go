package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"ayurflow/backend/internal/auth"
	"ayurflow/backend/internal/billing"

	"github.com/gin-gonic/gin"
)

type mockBillingService struct {
	createInvoiceFunc          func(ctx context.Context, actorID string, req billing.CreateInvoiceRequest) (billing.Invoice, error)
	getInvoiceFunc             func(ctx context.Context, actorID, invoiceID string) (billing.Invoice, error)
	listInvoicesForPatientFunc func(ctx context.Context, actorID, patientID string, limit int, afterID string) (billing.InvoicePage, error)
	addItemFunc                func(ctx context.Context, actorID, invoiceID string, req billing.AddItemRequest) (billing.InvoiceItem, error)
	removeItemFunc             func(ctx context.Context, actorID, invoiceID, itemID string) error
	issueInvoiceFunc           func(ctx context.Context, actorID, invoiceID string) (billing.Invoice, error)
	voidInvoiceFunc            func(ctx context.Context, actorID, invoiceID string) error
	postReceiptFunc            func(ctx context.Context, actorID, invoiceID string, req billing.PostReceiptRequest) (billing.Receipt, error)
	getBalanceFunc             func(ctx context.Context, actorID, invoiceID string) (billing.InvoiceBalance, error)
	listReceiptsFunc           func(ctx context.Context, actorID, invoiceID string) ([]billing.Receipt, error)
	outstandingReportFunc      func(ctx context.Context, actorID string) (billing.OutstandingReport, error)
}

func (m *mockBillingService) CreateInvoice(ctx context.Context, actorID string, req billing.CreateInvoiceRequest) (billing.Invoice, error) {
	if m.createInvoiceFunc != nil {
		return m.createInvoiceFunc(ctx, actorID, req)
	}
	return billing.Invoice{}, nil
}

func (m *mockBillingService) GetInvoice(ctx context.Context, actorID, invoiceID string) (billing.Invoice, error) {
	if m.getInvoiceFunc != nil {
		return m.getInvoiceFunc(ctx, actorID, invoiceID)
	}
	return billing.Invoice{}, nil
}

func (m *mockBillingService) ListInvoicesForPatient(ctx context.Context, actorID, patientID string, limit int, afterID string) (billing.InvoicePage, error) {
	if m.listInvoicesForPatientFunc != nil {
		return m.listInvoicesForPatientFunc(ctx, actorID, patientID, limit, afterID)
	}
	return billing.InvoicePage{}, nil
}

func (m *mockBillingService) AddItem(ctx context.Context, actorID, invoiceID string, req billing.AddItemRequest) (billing.InvoiceItem, error) {
	if m.addItemFunc != nil {
		return m.addItemFunc(ctx, actorID, invoiceID, req)
	}
	return billing.InvoiceItem{}, nil
}

func (m *mockBillingService) RemoveItem(ctx context.Context, actorID, invoiceID, itemID string) error {
	if m.removeItemFunc != nil {
		return m.removeItemFunc(ctx, actorID, invoiceID, itemID)
	}
	return nil
}

func (m *mockBillingService) IssueInvoice(ctx context.Context, actorID, invoiceID string) (billing.Invoice, error) {
	if m.issueInvoiceFunc != nil {
		return m.issueInvoiceFunc(ctx, actorID, invoiceID)
	}
	return billing.Invoice{}, nil
}

func (m *mockBillingService) VoidInvoice(ctx context.Context, actorID, invoiceID string) error {
	if m.voidInvoiceFunc != nil {
		return m.voidInvoiceFunc(ctx, actorID, invoiceID)
	}
	return nil
}

func (m *mockBillingService) PostReceipt(ctx context.Context, actorID, invoiceID string, req billing.PostReceiptRequest) (billing.Receipt, error) {
	if m.postReceiptFunc != nil {
		return m.postReceiptFunc(ctx, actorID, invoiceID, req)
	}
	return billing.Receipt{}, nil
}

func (m *mockBillingService) GetBalance(ctx context.Context, actorID, invoiceID string) (billing.InvoiceBalance, error) {
	if m.getBalanceFunc != nil {
		return m.getBalanceFunc(ctx, actorID, invoiceID)
	}
	return billing.InvoiceBalance{}, nil
}

func (m *mockBillingService) ListReceipts(ctx context.Context, actorID, invoiceID string) ([]billing.Receipt, error) {
	if m.listReceiptsFunc != nil {
		return m.listReceiptsFunc(ctx, actorID, invoiceID)
	}
	return nil, nil
}

func (m *mockBillingService) OutstandingReport(ctx context.Context, actorID string) (billing.OutstandingReport, error) {
	if m.outstandingReportFunc != nil {
		return m.outstandingReportFunc(ctx, actorID)
	}
	return billing.OutstandingReport{}, nil
}

type mockSessionAuth struct{}

func (mockSessionAuth) Authenticate(context.Context, string) (auth.Session, error) {
	return auth.Session{StaffID: "d02c1c97-7588-4455-a045-127158e311f6"}, nil
}

func (mockSessionAuth) AuthenticateCSRF(ctx context.Context, token, csrf string) (auth.Session, error) {
	if csrf != "valid-csrf-token" {
		return auth.Session{}, auth.ErrCSRF
	}
	return auth.Session{StaffID: "d02c1c97-7588-4455-a045-127158e311f6"}, nil
}

func (s mockSessionAuth) Login(context.Context, string, string, string) (auth.Session, string, error) {
	return auth.Session{}, "", nil
}

func (s mockSessionAuth) Validate(ctx context.Context, token string) (auth.Session, error) {
	return s.Authenticate(ctx, token)
}

func (s mockSessionAuth) Logout(context.Context, string, string) error {
	return nil
}

func setupBillingTestRouter(service BillingService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	return NewRouter(unavailableDB{}, AuthRoutes{
		Service:       mockSessionAuth{},
		AllowedOrigin: "https://clinic.example",
		Billing:       service,
	})
}

func TestBillingRoutesRequireAuthentication(t *testing.T) {
	router := setupBillingTestRouter(&mockBillingService{})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/invoices", bytes.NewBufferString(`{"patientId":"30ad6d29-79b0-4028-93c4-614df48ec3ea"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://clinic.example")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized without session cookie, got %d", w.Code)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/invoices/inv-uuid-1", nil)
	getW := httptest.NewRecorder()
	router.ServeHTTP(getW, getReq)
	if getW.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized on GET without session cookie, got %d", getW.Code)
	}
}

func TestBillingRoutesRequireCSRF(t *testing.T) {
	router := setupBillingTestRouter(&mockBillingService{})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/invoices", bytes.NewBufferString(`{"patientId":"30ad6d29-79b0-4028-93c4-614df48ec3ea"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://clinic.example")
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden without CSRF header, got %d", w.Code)
	}
}

func TestCreateInvoiceRoute(t *testing.T) {
	mockSvc := &mockBillingService{
		createInvoiceFunc: func(ctx context.Context, actorID string, req billing.CreateInvoiceRequest) (billing.Invoice, error) {
			if actorID != "d02c1c97-7588-4455-a045-127158e311f6" {
				t.Fatalf("unexpected actor ID: %s", actorID)
			}
			return billing.Invoice{
				ID:        "inv-uuid-1",
				PatientID: req.PatientID,
				Status:    billing.StatusDraft,
				CreatedAt: time.Now().UTC(),
				UpdatedAt: time.Now().UTC(),
			}, nil
		},
	}
	router := setupBillingTestRouter(mockSvc)
	body, _ := json.Marshal(billing.CreateInvoiceRequest{PatientID: "30ad6d29-79b0-4028-93c4-614df48ec3ea"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/invoices", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://clinic.example")
	req.Header.Set("X-CSRF-Token", "valid-csrf-token")
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}
	var res billing.Invoice
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.ID != "inv-uuid-1" || res.Status != billing.StatusDraft {
		t.Fatalf("unexpected response: %+v", res)
	}
}

func TestAddItemRoute(t *testing.T) {
	mockSvc := &mockBillingService{
		addItemFunc: func(ctx context.Context, actorID, invoiceID string, req billing.AddItemRequest) (billing.InvoiceItem, error) {
			return billing.InvoiceItem{
				ID:             "item-1",
				InvoiceID:      invoiceID,
				Description:    req.Description,
				Quantity:       req.Quantity,
				UnitPriceMinor: req.UnitPriceMinor,
				LineTotalMinor: int64(req.Quantity) * req.UnitPriceMinor,
			}, nil
		},
	}
	router := setupBillingTestRouter(mockSvc)
	body, _ := json.Marshal(billing.AddItemRequest{
		Description:    "Kashaya Herbal Decoction",
		Quantity:       2,
		UnitPriceMinor: 150000,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/invoices/inv-uuid-1/items", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://clinic.example")
	req.Header.Set("X-CSRF-Token", "valid-csrf-token")
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}
	var item billing.InvoiceItem
	if err := json.Unmarshal(w.Body.Bytes(), &item); err != nil {
		t.Fatal(err)
	}
	if item.LineTotalMinor != 300000 {
		t.Fatalf("expected line total 300000, got %d", item.LineTotalMinor)
	}
}

func TestIssueInvoiceRoute(t *testing.T) {
	total := int64(300000)
	actor := "d02c1c97-7588-4455-a045-127158e311f6"
	now := time.Now().UTC()
	mockSvc := &mockBillingService{
		issueInvoiceFunc: func(ctx context.Context, actorID, invoiceID string) (billing.Invoice, error) {
			return billing.Invoice{
				ID:         invoiceID,
				PatientID:  "patient-1",
				Status:     billing.StatusIssued,
				TotalMinor: &total,
				IssuedBy:   &actor,
				IssuedAt:   &now,
			}, nil
		},
	}
	router := setupBillingTestRouter(mockSvc)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/invoices/inv-uuid-1/issue", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://clinic.example")
	req.Header.Set("X-CSRF-Token", "valid-csrf-token")
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}
	var issued billing.Invoice
	if err := json.Unmarshal(w.Body.Bytes(), &issued); err != nil {
		t.Fatal(err)
	}
	if issued.Status != billing.StatusIssued || *issued.TotalMinor != 300000 {
		t.Fatalf("unexpected issued invoice: %+v", issued)
	}
}

func TestIssueInvoiceConflict(t *testing.T) {
	mockSvc := &mockBillingService{
		issueInvoiceFunc: func(ctx context.Context, actorID, invoiceID string) (billing.Invoice, error) {
			return billing.Invoice{}, errors.Join(billing.ErrConflict, errors.New("invoice is already issued"))
		},
	}
	router := setupBillingTestRouter(mockSvc)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/invoices/inv-uuid-1/issue", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://clinic.example")
	req.Header.Set("X-CSRF-Token", "valid-csrf-token")
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRemoveItemRoute(t *testing.T) {
	mockSvc := &mockBillingService{
		removeItemFunc: func(ctx context.Context, actorID, invoiceID, itemID string) error {
			return nil
		},
	}
	router := setupBillingTestRouter(mockSvc)
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/invoices/inv-uuid-1/items/item-1", nil)
	req.Header.Set("Origin", "https://clinic.example")
	req.Header.Set("X-CSRF-Token", "valid-csrf-token")
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204 No Content, got %d", w.Code)
	}
}

func TestVoidInvoiceRoute(t *testing.T) {
	mockSvc := &mockBillingService{
		voidInvoiceFunc: func(ctx context.Context, actorID, invoiceID string) error {
			return nil
		},
	}
	router := setupBillingTestRouter(mockSvc)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/invoices/inv-uuid-1/void", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://clinic.example")
	req.Header.Set("X-CSRF-Token", "valid-csrf-token")
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204 No Content, got %d", w.Code)
	}
}

func TestBillingForbiddenRoute(t *testing.T) {
	mockSvc := &mockBillingService{
		createInvoiceFunc: func(ctx context.Context, actorID string, req billing.CreateInvoiceRequest) (billing.Invoice, error) {
			return billing.Invoice{}, billing.ErrForbidden
		},
	}
	router := setupBillingTestRouter(mockSvc)
	body, _ := json.Marshal(billing.CreateInvoiceRequest{PatientID: "30ad6d29-79b0-4028-93c4-614df48ec3ea"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/invoices", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://clinic.example")
	req.Header.Set("X-CSRF-Token", "valid-csrf-token")
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPostReceiptRoute(t *testing.T) {
	now := time.Now().UTC()
	mockSvc := &mockBillingService{
		postReceiptFunc: func(ctx context.Context, actorID, invoiceID string, req billing.PostReceiptRequest) (billing.Receipt, error) {
			return billing.Receipt{
				ID:            "rec-uuid-1",
				InvoiceID:     invoiceID,
				OperationID:   req.OperationID,
				AmountMinor:   req.AmountMinor,
				PaymentMethod: req.PaymentMethod,
				Label:         req.Label,
				IssuedAt:      now,
				IssuedBy:      actorID,
			}, nil
		},
	}
	router := setupBillingTestRouter(mockSvc)
	body, _ := json.Marshal(billing.PostReceiptRequest{
		OperationID:   "3fa85f64-5717-4562-b3fc-2c963f66afa6",
		AmountMinor:   250000,
		PaymentMethod: "direct_deposit",
		Label:         "Advance deposit slip #BOC-109",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/invoices/inv-uuid-1/receipts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://clinic.example")
	req.Header.Set("X-CSRF-Token", "valid-csrf-token")
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}
	var rec billing.Receipt
	if err := json.Unmarshal(w.Body.Bytes(), &rec); err != nil {
		t.Fatal(err)
	}
	if rec.ID != "rec-uuid-1" || rec.AmountMinor != 250000 || rec.PaymentMethod != "direct_deposit" || rec.Label != "Advance deposit slip #BOC-109" {
		t.Fatalf("unexpected receipt response: %+v", rec)
	}
}

func TestPostReceiptConflict(t *testing.T) {
	mockSvc := &mockBillingService{
		postReceiptFunc: func(ctx context.Context, actorID, invoiceID string, req billing.PostReceiptRequest) (billing.Receipt, error) {
			return billing.Receipt{}, errors.Join(billing.ErrConflict, errors.New("overpayment exceeds outstanding balance"))
		},
	}
	router := setupBillingTestRouter(mockSvc)
	body, _ := json.Marshal(billing.PostReceiptRequest{
		OperationID:   "3fa85f64-5717-4562-b3fc-2c963f66afa6",
		AmountMinor:   99999999,
		PaymentMethod: "cash",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/invoices/inv-uuid-1/receipts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://clinic.example")
	req.Header.Set("X-CSRF-Token", "valid-csrf-token")
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetBalanceRoute(t *testing.T) {
	mockSvc := &mockBillingService{
		getBalanceFunc: func(ctx context.Context, actorID, invoiceID string) (billing.InvoiceBalance, error) {
			return billing.InvoiceBalance{
				InvoiceID:        invoiceID,
				TotalMinor:       500000,
				PaidMinor:        200000,
				OutstandingMinor: 300000,
			}, nil
		},
	}
	router := setupBillingTestRouter(mockSvc)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/invoices/inv-uuid-1/balance", nil)
	req.Header.Set("Origin", "https://clinic.example")
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}
	var bal billing.InvoiceBalance
	if err := json.Unmarshal(w.Body.Bytes(), &bal); err != nil {
		t.Fatal(err)
	}
	if bal.TotalMinor != 500000 || bal.PaidMinor != 200000 || bal.OutstandingMinor != 300000 {
		t.Fatalf("unexpected balance: %+v", bal)
	}
}

func TestListReceiptsRoute(t *testing.T) {
	now := time.Now().UTC()
	mockSvc := &mockBillingService{
		listReceiptsFunc: func(ctx context.Context, actorID, invoiceID string) ([]billing.Receipt, error) {
			return []billing.Receipt{
				{
					ID:            "rec-1",
					InvoiceID:     invoiceID,
					OperationID:   "3fa85f64-5717-4562-b3fc-2c963f66afa6",
					AmountMinor:   200000,
					PaymentMethod: "direct_deposit",
					Label:         "Deposit 1",
					IssuedAt:      now,
					IssuedBy:      actorID,
				},
				{
					ID:            "rec-2",
					InvoiceID:     invoiceID,
					OperationID:   "7cb11f20-9182-4102-8172-1b918274a100",
					AmountMinor:   300000,
					PaymentMethod: "cash",
					Label:         "Counter settlement",
					IssuedAt:      now.Add(time.Hour),
					IssuedBy:      actorID,
				},
			}, nil
		},
	}
	router := setupBillingTestRouter(mockSvc)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/invoices/inv-uuid-1/receipts", nil)
	req.Header.Set("Origin", "https://clinic.example")
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Items []billing.Receipt `json:"items"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Items) != 2 || resp.Items[0].AmountMinor != 200000 || resp.Items[1].AmountMinor != 300000 {
		t.Fatalf("unexpected items: %+v", resp.Items)
	}
}
