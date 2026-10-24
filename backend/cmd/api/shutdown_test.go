package main

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestShutdownDrainsActiveRequestDuringGrace(t *testing.T) {
	requests, cancelRequests := context.WithCancel(t.Context())
	started := make(chan struct{})
	shutdownStarted := make(chan struct{})
	release := make(chan struct{})
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		select {
		case <-release:
			w.WriteHeader(http.StatusNoContent)
		case <-r.Context().Done():
			w.WriteHeader(http.StatusServiceUnavailable)
		}
	}))
	server.Config.BaseContext = func(net.Listener) context.Context { return requests }
	server.Config.RegisterOnShutdown(func() { close(shutdownStarted) })
	server.Start()
	t.Cleanup(server.Close)
	t.Cleanup(cancelRequests)
	clientDone := make(chan error, 1)
	go func() { clientDone <- performRequest(server) }()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("handler did not start")
	}
	shutdown, cancel := context.WithTimeout(t.Context(), time.Second)
	defer cancel()
	shutdownDone := make(chan error, 1)
	go func() { shutdownDone <- shutdownServer(shutdown, server.Config, cancelRequests) }()
	select {
	case <-shutdownStarted:
	case <-shutdown.Done():
		t.Fatal("shutdown did not start")
	}
	if requests.Err() != nil {
		t.Fatal("graceful shutdown canceled the active handler before its grace expired")
	}
	close(release)
	if err := <-shutdownDone; err != nil {
		t.Fatalf("graceful shutdown failed: %v", err)
	}
	if err := <-clientDone; err != nil {
		t.Fatalf("active request did not drain: %v", err)
	}
}

func TestShutdownCancelsStalledRequestAfterGrace(t *testing.T) {
	requests, cancelRequests := context.WithCancel(t.Context())
	started := make(chan struct{})
	exited := make(chan struct{})
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		close(started)
		<-r.Context().Done()
		close(exited)
	}))
	server.Config.BaseContext = func(net.Listener) context.Context { return requests }
	server.Start()
	t.Cleanup(server.Close)
	t.Cleanup(cancelRequests)
	clientDone := make(chan error, 1)
	go func() { clientDone <- performRequest(server) }()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("handler did not start")
	}
	shutdown, cancel := context.WithTimeout(t.Context(), 10*time.Millisecond)
	defer cancel()
	if err := shutdownServer(shutdown, server.Config, cancelRequests); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected grace deadline failure: %v", err)
	}
	select {
	case <-exited:
	case <-time.After(time.Second):
		t.Fatal("stalled handler was not canceled after grace expired")
	}
	select {
	case <-clientDone:
	case <-time.After(time.Second):
		t.Fatal("request client did not exit after server close")
	}
}

func performRequest(server *httptest.Server) error {
	response, err := server.Client().Get(server.URL)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusNoContent {
		return errors.New("active request did not drain successfully")
	}
	_, err = io.Copy(io.Discard, response.Body)
	return err
}
