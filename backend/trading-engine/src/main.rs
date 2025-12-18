use anyhow::Result;
use tracing::{info, Level};
use tracing_subscriber;

mod engine;
mod order;
mod orderbook;
mod matching;
mod position;
mod risk;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("Starting QuantumTrade 2030 Trading Engine");

    // Initialize trading engine
    let engine = engine::TradingEngine::new().await?;

    // Start engine
    engine.start().await?;

    info!("Trading Engine started successfully");

    // Keep running
    tokio::signal::ctrl_c().await?;
    info!("Shutting down Trading Engine");

    Ok(())
}
