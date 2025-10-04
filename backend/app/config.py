from functools import cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Arihan's cave"
    gemini_api_key: str = ""
    openai_api_key: str = ""

    class Config:
        env_file = ".env"


@cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
