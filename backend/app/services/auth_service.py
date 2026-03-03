from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest
from app.utils.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)


async def register_user(request: RegisterRequest, db: AsyncSession) -> tuple[User, str, str]:
    existing = await db.execute(
        select(User).where((User.username == request.username) | (User.email == request.email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists")

    count_result = await db.execute(select(func.count()).select_from(User))
    user_count = count_result.scalar()
    role = UserRole.admin if user_count == 0 else UserRole.member

    user = User(
        username=request.username,
        email=request.email,
        password_hash=hash_password(request.password),
        role=role,
    )
    db.add(user)
    await db.flush()

    access_token, raw_refresh = await _issue_tokens(user, db)
    await db.commit()
    await db.refresh(user)
    return user, access_token, raw_refresh


async def login_user(request: LoginRequest, db: AsyncSession) -> tuple[User, str, str]:
    result = await db.execute(select(User).where(User.username == request.username, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token, raw_refresh = await _issue_tokens(user, db)
    await db.commit()
    return user, access_token, raw_refresh


async def refresh_tokens(raw_refresh_token: str, db: AsyncSession) -> tuple[User, str, str]:
    token_hash = hash_refresh_token(raw_refresh_token)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at == None,
            RefreshToken.expires_at > now,
        )
    )
    token_row = result.scalar_one_or_none()
    if not token_row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    token_row.revoked_at = now

    user_result = await db.execute(select(User).where(User.id == token_row.user_id, User.is_active == True))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    access_token, new_raw_refresh = await _issue_tokens(user, db)
    await db.commit()
    return user, access_token, new_raw_refresh


async def logout_user(raw_refresh_token: str, db: AsyncSession) -> None:
    token_hash = hash_refresh_token(raw_refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    token_row = result.scalar_one_or_none()
    if token_row:
        token_row.revoked_at = datetime.now(timezone.utc)
        await db.commit()


async def _issue_tokens(user: User, db: AsyncSession) -> tuple[str, str]:
    access_token = create_access_token({
        "sub": str(user.id),
        "username": user.username,
        "role": user.role.value,
    })
    raw_refresh = generate_refresh_token()
    refresh_row = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh),
        expires_at=refresh_token_expiry(),
        created_at=datetime.now(timezone.utc),
    )
    db.add(refresh_row)
    return access_token, raw_refresh
