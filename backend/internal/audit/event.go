package audit

import (
	"errors"
	"regexp"

	"github.com/jackc/pgx/v5/pgtype"
)

var (
	ErrInvalidEvent        = errors.New("invalid audit event")
	ErrTransactionRequired = errors.New("audit requires a business transaction")
	ErrForbidden           = errors.New("audit access denied")
	ErrInvalidQuery        = errors.New("invalid audit query")
)

var (
	codePattern   = regexp.MustCompile(`^[a-z][a-z0-9_]{0,63}$`)
	actionPattern = regexp.MustCompile(`^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*)+$`)
	objectPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$`)
)

// Event contains metadata only. ActorID comes from the authenticated server
// principal. Codes and field names come from module constants, never request text.
// Detailed reasons remain in the protected business record identified by Object.
type Event struct {
	ActorID       string
	Action        string
	Object        Object
	ReasonCode    string
	ChangedFields []string
}

type Object struct {
	Type string
	ID   string
}

func (e Event) validate() error {
	validAction := len(e.Action) <= 96 && actionPattern.MatchString(e.Action)
	validReason := e.ReasonCode == "" || codePattern.MatchString(e.ReasonCode)
	if !validUUID(e.ActorID) || !validAction || !validReason {
		return ErrInvalidEvent
	}
	if !e.Object.valid() || len(e.ChangedFields) > 32 {
		return ErrInvalidEvent
	}
	seen := make(map[string]bool, len(e.ChangedFields))
	for _, field := range e.ChangedFields {
		if !codePattern.MatchString(field) || seen[field] {
			return ErrInvalidEvent
		}
		seen[field] = true
	}
	return nil
}

func (o Object) valid() bool {
	return codePattern.MatchString(o.Type) && objectPattern.MatchString(o.ID)
}

func validUUID(value string) bool {
	var id pgtype.UUID
	return id.Scan(value) == nil && id.Valid && id.Bytes != [16]byte{}
}
