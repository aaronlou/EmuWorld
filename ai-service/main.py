from fastapi import FastAPI

app = FastAPI(title="EmuWorld AI Service")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"message": "EmuWorld AI Service"}
