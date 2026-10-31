package http

import (
	"context"
	"errors"
	"net/http"

	"ayurflow/backend/internal/consultations"

	"github.com/gin-gonic/gin"
)

type ClinicalAssignmentService interface {
	Grant(context.Context, string, string, string) (string, error)
	Revoke(context.Context, string, string, string) error
}

func registerClinicalAssignments(group *gin.RouterGroup, service ClinicalAssignmentService) {
	group.POST("/patients/:id/clinical-assignments", func(c *gin.Context) {
		var input *struct {
			ClinicianID string `json:"clinicianId"`
		}
		if !consultationJSON(c, &input) || input == nil {
			badConsultationRequest(c)
			return
		}
		id, err := service.Grant(c.Request.Context(), ActorID(c), c.Param("id"), input.ClinicianID)
		if err != nil {
			assignmentError(c, err)
			return
		}
		c.JSON(http.StatusCreated, gin.H{"id": id})
	})
	group.DELETE("/patients/:id/clinical-assignments/:clinicianId", func(c *gin.Context) {
		if err := service.Revoke(c.Request.Context(), ActorID(c), c.Param("id"), c.Param("clinicianId")); err != nil {
			assignmentError(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	})
}

func assignmentError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, consultations.ErrForbidden):
		c.JSON(http.StatusForbidden, failure("forbidden", "This action is not permitted."))
	case errors.Is(err, consultations.ErrNotFound):
		c.JSON(http.StatusNotFound, failure("not_found", "The requested resource was not found."))
	case errors.Is(err, consultations.ErrAssignmentConflict):
		c.JSON(http.StatusConflict, failure("conflict", "The clinician is already assigned."))
	default:
		c.JSON(http.StatusServiceUnavailable, failure("unavailable", "The request could not be completed."))
	}
}
