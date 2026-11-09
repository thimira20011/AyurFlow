package inventory

import (
	"context"
	"errors"
	"math/big"
	"strings"
	"time"

	"ayurflow/backend/internal/audit"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type RecipeIngredientInput struct {
	ItemID        string `json:"itemId"`
	QuantityGrams string `json:"quantityGrams"`
}
type RecipeRequest struct {
	Code           string                  `json:"code"`
	DisplayName    string                  `json:"displayName"`
	BaseYieldGrams string                  `json:"baseYieldGrams"`
	Ingredients    []RecipeIngredientInput `json:"ingredients"`
	Version        int64                   `json:"version,omitempty"`
}
type RecipeIngredient struct {
	ItemID          string `json:"itemId"`
	ItemCode        string `json:"itemCode"`
	ItemDisplayName string `json:"itemDisplayName"`
	QuantityGrams   string `json:"quantityGrams"`
}
type Recipe struct {
	ID             string             `json:"id"`
	Code           string             `json:"code"`
	DisplayName    string             `json:"displayName"`
	BaseYieldGrams string             `json:"baseYieldGrams"`
	Version        int64              `json:"version"`
	Active         bool               `json:"active"`
	Ingredients    []RecipeIngredient `json:"ingredients"`
}
type SnapshotItem struct {
	ItemID            string `json:"itemId"`
	ItemCode          string `json:"itemCode"`
	ItemDisplayName   string `json:"itemDisplayName"`
	BaseQuantityGrams string `json:"baseQuantityGrams"`
	RequiredGrams     string `json:"requiredGrams"`
}
type Consumption struct {
	BatchID       string    `json:"batchId"`
	ItemID        string    `json:"itemId"`
	QuantityGrams string    `json:"quantityGrams"`
	ConfirmedAt   time.Time `json:"confirmedAt"`
}
type Preparation struct {
	ID               string         `json:"id"`
	PatientID        string         `json:"patientId"`
	SessionID        string         `json:"sessionId"`
	RecipeID         string         `json:"recipeId"`
	RecipeVersion    int64          `json:"recipeVersion"`
	TargetYieldGrams string         `json:"targetYieldGrams"`
	Status           string         `json:"status"`
	PreparedBy       string         `json:"preparedBy"`
	PreparedAt       time.Time      `json:"preparedAt"`
	ConsumedBy       *string        `json:"consumedBy"`
	ConsumedAt       *time.Time     `json:"consumedAt"`
	OperationID      *string        `json:"operationId"`
	Snapshot         []SnapshotItem `json:"snapshot"`
	Consumptions     []Consumption  `json:"consumptions"`
}
type SavePreparationRequest struct {
	PatientID        string `json:"patientId"`
	SessionID        string `json:"sessionId"`
	RecipeID         string `json:"recipeId"`
	TargetYieldGrams string `json:"targetYieldGrams"`
}

func preparationDBError(err error) error {
	var db *pgconn.PgError
	if errors.As(err, &db) {
		switch db.Code {
		case "23505", "23514":
			return ErrConflict
		case "23503":
			return ErrNotFound
		}
	}
	return err
}

func validateRecipe(req RecipeRequest) (int64, map[string]int64, error) {
	code, err := validateItemCode(req.Code)
	if err != nil {
		return 0, nil, err
	}
	_ = code
	if _, err := validateDisplayName(req.DisplayName); err != nil {
		return 0, nil, err
	}
	yield, err := ParseGramsToMilligrams(req.BaseYieldGrams, false)
	if err != nil {
		return 0, nil, err
	}
	if len(req.Ingredients) == 0 || len(req.Ingredients) > 50 {
		return 0, nil, ErrValidation
	}
	items := make(map[string]int64, len(req.Ingredients))
	for _, item := range req.Ingredients {
		id, err := canonicalUUID(item.ItemID, "itemId")
		if err != nil {
			return 0, nil, err
		}
		quantity, err := ParseGramsToMilligrams(item.QuantityGrams, false)
		if err != nil {
			return 0, nil, err
		}
		if _, exists := items[id]; exists {
			return 0, nil, ErrValidation
		}
		items[id] = quantity
	}
	return yield, items, nil
}

func recipeTx(ctx context.Context, tx pgx.Tx, id string) (Recipe, error) {
	var out Recipe
	err := tx.QueryRow(ctx, `SELECT id::text,code,display_name,base_yield_grams::text,version,active
		FROM recipes WHERE id=$1`, id).Scan(&out.ID, &out.Code, &out.DisplayName, &out.BaseYieldGrams, &out.Version, &out.Active)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, ErrNotFound
	}
	if err != nil {
		return out, err
	}
	rows, err := tx.Query(ctx, `SELECT i.item_id::text,b.code,b.display_name,i.quantity_grams::text
		FROM recipe_ingredients i JOIN botanical_items b ON b.id=i.item_id WHERE i.recipe_id=$1 ORDER BY b.code`, id)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var item RecipeIngredient
		if err := rows.Scan(&item.ItemID, &item.ItemCode, &item.ItemDisplayName, &item.QuantityGrams); err != nil {
			return out, err
		}
		out.Ingredients = append(out.Ingredients, item)
	}
	return out, rows.Err()
}

func insertIngredients(ctx context.Context, tx pgx.Tx, recipeID string, items map[string]int64) error {
	for id, quantity := range items {
		var active bool
		if err := tx.QueryRow(ctx, `SELECT active FROM botanical_items WHERE id=$1 FOR SHARE`, id).Scan(&active); err != nil || !active {
			return ErrNotFound
		}
		if _, err := tx.Exec(ctx, `INSERT INTO recipe_ingredients(recipe_id,item_id,quantity_grams)
			VALUES ($1,$2,$3::numeric)`, recipeID, id, FormatMilligramsToGrams(quantity)); err != nil {
			return preparationDBError(err)
		}
	}
	return nil
}

func (s *Service) CreateRecipe(ctx context.Context, actor string, req RecipeRequest) (Recipe, error) {
	yield, items, err := validateRecipe(req)
	if err != nil {
		return Recipe{}, err
	}
	var out Recipe
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := s.requireRole(ctx, tx, actor, "dispensary"); err != nil {
			return err
		}
		var id string
		if err := tx.QueryRow(ctx, `INSERT INTO recipes(code,display_name,base_yield_grams,created_by)
			VALUES ($1,$2,$3::numeric,$4) RETURNING id::text`, strings.ToUpper(strings.TrimSpace(req.Code)), strings.TrimSpace(req.DisplayName), FormatMilligramsToGrams(yield), actor).Scan(&id); err != nil {
			return preparationDBError(err)
		}
		if err := insertIngredients(ctx, tx, id, items); err != nil {
			return err
		}
		if err := s.writeAudit(ctx, tx, audit.Event{ActorID: actor, Action: "recipe.created", Object: audit.Object{Type: "recipe", ID: id}}); err != nil {
			return err
		}
		out, err = recipeTx(ctx, tx, id)
		return err
	})
	return out, err
}

func (s *Service) UpdateRecipe(ctx context.Context, actor, id string, req RecipeRequest) (Recipe, error) {
	id, err := canonicalUUID(id, "recipeId")
	if err != nil {
		return Recipe{}, err
	}
	yield, items, err := validateRecipe(req)
	if err != nil {
		return Recipe{}, err
	}
	if req.Version < 1 {
		return Recipe{}, ErrValidation
	}
	var out Recipe
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := s.requireRole(ctx, tx, actor, "dispensary"); err != nil {
			return err
		}
		var version int64
		var code string
		if err := tx.QueryRow(ctx, `SELECT version,code FROM recipes WHERE id=$1 FOR UPDATE`, id).Scan(&version, &code); errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		} else if err != nil {
			return err
		}
		if version != req.Version || code != strings.ToUpper(strings.TrimSpace(req.Code)) {
			return ErrConflict
		}
		if _, err := tx.Exec(ctx, `UPDATE recipes SET display_name=$2,base_yield_grams=$3::numeric,version=version+1,updated_at=clock_timestamp() WHERE id=$1`,
			id, strings.TrimSpace(req.DisplayName), FormatMilligramsToGrams(yield)); err != nil {
			return preparationDBError(err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM recipe_ingredients WHERE recipe_id=$1`, id); err != nil {
			return err
		}
		if err := insertIngredients(ctx, tx, id, items); err != nil {
			return err
		}
		if err := s.writeAudit(ctx, tx, audit.Event{ActorID: actor, Action: "recipe.updated", Object: audit.Object{Type: "recipe", ID: id}, ChangedFields: []string{"display_name", "base_yield_grams", "ingredients"}}); err != nil {
			return err
		}
		out, err = recipeTx(ctx, tx, id)
		return err
	})
	return out, err
}

func (s *Service) ListRecipes(ctx context.Context, actor string) ([]Recipe, error) {
	var result []Recipe
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := s.requireRole(ctx, tx, actor, "dispensary", "clinician", "report_reader"); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `SELECT id::text FROM recipes WHERE active ORDER BY display_name,id LIMIT 100`)
		if err != nil {
			return err
		}
		var ids []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return err
			}
			ids = append(ids, id)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return err
		}
		for _, id := range ids {
			item, err := recipeTx(ctx, tx, id)
			if err != nil {
				return err
			}
			result = append(result, item)
		}
		return nil
	})
	return result, err
}

func (s *Service) GetRecipe(ctx context.Context, actor, id string) (Recipe, error) {
	id, err := canonicalUUID(id, "recipeId")
	if err != nil {
		return Recipe{}, err
	}
	var out Recipe
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := s.requireRole(ctx, tx, actor, "dispensary", "clinician", "report_reader"); err != nil {
			return err
		}
		out, err = recipeTx(ctx, tx, id)
		return err
	})
	return out, err
}

func scaleQuantity(base, target, yield int64) (int64, error) {
	product := new(big.Int).Mul(big.NewInt(base), big.NewInt(target))
	product.Add(product, new(big.Int).Div(big.NewInt(yield), big.NewInt(2)))
	result := product.Div(product, big.NewInt(yield))
	if !result.IsInt64() || result.Int64() < 1 || result.Int64() > MaxMilligrams {
		return 0, ErrValidation
	}
	return result.Int64(), nil
}

func preparationTx(ctx context.Context, tx pgx.Tx, id string) (Preparation, error) {
	var out Preparation
	err := tx.QueryRow(ctx, `SELECT id::text,patient_id::text,session_id::text,recipe_id::text,recipe_version,
		target_yield_grams::text,status,prepared_by::text,prepared_at,consumed_by::text,consumed_at,operation_id::text
		FROM preparations WHERE id=$1`, id).Scan(&out.ID, &out.PatientID, &out.SessionID, &out.RecipeID, &out.RecipeVersion,
		&out.TargetYieldGrams, &out.Status, &out.PreparedBy, &out.PreparedAt, &out.ConsumedBy, &out.ConsumedAt, &out.OperationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, ErrNotFound
	}
	if err != nil {
		return out, err
	}
	rows, err := tx.Query(ctx, `SELECT item_id::text,item_code,item_display_name,base_quantity_grams::text,required_grams::text
		FROM preparation_snapshot_items WHERE preparation_id=$1 ORDER BY item_code`, id)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var item SnapshotItem
		if err := rows.Scan(&item.ItemID, &item.ItemCode, &item.ItemDisplayName, &item.BaseQuantityGrams, &item.RequiredGrams); err != nil {
			rows.Close()
			return out, err
		}
		out.Snapshot = append(out.Snapshot, item)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return out, err
	}
	rows, err = tx.Query(ctx, `SELECT batch_id::text,item_id::text,quantity_grams::text,confirmed_at
		FROM batch_consumptions WHERE preparation_id=$1 ORDER BY batch_id`, id)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var item Consumption
		if err := rows.Scan(&item.BatchID, &item.ItemID, &item.QuantityGrams, &item.ConfirmedAt); err != nil {
			return out, err
		}
		out.Consumptions = append(out.Consumptions, item)
	}
	return out, rows.Err()
}

func (s *Service) SavePreparation(ctx context.Context, actor string, req SavePreparationRequest) (Preparation, error) {
	patient, err := canonicalUUID(req.PatientID, "patientId")
	if err != nil {
		return Preparation{}, err
	}
	session, err := canonicalUUID(req.SessionID, "sessionId")
	if err != nil {
		return Preparation{}, err
	}
	recipe, err := canonicalUUID(req.RecipeID, "recipeId")
	if err != nil {
		return Preparation{}, err
	}
	target, err := ParseGramsToMilligrams(req.TargetYieldGrams, false)
	if err != nil {
		return Preparation{}, err
	}
	var out Preparation
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := s.requireRole(ctx, tx, actor, "dispensary"); err != nil {
			return err
		}
		var status, planStatus, stageStatus string
		if err := tx.QueryRow(ctx, `SELECT t.status,p.status,s.status FROM therapy_sessions t
			JOIN care_plans p ON p.id=t.plan_id JOIN plan_stages s ON s.id=t.stage_id
			WHERE t.id=$1 AND t.patient_id=$2 FOR SHARE OF p,s`, session, patient).Scan(&status, &planStatus, &stageStatus); errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		} else if err != nil {
			return err
		}
		if status == "cancelled" || planStatus != "active" || stageStatus != "approved" {
			return ErrConflict
		}
		var version int64
		var baseYield string
		if err := tx.QueryRow(ctx, `SELECT version,base_yield_grams::text FROM recipes WHERE id=$1 AND active FOR SHARE`, recipe).Scan(&version, &baseYield); errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		} else if err != nil {
			return err
		}
		base, err := ParseGramsToMilligrams(baseYield, false)
		if err != nil {
			return err
		}
		var id string
		if err := tx.QueryRow(ctx, `INSERT INTO preparations(patient_id,session_id,recipe_id,recipe_version,target_yield_grams,prepared_by)
			VALUES ($1,$2,$3,$4,$5::numeric,$6) RETURNING id::text`, patient, session, recipe, version, FormatMilligramsToGrams(target), actor).Scan(&id); err != nil {
			return preparationDBError(err)
		}
		rows, err := tx.Query(ctx, `SELECT i.item_id::text,b.code,b.display_name,i.quantity_grams::text FROM recipe_ingredients i
			JOIN botanical_items b ON b.id=i.item_id WHERE i.recipe_id=$1 ORDER BY i.item_id`, recipe)
		if err != nil {
			return err
		}
		var ingredients []RecipeIngredient
		for rows.Next() {
			var item RecipeIngredient
			if err := rows.Scan(&item.ItemID, &item.ItemCode, &item.ItemDisplayName, &item.QuantityGrams); err != nil {
				rows.Close()
				return err
			}
			ingredients = append(ingredients, item)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return err
		}
		if len(ingredients) == 0 {
			return ErrConflict
		}
		for _, item := range ingredients {
			baseQuantity, err := ParseGramsToMilligrams(item.QuantityGrams, false)
			if err != nil {
				return err
			}
			required, err := scaleQuantity(baseQuantity, target, base)
			if err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, `INSERT INTO preparation_snapshot_items(preparation_id,item_id,item_code,item_display_name,base_quantity_grams,required_grams)
				VALUES ($1,$2,$3,$4,$5::numeric,$6::numeric)`, id, item.ItemID, item.ItemCode, item.ItemDisplayName,
				FormatMilligramsToGrams(baseQuantity), FormatMilligramsToGrams(required)); err != nil {
				return preparationDBError(err)
			}
		}
		if err := s.writeAudit(ctx, tx, audit.Event{ActorID: actor, Action: "preparation.created", Object: audit.Object{Type: "preparation", ID: id}}); err != nil {
			return err
		}
		out, err = preparationTx(ctx, tx, id)
		return err
	})
	return out, err
}

func (s *Service) GetPreparation(ctx context.Context, actor, id string) (Preparation, error) {
	id, err := canonicalUUID(id, "preparationId")
	if err != nil {
		return Preparation{}, err
	}
	var out Preparation
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := s.requireRole(ctx, tx, actor, "dispensary"); err != nil {
			return err
		}
		out, err = preparationTx(ctx, tx, id)
		return err
	})
	return out, err
}

func (s *Service) ListPreparations(ctx context.Context, actor, patientID string) ([]Preparation, error) {
	patientID, err := canonicalUUID(patientID, "patientId")
	if err != nil {
		return nil, err
	}
	var result []Preparation
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := s.requireRole(ctx, tx, actor, "dispensary"); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `SELECT id::text FROM preparations WHERE patient_id=$1 ORDER BY prepared_at DESC,id DESC LIMIT 100`, patientID)
		if err != nil {
			return err
		}
		var ids []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return err
			}
			ids = append(ids, id)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return err
		}
		for _, id := range ids {
			item, err := preparationTx(ctx, tx, id)
			if err != nil {
				return err
			}
			result = append(result, item)
		}
		return nil
	})
	return result, err
}
