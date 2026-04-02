FROM python:3.14-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python -m grpc_tools.protoc -Iproto --python_out=. --grpc_python_out=. proto/ai_service.proto
EXPOSE 9000
EXPOSE 9001
CMD ["python", "main.py"]
