
from fastapi import APIRouter, HTTPException, status, Response
from web3 import Web3
from eth_account.messages import encode_defunct
from .siwe_store import nonce_store, session_store
from .session_middleware import set_session_cookie, clear_session_cookie
from .schemas import NonceResponse, PrepareMessageRequest, PrepareMessageResponse, VerifyRequest, AuthResponse
from .models import User
from sqlmodel import SQLModel, create_engine, Session, select

router = APIRouter(prefix="/api/siwe", tags=["siwe"])

engine = create_engine("sqlite:///./siwe.db")
SQLModel.metadata.create_all(engine)

DOMAIN = "localhost"
URI = "http://localhost:8000"
VERSION = "1"

def build_siwe_message(addr: str, chain_id: int, nonce: str) -> str:
    # Minimal SIWE message
    return (
        f"{addr.lower()} wants to sign in to {DOMAIN}.\n\n"
        f"URI: {URI}\nVersion: {VERSION}\nChain ID: {chain_id}\nNonce: {nonce}"
    )

@router.get("/nonce", response_model=NonceResponse)
def get_nonce():
    return NonceResponse(nonce=nonce_store.create_nonce())

@router.post("/prepare", response_model=PrepareMessageResponse)
def prepare_message(payload: PrepareMessageRequest):
    if not Web3.is_address(payload.address):
        raise HTTPException(status_code=400, detail="Invalid address")
    if not nonce_store.validate_and_consume(payload.nonce):
        raise HTTPException(status_code=400, detail="Invalid or expired nonce")
    message = build_siwe_message(payload.address, payload.chain_id, payload.nonce)
    return PrepareMessageResponse(message=message)

@router.post("/verify", response_model=AuthResponse)
def verify_signature(data: VerifyRequest, response: Response):
    # Recover address from signature
    msg = encode_defunct(text=data.message)
    try:
        recovered = Web3().eth.account.recover_message(msg, signature=data.signature)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad signature")
    recovered = recovered.lower()

    # Basic message validation (ensure recovered address present in message)
    if recovered not in data.message.lower():
        raise HTTPException(status_code=400, detail="Address mismatch")

    with Session(engine) as session:
        statement = select(User).where(User.address == recovered)
        user = session.exec(statement).first()
        is_new = False
        if not user:
            user = User(address=recovered)
            session.add(user)
            session.commit()
            session.refresh(user)
            is_new = True

    sid = session_store.create_session(recovered)
    set_session_cookie(response, sid)
    return AuthResponse(address=recovered, is_new=is_new)

@router.post("/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}