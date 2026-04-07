fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .build_server(false) // 只有后端是客户端
        .build_client(true)
        .compile_protos(
            &["../ai-service/proto/ai_service.proto"],
            &["../ai-service/proto"],
        )?;
    Ok(())
}
