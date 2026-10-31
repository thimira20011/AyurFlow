package http

import (
	"context"
	"errors"
	"net/http"

	"ayurflow/backend/internal/administration"

	"github.com/gin-gonic/gin"
)

type AdministrationService interface {
	List(context.Context, string, string) (administration.Page, error)
	Create(context.Context, string, administration.CreateInput) (administration.Staff, error)
	SetRoles(context.Context, string, string, []string) (administration.Staff, error)
	Disable(context.Context, string, string) error
}

func registerAdministration(group *gin.RouterGroup, service AdministrationService) {
	group.GET("/admin/staff", func(c *gin.Context) {
		page, err := service.List(c.Request.Context(), ActorID(c), c.Query("after"))
		if err != nil {
			administrationError(c, err)
			return
		}
		c.JSON(http.StatusOK, page)
	})
	group.POST("/admin/staff", func(c *gin.Context) {
		var input *administration.CreateInput
		if !patientJSON(c, &input) || input == nil {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid staff request."))
			return
		}
		staff, err := service.Create(c.Request.Context(), ActorID(c), *input)
		if err != nil {
			administrationError(c, err)
			return
		}
		c.JSON(http.StatusCreated, staff)
	})
	group.PUT("/admin/staff/:id/roles", func(c *gin.Context) {
		var input struct {
			Roles []string `json:"roles"`
		}
		if !patientJSON(c, &input) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid roles request."))
			return
		}
		staff, err := service.SetRoles(c.Request.Context(), ActorID(c), c.Param("id"), input.Roles)
		if err != nil {
			administrationError(c, err)
			return
		}
		c.JSON(http.StatusOK, staff)
	})
	group.POST("/admin/staff/:id/disable", func(c *gin.Context) {
		if err := service.Disable(c.Request.Context(), ActorID(c), c.Param("id")); err != nil {
			administrationError(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	})
}

func administrationError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, administration.ErrForbidden):
		c.JSON(http.StatusForbidden, failure("forbidden", "Staff administration is not permitted."))
	case errors.Is(err, administration.ErrInvalid):
		c.JSON(http.StatusUnprocessableEntity, failure("validation_failed", "Check the login identifier, password and roles."))
	case errors.Is(err, administration.ErrConflict):
		c.JSON(http.StatusConflict, failure("conflict", "The account conflicts with the request. Refresh the list; self-disable and removal of your administrator role are not allowed."))
	case errors.Is(err, administration.ErrNotFound):
		c.JSON(http.StatusNotFound, failure("not_found", "The staff account was not found."))
	default:
		c.JSON(http.StatusServiceUnavailable, failure("unavailable", "Staff administration is unavailable."))
	}
}
