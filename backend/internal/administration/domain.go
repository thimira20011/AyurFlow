package administration

import (
	"errors"
	"time"
)

var (
	ErrForbidden = errors.New("administration: access denied")
	ErrInvalid   = errors.New("administration: invalid input")
	ErrConflict  = errors.New("administration: conflict")
	ErrNotFound  = errors.New("administration: not found")
)

type Staff struct {
	ID              string    `json:"id"`
	LoginIdentifier string    `json:"loginIdentifier"`
	Active          bool      `json:"active"`
	Roles           []string  `json:"roles"`
	CreatedAt       time.Time `json:"createdAt"`
}

type Role struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type Page struct {
	Items      []Staff `json:"items"`
	Roles      []Role  `json:"roles"`
	NextCursor string  `json:"nextCursor,omitempty"`
}

type CreateInput struct {
	LoginIdentifier string   `json:"loginIdentifier"`
	Password        string   `json:"password"`
	Roles           []string `json:"roles"`
}
