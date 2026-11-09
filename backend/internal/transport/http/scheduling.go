package http

import (
	"context"
	"errors"
	"net/http"
	"time"

	"ayurflow/backend/internal/scheduling"

	"github.com/gin-gonic/gin"
)

type SchedulingService interface {
	CreateRoom(context.Context, string, string, string) (scheduling.Room, error)
	ListRooms(context.Context, string) ([]scheduling.Room, error)
	AddAvailability(context.Context, string, *string, *string, time.Time, time.Time) (scheduling.Availability, error)
	ChangeAvailability(context.Context, string, string, time.Time, time.Time) (scheduling.Availability, error)
	ListAvailability(context.Context, string, time.Time, time.Time) ([]scheduling.Availability, error)
	Book(context.Context, string, scheduling.BookRequest) (scheduling.Session, error)
	ListSessions(context.Context, string, time.Time, time.Time) ([]scheduling.Session, error)
	Reschedule(context.Context, string, string, scheduling.RescheduleRequest) (scheduling.Session, error)
	Start(context.Context, string, string) (scheduling.Session, error)
	Complete(context.Context, string, string, string) (scheduling.Session, error)
	Cancel(context.Context, string, string, string) (scheduling.Session, error)
}

func schedulingError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, scheduling.ErrForbidden), errors.Is(err, scheduling.ErrNotFound):
		c.JSON(http.StatusNotFound, failure("not_found", "The scheduling record is not available."))
	case errors.Is(err, scheduling.ErrValidation):
		c.JSON(http.StatusUnprocessableEntity, failure("validation_failed", "Check the scheduling details and try again."))
	case errors.Is(err, scheduling.ErrConflict):
		c.JSON(http.StatusConflict, failure("conflict", "The schedule or clinical clearance changed. Reload and try again."))
	default:
		c.JSON(http.StatusServiceUnavailable, failure("unavailable", "Scheduling is unavailable."))
	}
}

func scheduleWindow(c *gin.Context) (time.Time, time.Time, bool) {
	start, err1 := time.Parse(time.RFC3339, c.Query("start"))
	end, err2 := time.Parse(time.RFC3339, c.Query("end"))
	return start, end, err1 == nil && err2 == nil
}

func registerScheduling(group *gin.RouterGroup, service SchedulingService) {
	group.GET("/rooms", func(c *gin.Context) {
		items, err := service.ListRooms(c.Request.Context(), ActorID(c))
		if err != nil {
			schedulingError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	})
	group.POST("/rooms", func(c *gin.Context) {
		var input struct {
			Code string `json:"code"`
			Name string `json:"name"`
		}
		if !billingJSON(c, &input) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid room request."))
			return
		}
		item, err := service.CreateRoom(c.Request.Context(), ActorID(c), input.Code, input.Name)
		if err != nil {
			schedulingError(c, err)
			return
		}
		c.JSON(http.StatusCreated, item)
	})
	group.GET("/availability", func(c *gin.Context) {
		start, end, ok := scheduleWindow(c)
		if !ok {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Supply a valid start and end."))
			return
		}
		items, err := service.ListAvailability(c.Request.Context(), ActorID(c), start, end)
		if err != nil {
			schedulingError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	})
	group.POST("/availability", func(c *gin.Context) {
		var input struct {
			RoomID      *string   `json:"roomId"`
			TherapistID *string   `json:"therapistId"`
			StartsAt    time.Time `json:"startsAt"`
			EndsAt      time.Time `json:"endsAt"`
		}
		if !billingJSON(c, &input) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid availability request."))
			return
		}
		item, err := service.AddAvailability(c.Request.Context(), ActorID(c), input.RoomID, input.TherapistID, input.StartsAt, input.EndsAt)
		if err != nil {
			schedulingError(c, err)
			return
		}
		c.JSON(http.StatusCreated, item)
	})
	group.POST("/availability/:id/change", func(c *gin.Context) {
		var input struct {
			StartsAt time.Time `json:"startsAt"`
			EndsAt   time.Time `json:"endsAt"`
		}
		if !billingJSON(c, &input) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid availability change."))
			return
		}
		item, err := service.ChangeAvailability(c.Request.Context(), ActorID(c), c.Param("id"), input.StartsAt, input.EndsAt)
		if err != nil {
			schedulingError(c, err)
			return
		}
		c.JSON(http.StatusOK, item)
	})
	group.GET("/sessions", func(c *gin.Context) {
		start, end, ok := scheduleWindow(c)
		if !ok {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Supply a valid start and end."))
			return
		}
		items, err := service.ListSessions(c.Request.Context(), ActorID(c), start, end)
		if err != nil {
			schedulingError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	})
	group.POST("/sessions", func(c *gin.Context) {
		var input scheduling.BookRequest
		if !billingJSON(c, &input) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid booking request."))
			return
		}
		item, err := service.Book(c.Request.Context(), ActorID(c), input)
		if err != nil {
			schedulingError(c, err)
			return
		}
		c.JSON(http.StatusCreated, item)
	})
	group.POST("/sessions/:id/reschedule", func(c *gin.Context) {
		var input scheduling.RescheduleRequest
		if !billingJSON(c, &input) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid reschedule request."))
			return
		}
		item, err := service.Reschedule(c.Request.Context(), ActorID(c), c.Param("id"), input)
		if err != nil {
			schedulingError(c, err)
			return
		}
		c.JSON(http.StatusOK, item)
	})
	group.POST("/sessions/:id/start", func(c *gin.Context) {
		item, err := service.Start(c.Request.Context(), ActorID(c), c.Param("id"))
		if err != nil {
			schedulingError(c, err)
			return
		}
		c.JSON(http.StatusOK, item)
	})
	group.POST("/sessions/:id/complete", func(c *gin.Context) {
		var input struct {
			Observations string `json:"observations"`
		}
		if !billingJSON(c, &input) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid completion request."))
			return
		}
		item, err := service.Complete(c.Request.Context(), ActorID(c), c.Param("id"), input.Observations)
		if err != nil {
			schedulingError(c, err)
			return
		}
		c.JSON(http.StatusOK, item)
	})
	group.POST("/sessions/:id/cancel", func(c *gin.Context) {
		var input struct {
			Reason string `json:"reason"`
		}
		if !billingJSON(c, &input) {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid cancellation request."))
			return
		}
		item, err := service.Cancel(c.Request.Context(), ActorID(c), c.Param("id"), input.Reason)
		if err != nil {
			schedulingError(c, err)
			return
		}
		c.JSON(http.StatusOK, item)
	})
}
