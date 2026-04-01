FROM rust:1.94-slim AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/emu-world-backend /usr/local/bin/
EXPOSE 8080
CMD ["emu-world-backend"]
