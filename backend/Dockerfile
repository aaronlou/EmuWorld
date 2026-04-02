FROM rust:1.94-slim AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/emu-world-backend /usr/local/bin/
EXPOSE 8080
CMD ["emu-world-backend"]
