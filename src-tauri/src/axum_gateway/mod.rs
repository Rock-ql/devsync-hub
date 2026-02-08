pub mod routes;
pub mod sse;

use axum::Router;
use tower_http::cors::{CorsLayer, Any};
use std::net::SocketAddr;

pub async fn start_gateway(_app_handle: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .merge(routes::health_routes())
        .merge(sse::sse_routes())
        .layer(cors);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3721));
    log::info!("Axum gateway listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
