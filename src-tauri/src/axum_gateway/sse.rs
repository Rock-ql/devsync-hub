use axum::{
    response::sse::{Event, KeepAlive, Sse},
    routing::get,
    Router,
};
use futures::stream::Stream;
use std::convert::Infallible;
use std::sync::OnceLock;
use tokio::sync::broadcast;
use tokio_stream::wrappers::{BroadcastStream, IntervalStream};
use tokio_stream::StreamExt;

#[derive(Debug, Clone)]
pub struct SseMessage {
    pub event: String,
    pub data: String,
}

static SSE_SENDER: OnceLock<broadcast::Sender<SseMessage>> = OnceLock::new();

fn sender() -> &'static broadcast::Sender<SseMessage> {
    SSE_SENDER.get_or_init(|| {
        let (tx, _rx) = broadcast::channel(256);
        tx
    })
}

pub fn publish(event: &str, data: &str) {
    let _ = sender().send(SseMessage {
        event: event.to_string(),
        data: data.to_string(),
    });
}

pub fn sse_routes() -> Router {
    Router::new().route("/events", get(sse_handler))
}

async fn sse_handler() -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let heartbeat_stream = IntervalStream::new(tokio::time::interval(std::time::Duration::from_secs(30)))
        .map(|_| Ok(Event::default().event("heartbeat").data("ping")));

    let rx = sender().subscribe();
    let broadcast_stream = BroadcastStream::new(rx).filter_map(|message| match message {
        Ok(payload) => Some(Ok(Event::default().event(payload.event).data(payload.data))),
        Err(_) => None,
    });

    let stream = futures::stream::select(heartbeat_stream, broadcast_stream);

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(std::time::Duration::from_secs(15))
            .text("keep-alive"),
    )
}
