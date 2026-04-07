use tonic::transport::Channel;
use futures_util::Stream;
use ai_service::ai_service_client::AiServiceClient;

pub mod ai_service {
    tonic::include_proto!("ai_service");
}

pub struct AIClient {
    client: AiServiceClient<Channel>,
}

impl AIClient {
    pub async fn connect(url: String) -> anyhow::Result<Self> {
        let channel = Channel::from_shared(url)?
            .connect()
            .await?;
        
        Ok(Self {
            client: AiServiceClient::new(channel),
        })
    }

    pub async fn predict(
        &self,
        question: String,
        outcomes: Vec<String>,
        horizon_days: i32,
    ) -> anyhow::Result<ai_service::PredictResponse> {
        let request = tonic::Request::new(ai_service::PredictRequest {
            question,
            outcomes,
            horizon_days,
            context: String::new(),
        });

        let mut client = self.client.clone();
        let response = client.predict(request).await?;
        Ok(response.into_inner())
    }

    pub async fn chat(
        &self,
        message: String,
        history: Vec<ai_service::ChatHistory>,
        context: ai_service::ChatContext,
    ) -> anyhow::Result<ai_service::ChatResponse> {
        let request = tonic::Request::new(ai_service::ChatRequest {
            message,
            history,
            context: Some(context),
        });

        let mut client = self.client.clone();
        let response = client.chat(request).await?;
        Ok(response.into_inner())
    }

    pub async fn chat_stream(
        &self,
        message: String,
        history: Vec<ai_service::ChatHistory>,
        context: ai_service::ChatContext,
    ) -> anyhow::Result<impl Stream<Item = Result<ai_service::ChatResponse, tonic::Status>>> {
        let request = tonic::Request::new(ai_service::ChatRequest {
            message,
            history,
            context: Some(context),
        });

        let mut client = self.client.clone();
        let response = client.chat_stream(request).await?;
        Ok(response.into_inner())
    }

    pub async fn fetch_data(
        &self,
        source: String,
        series_id: String,
    ) -> anyhow::Result<ai_service::FetchDataResponse> {
        let request = tonic::Request::new(ai_service::FetchDataRequest {
            source,
            series_id,
        });

        let mut client = self.client.clone();
        let response = client.fetch_data(request).await?;
        Ok(response.into_inner())
    }
}
