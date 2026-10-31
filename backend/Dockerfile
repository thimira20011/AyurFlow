FROM golang:1.27.3-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /out/api ./cmd/api \
    && CGO_ENABLED=0 go build -trimpath -o /out/migrate ./cmd/migrate \
    && CGO_ENABLED=0 go build -trimpath -o /out/seedstaff ./cmd/seedstaff

FROM alpine:3.22.6
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S app && adduser -S app -G app
COPY --from=build /out/api /usr/local/bin/api
COPY --from=build /out/migrate /usr/local/bin/migrate
COPY --from=build /out/seedstaff /usr/local/bin/seedstaff
USER app
EXPOSE 8080
ENTRYPOINT ["api"]
