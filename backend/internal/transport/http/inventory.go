package http

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strconv"

	"ayurflow/backend/internal/inventory"

	"github.com/gin-gonic/gin"
)

type InventoryService interface {
	CreateItem(ctx context.Context, actorID string, req inventory.CreateItemRequest) (inventory.BotanicalItem, error)
	DeactivateItem(ctx context.Context, actorID, itemID string, req inventory.DeactivateItemRequest) (inventory.BotanicalItem, error)
	ListItems(ctx context.Context, actorID string, activeOnly bool, limit int, cursor string) (inventory.BotanicalItemPage, error)
	ReceiveBatch(ctx context.Context, actorID string, req inventory.ReceiveBatchRequest) (inventory.StockBatch, error)
	BlockBatch(ctx context.Context, actorID, batchID string, req inventory.BlockBatchRequest) (inventory.StockBatch, error)
	ListBatches(ctx context.Context, actorID string, filter inventory.ListBatchesFilter) (inventory.StockBatchPage, error)
}

func registerInventory(group *gin.RouterGroup, service InventoryService) {
	inv := group.Group("/inventory")

	inv.POST("/items", func(c *gin.Context) {
		var req inventory.CreateItemRequest
		if !inventoryJSON(c, &req) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid botanical item request."))
			return
		}
		item, err := service.CreateItem(c.Request.Context(), ActorID(c), req)
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusCreated, item)
	})

	inv.GET("/items", func(c *gin.Context) {
		activeOnly := c.Query("activeOnly") == "true"
		limit, _ := strconv.Atoi(c.Query("limit"))
		cursor := c.Query("cursor")
		page, err := service.ListItems(c.Request.Context(), ActorID(c), activeOnly, limit, cursor)
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, page)
	})

	inv.POST("/items/:itemId/deactivate", func(c *gin.Context) {
		var req inventory.DeactivateItemRequest
		if !inventoryJSON(c, &req) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid item deactivation request."))
			return
		}
		item, err := service.DeactivateItem(c.Request.Context(), ActorID(c), c.Param("itemId"), req)
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, item)
	})

	inv.POST("/batches", func(c *gin.Context) {
		var req inventory.ReceiveBatchRequest
		if !inventoryJSON(c, &req) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid batch receipt request."))
			return
		}
		batch, err := service.ReceiveBatch(c.Request.Context(), ActorID(c), req)
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusCreated, batch)
	})

	inv.GET("/batches", func(c *gin.Context) {
		limit, _ := strconv.Atoi(c.Query("limit"))
		filter := inventory.ListBatchesFilter{
			ItemID:       c.Query("itemId"),
			EligibleOnly: c.Query("eligibleOnly") == "true",
			Limit:        limit,
			Cursor:       c.Query("cursor"),
		}
		page, err := service.ListBatches(c.Request.Context(), ActorID(c), filter)
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, page)
	})

	inv.POST("/batches/:batchId/block", func(c *gin.Context) {
		var req inventory.BlockBatchRequest
		if !inventoryJSON(c, &req) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid batch block request."))
			return
		}
		batch, err := service.BlockBatch(c.Request.Context(), ActorID(c), c.Param("batchId"), req)
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, batch)
	})
}

func inventoryJSON(c *gin.Context, target any) bool {
	mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return false
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16384)
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return false
	}
	var trailing any
	return errors.Is(decoder.Decode(&trailing), io.EOF)
}

func inventoryError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, inventory.ErrForbidden):
		c.JSON(http.StatusForbidden, failure("forbidden", "You do not have permission for this inventory action."))
	case errors.Is(err, inventory.ErrNotFound):
		c.JSON(http.StatusNotFound, failure("not_found", "The requested inventory record was not found."))
	case errors.Is(err, inventory.ErrConflict):
		c.JSON(http.StatusConflict, failure("conflict", "The inventory request conflicts with existing state."))
	case errors.Is(err, inventory.ErrValidation):
		c.JSON(http.StatusUnprocessableEntity, failure("unprocessable_entity", "The inventory request is invalid."))
	default:
		c.JSON(http.StatusServiceUnavailable, failure("unavailable", "Inventory service is unavailable."))
	}
}
