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
	createRecipeFunc             func(ctx context.Context, actor string, req inventory.RecipeRequest) (inventory.Recipe, error)
	updateRecipeFunc             func(ctx context.Context, actor, id string, req inventory.RecipeRequest) (inventory.Recipe, error)
	listRecipesFunc              func(ctx context.Context, actor string) ([]inventory.Recipe, error)
	getRecipeFunc                func(ctx context.Context, actor, id string) (inventory.Recipe, error)
	savePreparationFunc          func(ctx context.Context, actor string, req inventory.SavePreparationRequest) (inventory.Preparation, error)
	listPreparationsFilteredFunc func(ctx context.Context, actor string, filter inventory.ListPreparationsFilter) ([]inventory.Preparation, error)
	getPreparationFunc           func(ctx context.Context, actor, id string) (inventory.Preparation, error)
	confirmConsumptionFunc       func(ctx context.Context, actor, id string, req inventory.ConfirmConsumptionRequest) (inventory.Preparation, bool, error)
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

func (m *mockPreparationService) SavePreparation(ctx context.Context, actor string, req inventory.SavePreparationRequest) (inventory.Preparation, error) {
	if m.savePreparationFunc != nil {
		return m.savePreparationFunc(ctx, actor, req)
	}
	return inventory.Preparation{}, nil
}

func (m *mockPreparationService) ListPreparations(ctx context.Context, actor, patientID string) ([]inventory.Preparation, error) {
	return m.ListPreparationsFiltered(ctx, actor, inventory.ListPreparationsFilter{PatientID: patientID})
}

func (m *mockPreparationService) ListPreparationsFiltered(ctx context.Context, actor string, filter inventory.ListPreparationsFilter) ([]inventory.Preparation, error) {
	if m.listPreparationsFilteredFunc != nil {
		return m.listPreparationsFilteredFunc(ctx, actor, filter)
	}
	return []inventory.Preparation{}, nil
}

func (m *mockPreparationService) GetPreparation(ctx context.Context, actor, id string) (inventory.Preparation, error) {
	if m.getPreparationFunc != nil {
		return m.getPreparationFunc(ctx, actor, id)
	}
	return inventory.Preparation{}, nil
}

func (m *mockPreparationService) ConfirmConsumption(ctx context.Context, actor, id string, req inventory.ConfirmConsumptionRequest) (inventory.Preparation, bool, error) {
	if m.confirmConsumptionFunc != nil {
		return m.confirmConsumptionFunc(ctx, actor, id, req)
	}
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

func TestPreparationSnapshotHTTPRoutes(t *testing.T) {
	prepID := "99123910-1293-4819-9182-192837465111"
	patientID := "30ad6d29-79b0-4028-93c4-614df48ec3ea"
	sessionID := "88123910-1293-4819-9182-192837465001"
	recipeID := "55123910-1293-4819-9182-192837465099"
	itemA := "10938471-2938-4819-9182-736451928374"

	sample := inventory.Preparation{
		ID:               prepID,
		PatientID:        patientID,
		SessionID:        sessionID,
		RecipeID:         recipeID,
		RecipeVersion:    1,
		TargetYieldGrams: "250.000",
		Status:           "prepared",
		PreparedBy:       "d02c1c97-7588-4455-a045-127158e311f6",
		PreparedAt:       time.Date(2026, 10, 31, 8, 40, 0, 0, time.UTC),
		Snapshot: []inventory.SnapshotItem{
			{ItemID: itemA, ItemCode: "BOT-ASHWA-001", ItemDisplayName: "Ashwagandha Root", BaseQuantityGrams: "20.000", RequiredGrams: "50.000"},
		},
		Consumptions: []inventory.Consumption{},
	}

	var capturedFilter inventory.ListPreparationsFilter
	mockSvc := &mockPreparationService{
		savePreparationFunc: func(ctx context.Context, actor string, req inventory.SavePreparationRequest) (inventory.Preparation, error) {
			if req.TargetYieldGrams == "0.000" {
				return inventory.Preparation{}, inventory.ErrValidation
			}
			if req.SessionID == "cancelled-session" {
				return inventory.Preparation{}, inventory.ErrConflict
			}
			return sample, nil
		},
		listPreparationsFilteredFunc: func(ctx context.Context, actor string, filter inventory.ListPreparationsFilter) ([]inventory.Preparation, error) {
			capturedFilter = filter
			if filter.Status != "" && filter.Status != "prepared" && filter.Status != "consumed" {
				return nil, inventory.ErrValidation
			}
			return []inventory.Preparation{sample}, nil
		},
		getPreparationFunc: func(ctx context.Context, actor, id string) (inventory.Preparation, error) {
			if id != prepID {
				return inventory.Preparation{}, inventory.ErrNotFound
			}
			return sample, nil
		},
	}

	gin.SetMode(gin.TestMode)
	router := NewRouter(nil, AuthRoutes{
		Service:       mockSessionAuth{},
		AllowedOrigin: "https://clinic.example",
		Preparations:  mockSvc,
	})

	t.Run("POST /api/v1/preparations requires CSRF and returns 201 Created snapshot", func(t *testing.T) {
		body, _ := json.Marshal(map[string]any{
			"patientId":        patientID,
			"sessionId":        sessionID,
			"recipeId":         recipeID,
			"targetYieldGrams": "250.000",
		})
		noCSRF := httptest.NewRequest(http.MethodPost, "/api/v1/preparations", bytes.NewReader(body))
		noCSRF.Header.Set("Content-Type", "application/json")
		noCSRF.Header.Set("Origin", "https://clinic.example")
		noCSRF.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		noCSRFRec := httptest.NewRecorder()
		router.ServeHTTP(noCSRFRec, noCSRF)
		if noCSRFRec.Code != http.StatusForbidden {
			t.Fatalf("without CSRF status = %d, want 403", noCSRFRec.Code)
		}

		req := httptest.NewRequest(http.MethodPost, "/api/v1/preparations", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://clinic.example")
		req.Header.Set("X-CSRF-Token", "valid-csrf-token")
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("status = %d, want 201 (%s)", rec.Code, rec.Body.String())
		}
		var got inventory.Preparation
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		if got.Status != "prepared" || got.ConsumedBy != nil || got.OperationID != nil || len(got.Snapshot) != 1 || len(got.Consumptions) != 0 {
			t.Fatalf("unexpected saved preparation payload: %+v", got)
		}
	})

	t.Run("POST /api/v1/preparations returns 422 on invalid yield and 409 on conflict", func(t *testing.T) {
		invalidBody, _ := json.Marshal(map[string]any{
			"patientId":        patientID,
			"sessionId":        sessionID,
			"recipeId":         recipeID,
			"targetYieldGrams": "0.000",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/preparations", bytes.NewReader(invalidBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://clinic.example")
		req.Header.Set("X-CSRF-Token", "valid-csrf-token")
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("invalid yield status = %d, want 422", rec.Code)
		}

		conflictBody, _ := json.Marshal(map[string]any{
			"patientId":        patientID,
			"sessionId":        "cancelled-session",
			"recipeId":         recipeID,
			"targetYieldGrams": "250.000",
		})
		conflictReq := httptest.NewRequest(http.MethodPost, "/api/v1/preparations", bytes.NewReader(conflictBody))
		conflictReq.Header.Set("Content-Type", "application/json")
		conflictReq.Header.Set("Origin", "https://clinic.example")
		conflictReq.Header.Set("X-CSRF-Token", "valid-csrf-token")
		conflictReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		conflictRec := httptest.NewRecorder()
		router.ServeHTTP(conflictRec, conflictReq)
		if conflictRec.Code != http.StatusConflict {
			t.Fatalf("cancelled session status = %d, want 409", conflictRec.Code)
		}
	})

	t.Run("GET /api/v1/preparations forwards patientId/sessionId/status and GET /:id handles 200/404", func(t *testing.T) {
		listReq := httptest.NewRequest(http.MethodGet, "/api/v1/preparations?patientId="+patientID+"&sessionId="+sessionID+"&status=prepared", nil)
		listReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		listRec := httptest.NewRecorder()
		router.ServeHTTP(listRec, listReq)
		if listRec.Code != http.StatusOK {
			t.Fatalf("GET /preparations status = %d, want 200 (%s)", listRec.Code, listRec.Body.String())
		}
		if capturedFilter.PatientID != patientID || capturedFilter.SessionID != sessionID || capturedFilter.Status != "prepared" {
			t.Fatalf("unexpected captured filter: %+v", capturedFilter)
		}

		badStatusReq := httptest.NewRequest(http.MethodGet, "/api/v1/preparations?patientId="+patientID+"&status=invalid", nil)
		badStatusReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		badStatusRec := httptest.NewRecorder()
		router.ServeHTTP(badStatusRec, badStatusReq)
		if badStatusRec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("bad status query code = %d, want 422", badStatusRec.Code)
		}

		getReq := httptest.NewRequest(http.MethodGet, "/api/v1/preparations/"+prepID, nil)
		getReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		getRec := httptest.NewRecorder()
		router.ServeHTTP(getRec, getReq)
		if getRec.Code != http.StatusOK {
			t.Fatalf("GET /preparations/:id status = %d, want 200", getRec.Code)
		}

		missingReq := httptest.NewRequest(http.MethodGet, "/api/v1/preparations/00000000-0000-4000-8000-000000000000", nil)
		missingReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		missingRec := httptest.NewRecorder()
		router.ServeHTTP(missingRec, missingReq)
		if missingRec.Code != http.StatusNotFound {
			t.Fatalf("missing preparation status = %d, want 404", missingRec.Code)
		}
	})
}

func TestConfirmConsumptionHTTPRoutes(t *testing.T) {
	prepID := "99123910-1293-4819-9182-192837465111"
	opID := "7c4a1b9e-2001-4c9a-8a11-111111111111"
	batchA := "b1111111-2222-4333-8444-555555555555"
	batchB := "b2222222-2222-4333-8444-555555555556"
	itemA := "10938471-2938-4819-9182-736451928374"
	consumedAt := time.Date(2026, 10, 31, 8, 45, 0, 0, time.UTC)
	consumedBy := "d02c1c97-7588-4455-a045-127158e311f6"

	seenOp := false
	mockSvc := &mockPreparationService{
		confirmConsumptionFunc: func(ctx context.Context, actor, id string, req inventory.ConfirmConsumptionRequest) (inventory.Preparation, bool, error) {
			if id != prepID {
				return inventory.Preparation{}, false, inventory.ErrNotFound
			}
			if len(req.Allocations) == 0 {
				return inventory.Preparation{}, false, inventory.ErrValidation
			}
			if req.Allocations[0].BatchID == "blocked-batch" {
				return inventory.Preparation{}, false, inventory.ErrConflict
			}
			replay := seenOp && req.OperationID == opID
			if req.OperationID == opID {
				seenOp = true
			}
			return inventory.Preparation{
				ID:               prepID,
				Status:           "consumed",
				TargetYieldGrams: "250.000",
				ConsumedBy:       &consumedBy,
				ConsumedAt:       &consumedAt,
				OperationID:      &opID,
				Consumptions: []inventory.Consumption{
					{BatchID: batchA, ItemID: itemA, QuantityGrams: "30.000", ConfirmedAt: consumedAt},
					{BatchID: batchB, ItemID: itemA, QuantityGrams: "20.000", ConfirmedAt: consumedAt},
				},
			}, replay, nil
		},
	}

	gin.SetMode(gin.TestMode)
	router := NewRouter(nil, AuthRoutes{
		Service:       mockSessionAuth{},
		AllowedOrigin: "https://clinic.example",
		Preparations:  mockSvc,
	})

	t.Run("POST /api/v1/preparations/:id/confirm-consumption enforces CSRF and returns 200 OK", func(t *testing.T) {
		body, _ := json.Marshal(map[string]any{
			"operationId": opID,
			"allocations": []map[string]any{
				{"batchId": batchA, "quantityGrams": "30.000"},
				{"batchId": batchB, "quantityGrams": "20.000"},
			},
		})

		noCSRF := httptest.NewRequest(http.MethodPost, "/api/v1/preparations/"+prepID+"/confirm-consumption", bytes.NewReader(body))
		noCSRF.Header.Set("Content-Type", "application/json")
		noCSRF.Header.Set("Origin", "https://clinic.example")
		noCSRF.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		noCSRFRec := httptest.NewRecorder()
		router.ServeHTTP(noCSRFRec, noCSRF)
		if noCSRFRec.Code != http.StatusForbidden {
			t.Fatalf("without CSRF status = %d, want 403", noCSRFRec.Code)
		}

		req := httptest.NewRequest(http.MethodPost, "/api/v1/preparations/"+prepID+"/confirm-consumption", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://clinic.example")
		req.Header.Set("X-CSRF-Token", "valid-csrf-token")
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200 (%s)", rec.Code, rec.Body.String())
		}
		var got inventory.Preparation
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		if got.Status != "consumed" || got.OperationID == nil || *got.OperationID != opID || len(got.Consumptions) != 2 {
			t.Fatalf("unexpected confirmed preparation: %+v", got)
		}
		if rec.Header().Get("X-Idempotent-Replay") != "" {
			t.Fatalf("initial confirmation should not set X-Idempotent-Replay, got %q", rec.Header().Get("X-Idempotent-Replay"))
		}

		// Identical retry returns 200 OK with X-Idempotent-Replay: true and Cache-Control: no-store.
		retryReq := httptest.NewRequest(http.MethodPost, "/api/v1/preparations/"+prepID+"/confirm-consumption", bytes.NewReader(body))
		retryReq.Header.Set("Content-Type", "application/json")
		retryReq.Header.Set("Origin", "https://clinic.example")
		retryReq.Header.Set("X-CSRF-Token", "valid-csrf-token")
		retryReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
		retryRec := httptest.NewRecorder()
		router.ServeHTTP(retryRec, retryReq)
		if retryRec.Code != http.StatusOK {
			t.Fatalf("retry status = %d, want 200 (%s)", retryRec.Code, retryRec.Body.String())
		}
		if retryRec.Header().Get("X-Idempotent-Replay") != "true" {
			t.Fatalf("retry X-Idempotent-Replay = %q, want true", retryRec.Header().Get("X-Idempotent-Replay"))
		}
		if retryRec.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("retry Cache-Control = %q, want no-store", retryRec.Header().Get("Cache-Control"))
		}
	})

	t.Run("POST /confirm-consumption maps 422 validation, 409 conflict, and 404 not found", func(t *testing.T) {
		for _, tc := range []struct {
			name     string
			path     string
			payload  map[string]any
			wantCode int
		}{
			{
				name:     "empty allocations -> 422",
				path:     "/api/v1/preparations/" + prepID + "/confirm-consumption",
				payload:  map[string]any{"operationId": opID, "allocations": []map[string]any{}},
				wantCode: http.StatusUnprocessableEntity,
			},
			{
				name: "blocked batch -> 409",
				path: "/api/v1/preparations/" + prepID + "/confirm-consumption",
				payload: map[string]any{
					"operationId": opID,
					"allocations": []map[string]any{{"batchId": "blocked-batch", "quantityGrams": "50.000"}},
				},
				wantCode: http.StatusConflict,
			},
			{
				name: "unknown preparation -> 404",
				path: "/api/v1/preparations/00000000-0000-4000-8000-000000000000/confirm-consumption",
				payload: map[string]any{
					"operationId": opID,
					"allocations": []map[string]any{{"batchId": batchA, "quantityGrams": "50.000"}},
				},
				wantCode: http.StatusNotFound,
			},
		} {
			body, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest(http.MethodPost, tc.path, bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Origin", "https://clinic.example")
			req.Header.Set("X-CSRF-Token", "valid-csrf-token")
			req.AddCookie(&http.Cookie{Name: sessionCookie, Value: "valid-session"})
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != tc.wantCode {
				t.Fatalf("%s status = %d, want %d (%s)", tc.name, rec.Code, tc.wantCode, rec.Body.String())
			}
		}
	})
}
