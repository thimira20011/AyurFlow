package audit

import (
	"context"
	"errors"
	"testing"
)

type readAuthorizerFunc func(context.Context, string, Object) error

func (f readAuthorizerFunc) AuthorizeAuditRead(ctx context.Context, actor string, object Object) error {
	return f(ctx, actor, object)
}

func TestReaderDeniesAccessWithoutExplicitAuthorization(t *testing.T) {
	t.Parallel()
	query := Query{Object: validEvent().Object}
	denied := readAuthorizerFunc(func(context.Context, string, Object) error {
		return errors.New("private authorization detail")
	})
	for _, tc := range []struct {
		name       string
		authorizer ReadAuthorizer
		requester  string
	}{
		{name: "no adapter", requester: syntheticActor},
		{name: "unauthenticated", authorizer: denied},
		{name: "explicit denial", requester: syntheticActor, authorizer: denied},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// A nil pool proves forbidden requests cannot reach database reads.
			reader := NewReader(nil, tc.authorizer)
			if _, err := reader.List(t.Context(), tc.requester, query); !errors.Is(err, ErrForbidden) {
				t.Fatalf("unauthorized read: %v", err)
			}
		})
	}
}

func TestReaderRequiresObjectScopeAndBoundedPages(t *testing.T) {
	t.Parallel()
	allow := readAuthorizerFunc(func(context.Context, string, Object) error { return nil })
	reader := NewReader(nil, allow)
	for _, tc := range []struct {
		name  string
		query Query
	}{
		{name: "unscoped read", query: Query{}},
		{name: "unbounded page", query: Query{Object: validEvent().Object, Limit: 101}},
		{name: "negative cursor", query: Query{Object: validEvent().Object, BeforeID: -1}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := reader.List(t.Context(), syntheticActor, tc.query); !errors.Is(err, ErrInvalidQuery) {
				t.Fatalf("invalid query: %v", err)
			}
		})
	}
}
