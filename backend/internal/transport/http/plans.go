package http

import (
	"context"
	"errors"
	"net/http"

	"ayurflow/backend/internal/clinical"

	"github.com/gin-gonic/gin"
)

type PlanService interface {
	Create(context.Context, string, string, string) (clinical.Plan, error)
	List(context.Context, string, string) ([]clinical.Plan, error)
	Get(context.Context, string, string) (clinical.Detail, error)
	Start(context.Context, string, string, int64) (clinical.Plan, error)
	Approve(context.Context, string, string, string, int64, []string) (clinical.Plan, error)
	Advance(context.Context, string, string, int64) (clinical.Plan, error)
	Hold(context.Context, string, string, int64, string) (clinical.Plan, error)
	Resume(context.Context, string, string, int64, string) (clinical.Plan, error)
	Cancel(context.Context, string, string, int64, string) (clinical.Plan, error)
}

func registerPlans(group *gin.RouterGroup, service PlanService) {
	group.GET("/patients/:id/plans", func(c *gin.Context) {
		items, err := service.List(c.Request.Context(), ActorID(c), c.Param("id"))
		if err != nil {
			planError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	})
	group.POST("/patients/:id/plans", func(c *gin.Context) {
		var input *struct {
			SourceConsultationID string `json:"sourceConsultationId"`
		}
		if !consultationJSON(c, &input) || input == nil {
			badConsultationRequest(c)
			return
		}
		plan, err := service.Create(c.Request.Context(), ActorID(c), c.Param("id"), input.SourceConsultationID)
		if err != nil {
			planError(c, err)
			return
		}
		c.JSON(http.StatusCreated, plan)
	})
	group.GET("/plans/:id", func(c *gin.Context) {
		plan, err := service.Get(c.Request.Context(), ActorID(c), c.Param("id"))
		if err != nil {
			planError(c, err)
			return
		}
		c.JSON(http.StatusOK, plan)
	})
	group.POST("/plans/:id/start", func(c *gin.Context) {
		var input *struct {
			Version int64 `json:"version"`
		}
		if !consultationJSON(c, &input) || input == nil {
			badConsultationRequest(c)
			return
		}
		plan, err := service.Start(c.Request.Context(), ActorID(c), c.Param("id"), input.Version)
		if err != nil {
			planError(c, err)
			return
		}
		c.JSON(http.StatusOK, plan)
	})
	group.POST("/plans/:id/stages/:stageId/approve", func(c *gin.Context) {
		var input *struct {
			Version         int64    `json:"version"`
			ConfirmedChecks []string `json:"confirmedChecks"`
		}
		if !consultationJSON(c, &input) || input == nil {
			badConsultationRequest(c)
			return
		}
		plan, err := service.Approve(c.Request.Context(), ActorID(c), c.Param("id"), c.Param("stageId"),
			input.Version, input.ConfirmedChecks)
		if err != nil {
			planError(c, err)
			return
		}
		c.JSON(http.StatusOK, plan)
	})
	group.POST("/plans/:id/advance", func(c *gin.Context) {
		var input *struct {
			Version int64 `json:"version"`
		}
		if !consultationJSON(c, &input) || input == nil {
			badConsultationRequest(c)
			return
		}
		plan, err := service.Advance(c.Request.Context(), ActorID(c), c.Param("id"), input.Version)
		if err != nil {
			planError(c, err)
			return
		}
		c.JSON(http.StatusOK, plan)
	})
	for _, operation := range []struct {
		path string
		call func(context.Context, string, string, int64, string) (clinical.Plan, error)
	}{
		{"hold", service.Hold}, {"resume", service.Resume}, {"cancel", service.Cancel},
	} {
		group.POST("/plans/:id/"+operation.path, func(c *gin.Context) {
			var input *struct {
				Version int64  `json:"version"`
				Reason  string `json:"reason"`
			}
			if !consultationJSON(c, &input) || input == nil {
				badConsultationRequest(c)
				return
			}
			plan, err := operation.call(c.Request.Context(), ActorID(c), c.Param("id"), input.Version, input.Reason)
			if err != nil {
				planError(c, err)
				return
			}
			c.JSON(http.StatusOK, plan)
		})
	}
}

func planError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, clinical.ErrForbidden), errors.Is(err, clinical.ErrNotFound):
		c.JSON(http.StatusNotFound, failure("not_found", "The requested resource was not found."))
	case errors.Is(err, clinical.ErrConflict), errors.Is(err, clinical.ErrCompletionPending):
		c.JSON(http.StatusConflict, failure("conflict", "The plan state or completion evidence is not ready."))
	case errors.Is(err, clinical.ErrInvalidPathway):
		c.JSON(http.StatusUnprocessableEntity, failure("validation_failed", "The pathway is unavailable."))
	default:
		c.JSON(http.StatusServiceUnavailable, failure("unavailable", "The plan action could not be completed."))
	}
}
