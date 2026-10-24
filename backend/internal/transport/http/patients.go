package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"

	"ayurflow/backend/internal/patients"

	"github.com/gin-gonic/gin"
)

type PatientService interface {
	Create(context.Context, string, patients.RegistrationInput) (patients.Patient, error)
	Get(context.Context, string, string) (patients.Patient, error)
	Search(context.Context, string, string) ([]patients.Patient, error)
	Update(context.Context, string, string, patients.UpdateInput) (patients.Patient, error)
}

func registerPatients(group *gin.RouterGroup, service PatientService) {
	group.POST("/patients", func(c *gin.Context) {
		var input *patients.RegistrationInput
		if !patientJSON(c, &input) || input == nil {
			badPatientRequest(c)
			return
		}
		patient, err := service.Create(c.Request.Context(), ActorID(c), *input)
		if err != nil {
			patientError(c, err, false)
			return
		}
		c.JSON(http.StatusCreated, patient)
	})
	group.GET("/patients", func(c *gin.Context) {
		items, err := service.Search(c.Request.Context(), ActorID(c), c.Query("q"))
		if err != nil {
			patientError(c, err, false)
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	})
	group.GET("/patients/:id", func(c *gin.Context) {
		patient, err := service.Get(c.Request.Context(), ActorID(c), c.Param("id"))
		if err != nil {
			patientError(c, err, true)
			return
		}
		c.JSON(http.StatusOK, patient)
	})
	group.PATCH("/patients/:id", func(c *gin.Context) {
		var wire struct {
			Version     int64           `json:"version"`
			DisplayName json.RawMessage `json:"displayName"`
			Phone       json.RawMessage `json:"phone"`
			Identity    json.RawMessage `json:"identity"`
		}
		if !patientJSON(c, &wire) {
			badPatientRequest(c)
			return
		}
		input := patients.UpdateInput{Version: wire.Version}
		if len(wire.DisplayName) > 0 {
			if strictJSON(wire.DisplayName, &input.DisplayName) != nil || input.DisplayName == nil {
				badPatientRequest(c)
				return
			}
		}
		if len(wire.Phone) > 0 {
			input.Phone.Set = true
			if strictJSON(wire.Phone, &input.Phone.Value) != nil {
				badPatientRequest(c)
				return
			}
		}
		if len(wire.Identity) > 0 {
			input.Identity.Set = true
			if strictJSON(wire.Identity, &input.Identity.Value) != nil {
				badPatientRequest(c)
				return
			}
		}
		patient, err := service.Update(c.Request.Context(), ActorID(c), c.Param("id"), input)
		if err != nil {
			patientError(c, err, true)
			return
		}
		c.JSON(http.StatusOK, patient)
	})
}

func patientJSON(c *gin.Context, value any) bool {
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

func strictJSON(data []byte, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func badPatientRequest(c *gin.Context) {
	c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid patient request."))
}

func patientError(c *gin.Context, err error, hideRecord bool) {
	switch {
	case errors.Is(err, patients.ErrNotFound), hideRecord && errors.Is(err, patients.ErrForbidden):
		c.JSON(http.StatusNotFound, failure("not_found", "The requested resource was not found."))
	case errors.Is(err, patients.ErrForbidden):
		c.JSON(http.StatusForbidden, failure("forbidden", "This action is not permitted."))
	case errors.Is(err, patients.ErrInvalidPatient):
		c.JSON(http.StatusUnprocessableEntity, failure("validation_failed", "Check the patient fields."))
	case errors.Is(err, patients.ErrDuplicateIdentity), errors.Is(err, patients.ErrStaleVersion):
		c.JSON(http.StatusConflict, failure("conflict", "This action conflicts with the current record state."))
	default:
		c.JSON(http.StatusServiceUnavailable, failure("unavailable", "The request could not be completed."))
	}
}
