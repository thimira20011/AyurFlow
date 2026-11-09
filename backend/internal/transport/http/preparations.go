package http

import (
	"context"
	"net/http"

	"ayurflow/backend/internal/inventory"

	"github.com/gin-gonic/gin"
)

type PreparationService interface {
	CreateRecipe(context.Context, string, inventory.RecipeRequest) (inventory.Recipe, error)
	UpdateRecipe(context.Context, string, string, inventory.RecipeRequest) (inventory.Recipe, error)
	ListRecipes(context.Context, string) ([]inventory.Recipe, error)
	GetRecipe(context.Context, string, string) (inventory.Recipe, error)
	SavePreparation(context.Context, string, inventory.SavePreparationRequest) (inventory.Preparation, error)
	ListPreparations(context.Context, string, string) ([]inventory.Preparation, error)
	GetPreparation(context.Context, string, string) (inventory.Preparation, error)
	ConfirmConsumption(context.Context, string, string, inventory.ConfirmConsumptionRequest) (inventory.Preparation, bool, error)
	TraceBatch(context.Context, string, string) ([]inventory.TraceRow, error)
	TracePatient(context.Context, string, string) ([]inventory.TraceRow, error)
}

func registerPreparations(group *gin.RouterGroup, service PreparationService) {
	group.POST("/recipes", func(c *gin.Context) {
		var req inventory.RecipeRequest
		if !inventoryJSON(c, &req) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid recipe request."))
			return
		}
		item, err := service.CreateRecipe(c.Request.Context(), ActorID(c), req)
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusCreated, item)
	})
	group.GET("/recipes", func(c *gin.Context) {
		items, err := service.ListRecipes(c.Request.Context(), ActorID(c))
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	})
	group.GET("/recipes/:id", func(c *gin.Context) {
		item, err := service.GetRecipe(c.Request.Context(), ActorID(c), c.Param("id"))
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, item)
	})
	group.PATCH("/recipes/:id", func(c *gin.Context) {
		var req inventory.RecipeRequest
		if !inventoryJSON(c, &req) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid recipe update."))
			return
		}
		item, err := service.UpdateRecipe(c.Request.Context(), ActorID(c), c.Param("id"), req)
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, item)
	})
	group.POST("/preparations", func(c *gin.Context) {
		var req inventory.SavePreparationRequest
		if !inventoryJSON(c, &req) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid preparation request."))
			return
		}
		item, err := service.SavePreparation(c.Request.Context(), ActorID(c), req)
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusCreated, item)
	})
	group.GET("/preparations", func(c *gin.Context) {
		items, err := service.ListPreparations(c.Request.Context(), ActorID(c), c.Query("patientId"))
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	})
	group.GET("/preparations/:id", func(c *gin.Context) {
		item, err := service.GetPreparation(c.Request.Context(), ActorID(c), c.Param("id"))
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, item)
	})
	group.POST("/preparations/:id/confirm-consumption", func(c *gin.Context) {
		var req inventory.ConfirmConsumptionRequest
		if !inventoryJSON(c, &req) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid consumption request."))
			return
		}
		item, _, err := service.ConfirmConsumption(c.Request.Context(), ActorID(c), c.Param("id"), req)
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, item)
	})
	group.GET("/reports/inventory/traceability/batches/:id", func(c *gin.Context) {
		items, err := service.TraceBatch(c.Request.Context(), ActorID(c), c.Param("id"))
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	})
	group.GET("/reports/inventory/traceability/patients/:id", func(c *gin.Context) {
		items, err := service.TracePatient(c.Request.Context(), ActorID(c), c.Param("id"))
		if err != nil {
			inventoryError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	})
}
