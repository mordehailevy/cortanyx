"""Application settings, read from the server-side .env file only."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # OpenAI - the key never leaves the server
    openai_api_key: str = Field(default="", repr=False)
    openai_model: str = "gpt-4o-mini"
    openai_temperature: float = 0.7
    openai_max_output_tokens: int = 2048

    # MySQL
    database_url: str = "mysql+pymysql://chat_app:change_me@localhost:3306/chatgpt_clone?charset=utf8mb4"

    # API
    cors_origins: str = "http://localhost:5173"
    # How many previous messages are sent back to the model as context
    context_max_messages: int = 40
    # Simple per-IP limit on chat requests
    rate_limit_per_minute: int = 20
    max_message_chars: int = 8000

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
