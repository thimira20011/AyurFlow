package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"ayurflow/backend/internal/inventory"

	"github.com/gin-gonic/gin"
)

type mockInventoryService struct {
	createItemFunc     func(ctx context.Context, actorID string, req inventory.CreateItemRequest) (inventory.BotanicalItem, error)
	deactivateItemFunc func(ctx context.Context, actorID, itemID string, req inventory.DeactivateItemRequest) (inventory.BotanicalItem, error)
	listItemsFunc      func(ctx context.Context, actorID string, activeOnly bool, limit int, cursor string) (inventory.BotanicalItemPage, error)
	receiveBatchFunc   func(ctx context.Context, actorID string, req inventory.ReceiveBatchRequest) (inventory.StockBatch, error)
	blockBatchFunc     func(ctx context.Context, actorID, batchID string, req inventory.BlockBatchRequest) (inventory.StockBatch, error)
	listBatchesFunc    func(ctx context.Context, actorID string, filter inventory.ListBatchesFilter) (inventory.StockBatchPage, error)
}

func (m *mockInventoryService) CreateItem(ctx context.Context, actorID string, req inventory.CreateItemRequest) (inventory.BotanicalItem, error) {
	if m.createItemFunc != nil {
		return m.createItemFunc(ctx, actorID, req)
	}
	return inventory.BotanicalItem{}, nil
}

func (m *mockInventoryService) DeactivateItem(ctx context.Context, actorID, itemID string, req inventory.DeactivateItemRequest) (inventory.BotanicalItem, error) {
	if m.deactivateItemFunc != nil {
		return m.deactivateItemFunc(ctx, actorID, itemID, req)
	}
	return inventory.BotanicalItem{}, nil
}

func (m *mockInventoryService) ListItems(ctx context.Context, actorID string, activeOnly bool, limit int, cursor string) (inventory.BotanicalItemPage, error) {
	if m.listItemsFunc != nil {
		return m.listItemsFunc(ctx, actorID, activeOnly, limit, cursor)
	}
	return inventory.BotanicalItemPage{}, nil
}

func (m *mockInventoryService) ReceiveBatch(ctx context.Context, actorID string, req inventory.ReceiveBatchRequest) (inventory.StockBatch, error) {
	if m.receiveBatchFunc != nil {
		return m.receiveBatchFunc(ctx, actorID, req)
	}
	return inventory.StockBatch{}, nil
}

func (m *mockInventoryService) BlockBatch(ctx context.Context, actorID, batchID string, req inventory.BlockBatchRequest) (inventory.StockBatch, error) {
	if m.blockBatchFunc != nil {
		return m.blockBatchFunc(ctx, actorID, batchID, req)
	}
	return inventory.StockBatch{}, nil
}

func (m *mockInventoryService) ListBatches(ctx context.Context, actorID string, filter inventory.ListBatchesFilter) (inventory.StockBatchPage, error) {
	if m.listBatchesFunc != nil {
		return m.listBatchesFunc(ctx, actorID, filter)
	}
	return inventory.StockBatchPage{}, nil
}

func newInventoryTestRouter(svc InventoryService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	return NewRouter(nil, AuthRoutes{
		Service:       mockSessionAuth{},
		AllowedOrigin: "https://clinic.example",
		Inventory:     svc,
	})
}

func TestInventoryHTTPRoutes(t *testing.T) {
	exp := "2027-06-30"
	reason := "Packaging seal damaged during transit"
	mockSvc := &mockInventoryService{
		createItemFunc: func(ctx context.Context, actorID string, req inventory.CreateItemRequest) (inventory.BotanicalItem, error) {
			if req.Code == "CONFLICT" {
				return inventory.BotanicalItem{}, inventory.ErrConflict
			}
			return inventory.BotanicalItem{
				ID:          "10938471-2938-4819-9182-736451928374",
				Code:        req.Code,
				DisplayName: req.DisplayName,
				BaseUnit:    "g",
				Active:      true,
				CreatedBy:   actorID,
				CreatedAt:   time.Date(2026, 10, 31, 8, 30, 0, 0, time.UTC),
				UpdatedAt:   time.Date(2026, 10, 31, 8, 30, 0, 0, time.UTC),
			}, nil
		},
		receiveBatchFunc: func(ctx context.Context, actorID string, req inventory.ReceiveBatchRequest) (inventory.StockBatch, error) {
			if req.ReceivedGrams == "0.000" {
				return inventory.StockBatch{}, inventory.ErrValidation
			}
			return inventory.StockBatch{
				ID:              "b1111111-2222-4333-8444-555555555555",
				ItemID:          req.ItemID,
				ItemCode:        "BOT-ASHWA-001",
				ItemDisplayName: "Ashwagandha Root",
				BatchReference:  req.BatchReference,
				ReceivedGrams:   req.ReceivedGrams,
				RemainingGrams:  req.ReceivedGrams,
				ExpiresAt:       &exp,
				Blocked:         false,
				Eligibility:     inventory.EligibilityEligible,
				ReceivedBy:      actorID,
				ReceivedAt:      time.Date(2026, 10, 31, 8, 35, 0, 0, time.UTC),
			}, nil
		},
		blockBatchFunc: func(ctx context.Context, actorID, batchID string, req inventory.BlockBatchRequest) (inventory.StockBatch, error) {
			if req.Reason == "" {
				return inventory.StockBatch{}, inventory.ErrValidation
			}
			return inventory.StockBatch{
				ID:             batchID,
				ItemID:         "10938471-2938-4819-9182-736451928374",
				ItemCode:       "BOT-ASHWA-001",
				BatchReference: "CLN-BATCH-2026-A02",
				ReceivedGrams:  "500.000",
				RemainingGrams: "500.000",
				Blocked:        true,
				BlockReason:    &reason,
				Eligibility:    inventory.EligibilityBlocked,
			}, nil
		},
		listBatchesFunc: func(ctx context.Context, actorID string, filter inventory.ListBatchesFilter) (inventory.StockBatchPage, error) {
			return inventory.StockBatchPage{
				Items: []inventory.StockBatch{
					{
						ID:             "b1111111-2222-4333-8444-555555555555",
						BatchReference: "CLN-BATCH-2026-A01",
						ReceivedGrams:  "1000.000",
						RemainingGrams: "1000.000",
						Eligibility:    inventory.EligibilityEligible,
					},
				},
				Summary: inventory.BatchSummaryTotals{
					EligibleGrams:      "1000.000",
					BlockedGrams:       "500.000",
					ExpiredGrams:       "250.000",
					UnknownExpiryGrams: "200.000",
				},
				ClinicDate: "2026-10-31",
			}, nil
		},
	}

	router := newInventoryTestRouter(mockSvc)

	t.Run("POST /api/v1/inventory/items requires CSRF and returns 201 Created", func(t *testing.T) {
		body, _ := json.Marshal(map[string]any{
			"code":        "BOT-ASHWA-001",
			"displayName": "Ashwagandha Root",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/items", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://clinic.example")
		req.Header.Set("X-CSRF-Token", "valid-csrf-token")
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("status = %d, want 201 (%s)", rec.Code, rec.Body.String())
		}
	})

	t.Run("POST /api/v1/inventory/items without CSRF returns 403 Forbidden", func(t *testing.T) {
		body, _ := json.Marshal(map[string]any{
			"code":        "BOT-ASHWA-001",
			"displayName": "Ashwagandha Root",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/items", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://clinic.example")
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", rec.Code)
		}
	})

	t.Run("POST /api/v1/inventory/batches returns 201 Created and 422 on invalid grams", func(t *testing.T) {
		body, _ := json.Marshal(map[string]any{
			"itemId":         "10938471-2938-4819-9182-736451928374",
			"batchReference": "CLN-BATCH-2026-A01",
			"receivedGrams":  "1000.000",
			"expiresAt":      "2027-06-30",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/batches", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://clinic.example")
		req.Header.Set("X-CSRF-Token", "valid-csrf-token")
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("status = %d, want 201 (%s)", rec.Code, rec.Body.String())
		}

		invalidBody, _ := json.Marshal(map[string]any{
			"itemId":         "10938471-2938-4819-9182-736451928374",
			"batchReference": "CLN-BATCH-2026-A01",
			"receivedGrams":  "0.000",
		})
		invalidReq := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/batches", bytes.NewReader(invalidBody))
		invalidReq.Header.Set("Content-Type", "application/json")
		invalidReq.Header.Set("Origin", "https://clinic.example")
		invalidReq.Header.Set("X-CSRF-Token", "valid-csrf-token")
		invalidReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})

		invalidRec := httptest.NewRecorder()
		router.ServeHTTP(invalidRec, invalidReq)
		if invalidRec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422 (%s)", invalidRec.Code, invalidRec.Body.String())
		}
	})

	t.Run("POST /api/v1/inventory/batches/:batchId/block returns 200 OK", func(t *testing.T) {
		body, _ := json.Marshal(map[string]any{
			"reason": "Packaging seal damaged during transit",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/batches/b1111111-2222-4333-8444-555555555555/block", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://clinic.example")
		req.Header.Set("X-CSRF-Token", "valid-csrf-token")
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", rec.Code, rec.Body.String())
		}
	})

	t.Run("GET /api/v1/inventory/batches returns 200 OK with summary", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/inventory/batches?eligibleOnly=true", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", rec.Code, rec.Body.String())
		}
	})
}
