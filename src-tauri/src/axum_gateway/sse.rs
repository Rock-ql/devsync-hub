use axum::{Router, routing::get, response::sse::{Event, Sse}};
use futures::stream::Stream;
use std::convert::Infallible;
use tokio_stream::StreamExt;

pub fn sse_routes() -> Router {
    Router::new().route("/events", get(sse_handler))
}

async fn sse_handler() -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let stream = tokio_stream::wrappers::IntervalStream::new(tokio::time::interval(std::time::Duration::from_secs(30)))
        .map(|_| {
            Ok(Event::default()
                .event("heartbeat")
                .data("ping"))
        });

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(std::time::Duration::from_secs(15))
            .text("keep-alive"),
    )
}
