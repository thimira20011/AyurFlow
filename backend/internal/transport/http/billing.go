package http

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strconv"

	"ayurflow/backend/internal/billing"

	"github.com/gin-gonic/gin"
)

type BillingService interface {
	CreateInvoice(ctx context.Context, actorID string, req billing.CreateInvoiceRequest) (billing.Invoice, error)
	GetInvoice(ctx context.Context, actorID, invoiceID string) (billing.Invoice, error)
	ListInvoicesForPatient(ctx context.Context, actorID, patientID string, limit int, afterID string) (billing.InvoicePage, error)
	AddItem(ctx context.Context, actorID, invoiceID string, req billing.AddItemRequest) (billing.InvoiceItem, error)
	RemoveItem(ctx context.Context, actorID, invoiceID, itemID string) error
	IssueInvoice(ctx context.Context, actorID, invoiceID string) (billing.Invoice, error)
	VoidInvoice(ctx context.Context, actorID, invoiceID string) error
	PostReceipt(ctx context.Context, actorID, invoiceID string, req billing.PostReceiptRequest) (billing.Receipt, error)
	GetBalance(ctx context.Context, actorID, invoiceID string) (billing.InvoiceBalance, error)
	ListReceipts(ctx context.Context, actorID, invoiceID string) ([]billing.Receipt, error)
	OutstandingReport(ctx context.Context, actorID string) (billing.OutstandingReport, error)
}

func registerBilling(group *gin.RouterGroup, service BillingService) {
	group.POST("/invoices", func(c *gin.Context) {
		var req billing.CreateInvoiceRequest
		if !billingJSON(c, &req) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid invoice request."))
			return
		}
		inv, err := service.CreateInvoice(c.Request.Context(), ActorID(c), req)
		if err != nil {
			billingError(c, err)
			return
		}
		c.JSON(http.StatusCreated, inv)
	})

	group.GET("/invoices", func(c *gin.Context) {
		patientID := c.Query("patientId")
		limit, _ := strconv.Atoi(c.Query("limit"))
		after := c.Query("after")
		page, err := service.ListInvoicesForPatient(c.Request.Context(), ActorID(c), patientID, limit, after)
		if err != nil {
			billingError(c, err)
			return
		}
		c.JSON(http.StatusOK, page)
	})

	group.GET("/invoices/:id", func(c *gin.Context) {
		inv, err := service.GetInvoice(c.Request.Context(), ActorID(c), c.Param("id"))
		if err != nil {
			billingError(c, err)
			return
		}
		c.JSON(http.StatusOK, inv)
	})

	group.POST("/invoices/:id/items", func(c *gin.Context) {
		var req billing.AddItemRequest
		if !billingJSON(c, &req) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid item request."))
			return
		}
		item, err := service.AddItem(c.Request.Context(), ActorID(c), c.Param("id"), req)
		if err != nil {
			billingError(c, err)
			return
		}
		c.JSON(http.StatusCreated, item)
	})

	group.DELETE("/invoices/:id/items/:itemId", func(c *gin.Context) {
		err := service.RemoveItem(c.Request.Context(), ActorID(c), c.Param("id"), c.Param("itemId"))
		if err != nil {
			billingError(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	})

	group.POST("/invoices/:id/issue", func(c *gin.Context) {
		inv, err := service.IssueInvoice(c.Request.Context(), ActorID(c), c.Param("id"))
		if err != nil {
			billingError(c, err)
			return
		}
		c.JSON(http.StatusOK, inv)
	})

	group.POST("/invoices/:id/void", func(c *gin.Context) {
		err := service.VoidInvoice(c.Request.Context(), ActorID(c), c.Param("id"))
		if err != nil {
			billingError(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	})

	group.POST("/invoices/:id/receipts", func(c *gin.Context) {
		var req billing.PostReceiptRequest
		if !billingJSON(c, &req) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid receipt request."))
			return
		}
		rec, err := service.PostReceipt(c.Request.Context(), ActorID(c), c.Param("id"), req)
		if err != nil {
			billingError(c, err)
			return
		}
		c.JSON(http.StatusCreated, rec)
	})

	group.GET("/invoices/:id/receipts", func(c *gin.Context) {
		receipts, err := service.ListReceipts(c.Request.Context(), ActorID(c), c.Param("id"))
		if err != nil {
			billingError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": receipts})
	})

	group.GET("/invoices/:id/balance", func(c *gin.Context) {
		bal, err := service.GetBalance(c.Request.Context(), ActorID(c), c.Param("id"))
		if err != nil {
			billingError(c, err)
			return
		}
		c.JSON(http.StatusOK, bal)
	})

	group.GET("/reports/billing/outstanding", func(c *gin.Context) {
		report, err := service.OutstandingReport(c.Request.Context(), ActorID(c))
		if err != nil {
			billingError(c, err)
			return
		}
		c.JSON(http.StatusOK, report)
	})
}

func billingJSON(c *gin.Context, value any) bool {
	mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return false
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16*1024)
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if decoder.Decode(value) != nil {
		return false
	}
	return decoder.Decode(new(any)) == io.EOF
}

func billingError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, billing.ErrForbidden):
		c.JSON(http.StatusForbidden, failure("forbidden", "Billing access is not permitted."))
	case errors.Is(err, billing.ErrNotFound):
		c.JSON(http.StatusNotFound, failure("not_found", "The requested billing resource was not found."))
	case errors.Is(err, billing.ErrValidation):
		c.JSON(http.StatusUnprocessableEntity, failure("validation_failed", err.Error()))
	case errors.Is(err, billing.ErrConflict):
		c.JSON(http.StatusConflict, failure("conflict", err.Error()))
	default:
		c.JSON(http.StatusServiceUnavailable, failure("unavailable", "Billing service is unavailable."))
	}
}
