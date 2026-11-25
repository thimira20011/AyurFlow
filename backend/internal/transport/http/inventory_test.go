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

type mockPreparationService struct {
	createRecipeFunc func(ctx context.Context, actor string, req inventory.RecipeRequest) (inventory.Recipe, error)
	updateRecipeFunc func(ctx context.Context, actor, id string, req inventory.RecipeRequest) (inventory.Recipe, error)
	listRecipesFunc  func(ctx context.Context, actor string) ([]inventory.Recipe, error)
	getRecipeFunc    func(ctx context.Context, actor, id string) (inventory.Recipe, error)
}

func (m *mockPreparationService) CreateRecipe(ctx context.Context, actor string, req inventory.RecipeRequest) (inventory.Recipe, error) {
	if m.createRecipeFunc != nil {
		return m.createRecipeFunc(ctx, actor, req)
	}
	return inventory.Recipe{}, nil
}

func (m *mockPreparationService) UpdateRecipe(ctx context.Context, actor, id string, req inventory.RecipeRequest) (inventory.Recipe, error) {
	if m.updateRecipeFunc != nil {
		return m.updateRecipeFunc(ctx, actor, id, req)
	}
	return inventory.Recipe{}, nil
}

func (m *mockPreparationService) ListRecipes(ctx context.Context, actor string) ([]inventory.Recipe, error) {
	if m.listRecipesFunc != nil {
		return m.listRecipesFunc(ctx, actor)
	}
	return []inventory.Recipe{}, nil
}

func (m *mockPreparationService) GetRecipe(ctx context.Context, actor, id string) (inventory.Recipe, error) {
	if m.getRecipeFunc != nil {
		return m.getRecipeFunc(ctx, actor, id)
	}
	return inventory.Recipe{}, nil
}

func (m *mockPreparationService) SavePreparation(context.Context, string, inventory.SavePreparationRequest) (inventory.Preparation, error) {
	return inventory.Preparation{}, nil
}

func (m *mockPreparationService) ListPreparations(context.Context, string, string) ([]inventory.Preparation, error) {
	return []inventory.Preparation{}, nil
}

func (m *mockPreparationService) GetPreparation(context.Context, string, string) (inventory.Preparation, error) {
	return inventory.Preparation{}, nil
}

func (m *mockPreparationService) ConfirmConsumption(context.Context, string, string, inventory.ConfirmConsumptionRequest) (inventory.Preparation, bool, error) {
	return inventory.Preparation{}, false, nil
}

func (m *mockPreparationService) TraceBatch(context.Context, string, string) ([]inventory.TraceRow, error) {
	return []inventory.TraceRow{}, nil
}

func (m *mockPreparationService) TracePatient(context.Context, string, string) ([]inventory.TraceRow, error) {
	return []inventory.TraceRow{}, nil
}

func TestRecipeHTTPRoutes(t *testing.T) {
	recipeID := "55123910-1293-4819-9182-192837465099"
	itemA := "10938471-2938-4819-9182-736451928374"
	itemB := "20938471-2938-4819-9182-736451928375"

	mockSvc := &mockPreparationService{
		createRecipeFunc: func(ctx context.Context, actor string, req inventory.RecipeRequest) (inventory.Recipe, error) {
			if len(req.Ingredients) == 0 {
				return inventory.Recipe{}, inventory.ErrValidation
			}
			if req.Code == "REC-INACTIVE" {
				return inventory.Recipe{}, inventory.ErrConflict
			}
			return inventory.Recipe{
				ID:             recipeID,
				Code:           req.Code,
				DisplayName:    req.DisplayName,
				BaseYieldGrams: req.BaseYieldGrams,
				Version:        1,
				Active:         true,
				Ingredients: []inventory.RecipeIngredient{
					{ItemID: itemA, ItemCode: "BOT-ASHWA-001", ItemDisplayName: "Ashwagandha Root", QuantityGrams: "20.000"},
					{ItemID: itemB, ItemCode: "BOT-GUDU-002", ItemDisplayName: "Guduchi Stem", QuantityGrams: "15.000"},
				},
			}, nil
		},
		updateRecipeFunc: func(ctx context.Context, actor, id string, req inventory.RecipeRequest) (inventory.Recipe, error) {
			if req.Version != 1 {
				return inventory.Recipe{}, inventory.ErrConflict
			}
			return inventory.Recipe{
				ID:             id,
				Code:           req.Code,
				DisplayName:    req.DisplayName,
				BaseYieldGrams: req.BaseYieldGrams,
				Version:        2,
				Active:         true,
				Ingredients: []inventory.RecipeIngredient{
					{ItemID: itemA, ItemCode: "BOT-ASHWA-001", ItemDisplayName: "Ashwagandha Root", QuantityGrams: "25.000"},
				},
			}, nil
		},
		listRecipesFunc: func(ctx context.Context, actor string) ([]inventory.Recipe, error) {
			return []inventory.Recipe{{ID: recipeID, Code: "REC-ASHWA-GUDU-01", DisplayName: "Synthetic Mix", BaseYieldGrams: "100.000", Version: 1, Active: true}}, nil
		},
		getRecipeFunc: func(ctx context.Context, actor, id string) (inventory.Recipe, error) {
			if id != recipeID {
				return inventory.Recipe{}, inventory.ErrNotFound
			}
			return inventory.Recipe{ID: recipeID, Code: "REC-ASHWA-GUDU-01", DisplayName: "Synthetic Mix", BaseYieldGrams: "100.000", Version: 1, Active: true}, nil
		},
	}

	gin.SetMode(gin.TestMode)
	router := NewRouter(nil, AuthRoutes{
		Service:       mockSessionAuth{},
		AllowedOrigin: "https://clinic.example",
		Preparations:  mockSvc,
	})

	t.Run("POST /api/v1/recipes requires CSRF and returns 201 Created", func(t *testing.T) {
		body, _ := json.Marshal(map[string]any{
			"code":           "REC-ASHWA-GUDU-01",
			"displayName":    "Synthetic Ashwagandha-Guduchi Mix",
			"baseYieldGrams": "100.000",
			"ingredients": []map[string]any{
				{"itemId": itemA, "quantityGrams": "20.000"},
				{"itemId": itemB, "quantityGrams": "15.000"},
			},
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/recipes", bytes.NewReader(body))
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

	t.Run("POST /api/v1/recipes without CSRF returns 403 Forbidden", func(t *testing.T) {
		body, _ := json.Marshal(map[string]any{
			"code":           "REC-ASHWA-GUDU-01",
			"displayName":    "Synthetic Ashwagandha-Guduchi Mix",
			"baseYieldGrams": "100.000",
			"ingredients":    []map[string]any{{"itemId": itemA, "quantityGrams": "20.000"}},
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/recipes", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://clinic.example")
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", rec.Code)
		}
	})

	t.Run("POST /api/v1/recipes returns 422 on validation failure and 409 on deactivated item", func(t *testing.T) {
		invalidBody, _ := json.Marshal(map[string]any{
			"code":           "REC-EMPTY",
			"displayName":    "Empty",
			"baseYieldGrams": "100.000",
			"ingredients":    []map[string]any{},
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/recipes", bytes.NewReader(invalidBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://clinic.example")
		req.Header.Set("X-CSRF-Token", "valid-csrf-token")
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422 (%s)", rec.Code, rec.Body.String())
		}

		conflictBody, _ := json.Marshal(map[string]any{
			"code":           "REC-INACTIVE",
			"displayName":    "Inactive item recipe",
			"baseYieldGrams": "100.000",
			"ingredients":    []map[string]any{{"itemId": itemA, "quantityGrams": "20.000"}},
		})
		conflictReq := httptest.NewRequest(http.MethodPost, "/api/v1/recipes", bytes.NewReader(conflictBody))
		conflictReq.Header.Set("Content-Type", "application/json")
		conflictReq.Header.Set("Origin", "https://clinic.example")
		conflictReq.Header.Set("X-CSRF-Token", "valid-csrf-token")
		conflictReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		conflictRec := httptest.NewRecorder()
		router.ServeHTTP(conflictRec, conflictReq)
		if conflictRec.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409 (%s)", conflictRec.Code, conflictRec.Body.String())
		}
	})

	t.Run("PATCH /api/v1/recipes/:id returns 200 OK and 409 Conflict on stale version", func(t *testing.T) {
		okBody, _ := json.Marshal(map[string]any{
			"code":           "REC-ASHWA-GUDU-01",
			"displayName":    "Updated Mix",
			"baseYieldGrams": "100.000",
			"version":        1,
			"ingredients":    []map[string]any{{"itemId": itemA, "quantityGrams": "25.000"}},
		})
		req := httptest.NewRequest(http.MethodPatch, "/api/v1/recipes/"+recipeID, bytes.NewReader(okBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://clinic.example")
		req.Header.Set("X-CSRF-Token", "valid-csrf-token")
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", rec.Code, rec.Body.String())
		}

		staleBody, _ := json.Marshal(map[string]any{
			"code":           "REC-ASHWA-GUDU-01",
			"displayName":    "Stale Mix",
			"baseYieldGrams": "100.000",
			"version":        99,
			"ingredients":    []map[string]any{{"itemId": itemA, "quantityGrams": "25.000"}},
		})
		staleReq := httptest.NewRequest(http.MethodPatch, "/api/v1/recipes/"+recipeID, bytes.NewReader(staleBody))
		staleReq.Header.Set("Content-Type", "application/json")
		staleReq.Header.Set("Origin", "https://clinic.example")
		staleReq.Header.Set("X-CSRF-Token", "valid-csrf-token")
		staleReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		staleRec := httptest.NewRecorder()
		router.ServeHTTP(staleRec, staleReq)
		if staleRec.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409 (%s)", staleRec.Code, staleRec.Body.String())
		}
	})

	t.Run("GET /api/v1/recipes and GET /api/v1/recipes/:id return 200 OK", func(t *testing.T) {
		listReq := httptest.NewRequest(http.MethodGet, "/api/v1/recipes", nil)
		listReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		listRec := httptest.NewRecorder()
		router.ServeHTTP(listRec, listReq)
		if listRec.Code != http.StatusOK {
			t.Fatalf("GET /recipes status = %d, want 200 (%s)", listRec.Code, listRec.Body.String())
		}

		getReq := httptest.NewRequest(http.MethodGet, "/api/v1/recipes/"+recipeID, nil)
		getReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		getRec := httptest.NewRecorder()
		router.ServeHTTP(getRec, getReq)
		if getRec.Code != http.StatusOK {
			t.Fatalf("GET /recipes/:id status = %d, want 200 (%s)", getRec.Code, getRec.Body.String())
		}
	})
}
