package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"
)

type MarketDataService struct {
	redis         *redis.Client
	kafkaWriter   *kafka.Writer
	exchangeConns map[string]*websocket.Conn
	mu            sync.RWMutex
	ctx           context.Context
	cancel        context.CancelFunc
}

type Ticker struct {
	Symbol    string  `json:"symbol"`
	Price     float64 `json:"price"`
	Change24h float64 `json:"change_24h"`
	Volume24h float64 `json:"volume_24h"`
	High24h   float64 `json:"high_24h"`
	Low24h    float64 `json:"low_24h"`
	Timestamp int64   `json:"timestamp"`
}

type OrderBook struct {
	Symbol    string      `json:"symbol"`
	Bids      [][]float64 `json:"bids"`
	Asks      [][]float64 `json:"asks"`
	Timestamp int64       `json:"timestamp"`
}

type Trade struct {
	Symbol    string  `json:"symbol"`
	Price     float64 `json:"price"`
	Quantity  float64 `json:"quantity"`
	Side      string  `json:"side"`
	Timestamp int64   `json:"timestamp"`
}

func NewMarketDataService() *MarketDataService {
	ctx, cancel := context.WithCancel(context.Background())

	// Initialize Redis
	redisClient := redis.NewClient(&redis.Options{
		Addr:     getEnv("REDIS_URL", "localhost:6379"),
		Password: "",
		DB:       0,
	})

	// Initialize Kafka writer
	kafkaWriter := &kafka.Writer{
		Addr:     kafka.TCP(getEnv("KAFKA_BROKERS", "localhost:9092")),
		Topic:    "market-data",
		Balancer: &kafka.LeastBytes{},
	}

	return &MarketDataService{
		redis:         redisClient,
		kafkaWriter:   kafkaWriter,
		exchangeConns: make(map[string]*websocket.Conn),
		ctx:           ctx,
		cancel:        cancel,
	}
}

func (s *MarketDataService) Start() error {
	log.Println("Starting Market Data Service...")

	// Connect to exchanges
	go s.connectToBinance()
	go s.connectToCoinbase()
	go s.connectToKraken()

	// Start HTTP server
	router := s.setupRoutes()
	server := &http.Server{
		Addr:         ":8081",
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Market Data Service listening on :8081")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down Market Data Service...")

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	s.cancel()
	
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	s.cleanup()

	return nil
}

func (s *MarketDataService) setupRoutes() *mux.Router {
	router := mux.NewRouter()

	// Health check
	router.HandleFunc("/health", s.healthCheck).Methods("GET")

	// Market data endpoints
	router.HandleFunc("/ticker/{symbol}", s.getTicker).Methods("GET")
	router.HandleFunc("/orderbook/{symbol}", s.getOrderbook).Methods("GET")
	router.HandleFunc("/trades/{symbol}", s.getTrades).Methods("GET")
	router.HandleFunc("/candles/{symbol}", s.getCandles).Methods("GET")

	return router
}

func (s *MarketDataService) healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().Unix(),
		"exchanges": len(s.exchangeConns),
	})
}

func (s *MarketDataService) getTicker(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	symbol := vars["symbol"]

	// Try to get from cache first
	cached, err := s.redis.Get(s.ctx, fmt.Sprintf("ticker:%s", symbol)).Result()
	if err == nil {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(cached))
		return
	}

	// Fetch from exchange if not in cache
	ticker, err := s.fetchTickerFromExchange(symbol)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Cache for 1 second
	data, _ := json.Marshal(ticker)
	s.redis.Set(s.ctx, fmt.Sprintf("ticker:%s", symbol), data, 1*time.Second)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ticker)
}

func (s *MarketDataService) getOrderbook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	symbol := vars["symbol"]

	// Try cache first
	cached, err := s.redis.Get(s.ctx, fmt.Sprintf("orderbook:%s", symbol)).Result()
	if err == nil {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(cached))
		return
	}

	// Fetch from exchange
	orderbook, err := s.fetchOrderbookFromExchange(symbol)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Cache for 500ms
	data, _ := json.Marshal(orderbook)
	s.redis.Set(s.ctx, fmt.Sprintf("orderbook:%s", symbol), data, 500*time.Millisecond)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orderbook)
}

func (s *MarketDataService) getTrades(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	symbol := vars["symbol"]

	// Get recent trades from cache
	trades, err := s.redis.LRange(s.ctx, fmt.Sprintf("trades:%s", symbol), 0, 99).Result()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(trades)
}

func (s *MarketDataService) getCandles(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	symbol := vars["symbol"]
	interval := r.URL.Query().Get("interval")
	
	if interval == "" {
		interval = "1m"
	}

	// Fetch candles from database or cache
	// Implementation would query TimescaleDB
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"symbol":   symbol,
		"interval": interval,
		"candles":  []interface{}{},
	})
}

func (s *MarketDataService) connectToBinance() {
	log.Println("Connecting to Binance WebSocket...")

	url := "wss://stream.binance.com:9443/ws/btcusdt@ticker/ethusdt@ticker"
	
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		log.Printf("Binance connection error: %v", err)
		return
	}

	s.mu.Lock()
	s.exchangeConns["binance"] = conn
	s.mu.Unlock()

	log.Println("Connected to Binance")

	// Read messages
	for {
		select {
		case <-s.ctx.Done():
			return
		default:
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("Binance read error: %v", err)
				return
			}

			s.processBinanceMessage(message)
		}
	}
}

func (s *MarketDataService) connectToCoinbase() {
	log.Println("Connecting to Coinbase WebSocket...")

	url := "wss://ws-feed.exchange.coinbase.com"
	
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		log.Printf("Coinbase connection error: %v", err)
		return
	}

	// Subscribe to channels
	subscribe := map[string]interface{}{
		"type": "subscribe",
		"channels": []map[string]interface{}{
			{"name": "ticker", "product_ids": []string{"BTC-USD", "ETH-USD"}},
		},
	}

	if err := conn.WriteJSON(subscribe); err != nil {
		log.Printf("Coinbase subscribe error: %v", err)
		return
	}

	s.mu.Lock()
	s.exchangeConns["coinbase"] = conn
	s.mu.Unlock()

	log.Println("Connected to Coinbase")

	// Read messages
	for {
		select {
		case <-s.ctx.Done():
			return
		default:
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("Coinbase read error: %v", err)
				return
			}

			s.processCoinbaseMessage(message)
		}
	}
}

func (s *MarketDataService) connectToKraken() {
	log.Println("Connecting to Kraken WebSocket...")
	// Similar implementation
}

func (s *MarketDataService) processBinanceMessage(message []byte) {
	var data map[string]interface{}
	if err := json.Unmarshal(message, &data); err != nil {
		return
	}

	// Extract ticker data
	symbol := data["s"].(string)
	price := parseFloat(data["c"])
	
	ticker := Ticker{
		Symbol:    symbol,
		Price:     price,
		Change24h: parseFloat(data["P"]),
		Volume24h: parseFloat(data["v"]),
		High24h:   parseFloat(data["h"]),
		Low24h:    parseFloat(data["l"]),
		Timestamp: time.Now().Unix(),
	}

	// Cache ticker
	tickerJSON, _ := json.Marshal(ticker)
	s.redis.Set(s.ctx, fmt.Sprintf("ticker:%s", symbol), tickerJSON, 1*time.Second)

	// Publish to Kafka
	s.publishToKafka("market-data", ticker)
}

func (s *MarketDataService) processCoinbaseMessage(message []byte) {
	// Similar to Binance processing
}

func (s *MarketDataService) publishToKafka(topic string, data interface{}) {
	msg, err := json.Marshal(data)
	if err != nil {
		log.Printf("JSON marshal error: %v", err)
		return
	}

	err = s.kafkaWriter.WriteMessages(s.ctx, kafka.Message{
		Value: msg,
		Time:  time.Now(),
	})

	if err != nil {
		log.Printf("Kafka write error: %v", err)
	}
}

func (s *MarketDataService) fetchTickerFromExchange(symbol string) (*Ticker, error) {
	// Fetch from primary exchange
	return &Ticker{
		Symbol:    symbol,
		Price:     50000.0,
		Change24h: 2.5,
		Volume24h: 1000000000,
		High24h:   51000,
		Low24h:    49000,
		Timestamp: time.Now().Unix(),
	}, nil
}

func (s *MarketDataService) fetchOrderbookFromExchange(symbol string) (*OrderBook, error) {
	// Fetch from exchange
	return &OrderBook{
		Symbol: symbol,
		Bids: [][]float64{
			{50000, 1.5},
			{49900, 2.0},
			{49800, 3.5},
		},
		Asks: [][]float64{
			{50100, 1.2},
			{50200, 2.5},
			{50300, 3.0},
		},
		Timestamp: time.Now().Unix(),
	}, nil
}

func (s *MarketDataService) cleanup() {
	log.Println("Cleaning up connections...")

	s.mu.Lock()
	defer s.mu.Unlock()

	for name, conn := range s.exchangeConns {
		conn.Close()
		log.Printf("Closed %s connection", name)
	}

	s.kafkaWriter.Close()
	s.redis.Close()
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func parseFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case string:
		var f float64
		fmt.Sscanf(val, "%f", &f)
		return f
	default:
		return 0
	}
}

func main() {
	service := NewMarketDataService()
	
	if err := service.Start(); err != nil {
		log.Fatalf("Service error: %v", err)
	}
}
