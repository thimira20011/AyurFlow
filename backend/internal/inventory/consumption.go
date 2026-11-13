package inventory

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"sort"
	"strings"
	"time"

	"ayurflow/backend/internal/audit"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type Allocation struct {
	BatchID       string `json:"batchId"`
	QuantityGrams string `json:"quantityGrams"`
}
type ConfirmConsumptionRequest struct {
	OperationID string       `json:"operationId"`
	Allocations []Allocation `json:"allocations"`
}
type TraceRow struct {
	PatientID          string    `json:"patientId"`
	PatientDisplayName string    `json:"patientDisplayName"`
	SessionID          string    `json:"sessionId"`
	PreparationID      string    `json:"preparationId"`
	BatchID            string    `json:"batchId"`
	BatchReference     string    `json:"batchReference"`
	QuantityGrams      string    `json:"quantityGrams"`
	ConfirmedBy        string    `json:"confirmedBy"`
	ConfirmedAt        time.Time `json:"confirmedAt"`
}

type selectedAllocation struct {
	id         string
	milligrams int64
}

func canonicalAllocations(req ConfirmConsumptionRequest) (string, []selectedAllocation, error) {
	operation, err := canonicalUUID(req.OperationID, "operationId")
	if err != nil {
		return "", nil, err
	}
	if len(req.Allocations) == 0 || len(req.Allocations) > 100 {
		return "", nil, ErrValidation
	}
	selected := make([]selectedAllocation, 0, len(req.Allocations))
	seen := make(map[string]bool, len(req.Allocations))
	for _, input := range req.Allocations {
		id, err := canonicalUUID(input.BatchID, "batchId")
		if err != nil {
			return "", nil, err
		}
		amount, err := ParseGramsToMilligrams(input.QuantityGrams, false)
		if err != nil {
			return "", nil, err
		}
		if seen[id] {
			return "", nil, ErrValidation
		}
		seen[id] = true
		selected = append(selected, selectedAllocation{id: id, milligrams: amount})
	}
	sort.Slice(selected, func(i, j int) bool { return selected[i].id < selected[j].id })
	return operation, selected, nil
}

func payloadHash(preparationID string, allocations []selectedAllocation) string {
	var builder strings.Builder
	builder.WriteString(preparationID)
	for _, item := range allocations {
		builder.WriteByte('|')
		builder.WriteString(item.id)
		builder.WriteByte(':')
		builder.WriteString(FormatMilligramsToGrams(item.milligrams))
	}
	sum := sha256.Sum256([]byte(builder.String()))
	return hex.EncodeToString(sum[:])
}

// ConfirmConsumption locks the operation, preparation, and selected batches in
// that order. Same-payload retries return the committed preparation unchanged.
func (s *Service) ConfirmConsumption(ctx context.Context, actor, preparationID string, req ConfirmConsumptionRequest) (Preparation, bool, error) {
	id, err := canonicalUUID(preparationID, "preparationId")
	if err != nil {
		return Preparation{}, false, err
	}
	operation, allocations, err := canonicalAllocations(req)
	if err != nil {
		return Preparation{}, false, err
	}
	fingerprint := payloadHash(id, allocations)
	var result Preparation
	var replay bool
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := s.requireRole(ctx, tx, actor, "dispensary"); err != nil {
			return err
		}
		var uuid pgtype.UUID
		if err := uuid.Scan(operation); err != nil {
			return ErrValidation
		}
		lockKey := int64(binary.BigEndian.Uint64(uuid.Bytes[:8]))
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, lockKey); err != nil {
			return err
		}
		var previousID, previousHash string
		err := tx.QueryRow(ctx, `SELECT preparation_id::text,payload_sha256 FROM consumption_operations WHERE operation_id=$1`, operation).Scan(&previousID, &previousHash)
		if err == nil {
			if previousID != id || previousHash != fingerprint {
				return ErrConflict
			}
			replay = true
			result, err = preparationTx(ctx, tx, id)
			return err
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		var status string
		if err := tx.QueryRow(ctx, `SELECT status FROM preparations WHERE id=$1 FOR UPDATE`, id).Scan(&status); errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		} else if err != nil {
			return err
		}
		if status != "prepared" {
			return ErrConflict
		}
		var deliveryStatus string
		if err := tx.QueryRow(ctx, `SELECT t.status FROM preparations p JOIN therapy_sessions t ON t.id=p.session_id
			WHERE p.id=$1 FOR SHARE OF t`, id).Scan(&deliveryStatus); err != nil {
			return err
		}
		if deliveryStatus != "in_progress" && deliveryStatus != "completed" {
			return ErrConflict
		}
		rows, err := tx.Query(ctx, `SELECT item_id::text,required_grams::text FROM preparation_snapshot_items WHERE preparation_id=$1`, id)
		if err != nil {
			return err
		}
		required := map[string]int64{}
		for rows.Next() {
			var itemID, grams string
			if err := rows.Scan(&itemID, &grams); err != nil {
				rows.Close()
				return err
			}
			amount, err := ParseGramsToMilligrams(grams, false)
			if err != nil {
				rows.Close()
				return err
			}
			required[itemID] = amount
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return err
		}
		if len(required) == 0 {
			return ErrConflict
		}
		sums := map[string]int64{}
		clinicDate := ColomboDateString(s.now())
		for _, allocation := range allocations {
			var itemID, remaining string
			var blocked bool
			var nullableExpiry *string
			err := tx.QueryRow(ctx, `SELECT item_id::text,remaining_grams::text,expires_at::text,blocked
				FROM stock_batches WHERE id=$1 FOR UPDATE`, allocation.id).Scan(&itemID, &remaining, &nullableExpiry, &blocked)
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNotFound
			}
			if err != nil {
				return err
			}
			stock, err := ParseGramsToMilligrams(remaining, true)
			if err != nil {
				return err
			}
			if EvaluateEligibility(blocked, stock, nullableExpiry, clinicDate) != EligibilityEligible || stock < allocation.milligrams {
				return ErrConflict
			}
			if _, ok := required[itemID]; !ok {
				return ErrValidation
			}
			sums[itemID] += allocation.milligrams
			if sums[itemID] > required[itemID] {
				return ErrValidation
			}
			if _, err := tx.Exec(ctx, `UPDATE stock_batches SET remaining_grams=remaining_grams-$2::numeric WHERE id=$1`, allocation.id, FormatMilligramsToGrams(allocation.milligrams)); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, `INSERT INTO batch_consumptions(preparation_id,batch_id,item_id,quantity_grams,confirmed_by,operation_id)
				VALUES ($1,$2,$3,$4::numeric,$5,$6)`, id, allocation.id, itemID, FormatMilligramsToGrams(allocation.milligrams), actor, operation); err != nil {
				return preparationDBError(err)
			}
		}
		for item, amount := range required {
			if sums[item] != amount {
				return ErrValidation
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE preparations SET status='consumed',consumed_by=$2,consumed_at=clock_timestamp(),operation_id=$3 WHERE id=$1`, id, actor, operation); err != nil {
			return preparationDBError(err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO consumption_operations(operation_id,preparation_id,payload_sha256,confirmed_by)
			VALUES ($1,$2,$3,$4)`, operation, id, fingerprint, actor); err != nil {
			return preparationDBError(err)
		}
		if err := s.writeAudit(ctx, tx, audit.Event{ActorID: actor, Action: "preparation.consumed", Object: audit.Object{Type: "preparation", ID: id}, ChangedFields: []string{"status"}}); err != nil {
			return err
		}
		result, err = preparationTx(ctx, tx, id)
		return err
	})
	return result, replay, err
}

func (s *Service) trace(ctx context.Context, actor, id string, batch bool) ([]TraceRow, error) {
	id, err := canonicalUUID(id, "recordId")
	if err != nil {
		return nil, err
	}
	var result []TraceRow
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if batch {
			if _, err := s.requireRole(ctx, tx, actor, "dispensary", "report_reader"); err != nil {
				return err
			}
		} else {
			if _, err := s.requireRole(ctx, tx, actor, "dispensary", "report_reader"); err != nil {
				if !errors.Is(err, ErrForbidden) {
					return err
				}
				if _, err := s.requireRole(ctx, tx, actor, "clinician"); err != nil {
					return err
				}
				var assignmentID string
				if err := tx.QueryRow(ctx, `SELECT id::text FROM patient_clinician_assignments
					WHERE patient_id=$1 AND clinician_id=$2 AND revoked_at IS NULL FOR SHARE`, id, actor).Scan(&assignmentID); errors.Is(err, pgx.ErrNoRows) {
					return ErrForbidden
				} else if err != nil {
					return err
				}
			}
		}
		query := `SELECT p.patient_id::text,pt.display_name,p.session_id::text,p.id::text,c.batch_id::text,b.batch_reference,
			c.quantity_grams::text,c.confirmed_by::text,c.confirmed_at FROM batch_consumptions c
			JOIN preparations p ON p.id=c.preparation_id JOIN stock_batches b ON b.id=c.batch_id
			JOIN patients pt ON pt.id=p.patient_id WHERE `
		if batch {
			query += `c.batch_id=$1`
		} else {
			query += `p.patient_id=$1`
		}
		query += ` ORDER BY c.confirmed_at DESC,p.id LIMIT 100`
		rows, err := tx.Query(ctx, query, id)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var item TraceRow
			if err := rows.Scan(&item.PatientID, &item.PatientDisplayName, &item.SessionID, &item.PreparationID,
				&item.BatchID, &item.BatchReference, &item.QuantityGrams, &item.ConfirmedBy, &item.ConfirmedAt); err != nil {
				return err
			}
			result = append(result, item)
		}
		return rows.Err()
	})
	return result, err
}

func (s *Service) TraceBatch(ctx context.Context, actor, id string) ([]TraceRow, error) {
	return s.trace(ctx, actor, id, true)
}
func (s *Service) TracePatient(ctx context.Context, actor, id string) ([]TraceRow, error) {
	return s.trace(ctx, actor, id, false)
}
