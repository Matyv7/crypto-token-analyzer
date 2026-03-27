from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    og_private_key: str
    eth_rpc_url: str = "https://mainnet.infura.io/v3/YOUR_KEY"
    base_rpc_url: str = "https://mainnet.base.org"
    bsc_rpc_url: str = "https://bsc-dataseed.binance.org/"
    sol_rpc_url: str = "https://api.mainnet-beta.solana.com"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    def __repr__(self) -> str:
        # NEVER include the private key in repr — it must never appear in logs
        return f"Settings(base_rpc_url={self.base_rpc_url!r})"


@lru_cache
def get_settings() -> Settings:
    return Settings()
