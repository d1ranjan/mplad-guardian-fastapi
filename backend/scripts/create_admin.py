"""Create or update a FastAPI administrator without exposing credentials in source code.

Usage: INITIAL_ADMIN_EMAIL=analyst@example.gov INITIAL_ADMIN_PASSWORD='strong password' python3 -m backend.scripts.create_admin
"""
import asyncio
import os
from sqlalchemy import select
from app.main import Session, User, passwords


async def create_admin() -> None:
    email = os.environ["INITIAL_ADMIN_EMAIL"].strip().lower()
    password = os.environ["INITIAL_ADMIN_PASSWORD"]
    if len(password) < 12:
        raise ValueError("INITIAL_ADMIN_PASSWORD must be at least 12 characters.")
    async with Session() as session:
        user = await session.scalar(select(User).where(User.email == email))
        if user:
            user.role = "admin"
            user.password_hash = passwords.hash(password)
            user.is_active = True
        else:
            session.add(User(email=email, name="MPLAD Administrator", password_hash=passwords.hash(password), role="admin"))
        await session.commit()
    print(f"Administrator ready: {email}")


if __name__ == "__main__":
    asyncio.run(create_admin())
