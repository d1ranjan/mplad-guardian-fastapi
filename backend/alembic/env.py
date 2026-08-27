import asyncio
from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from app.main import Base, settings

config = context.config
target_metadata = Base.metadata

def offline():
    context.configure(url=settings.postgresql_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction(): context.run_migrations()

def sync_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction(): context.run_migrations()

async def online():
    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = settings.postgresql_url.replace("postgresql://", "postgresql+asyncpg://", 1) if settings.postgresql_url.startswith("postgresql://") else settings.postgresql_url
    engine = async_engine_from_config(section, prefix="sqlalchemy.", poolclass=pool.NullPool)
    async with engine.connect() as connection: await connection.run_sync(sync_migrations)
    await engine.dispose()

if context.is_offline_mode(): offline()
else: asyncio.run(online())
