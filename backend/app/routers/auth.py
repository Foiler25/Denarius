from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("3/hour")
async def register(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user, access_token, refresh_token = await auth_service.register_user(body, db)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/15minutes")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user, access_token, refresh_token = await auth_service.login_user(body, db)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("60/minute")
async def refresh(request: Request, body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    user, access_token, new_refresh = await auth_service.refresh_tokens(body.refresh_token, db)
    return TokenResponse(access_token=access_token, refresh_token=new_refresh)


@router.post("/logout", status_code=204)
async def logout(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.logout_user(request.refresh_token, db)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/claim-admin", response_model=UserOut)
async def claim_admin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.claim_admin(current_user, db)
