
from pydantic import BaseModel

class NonceResponse(BaseModel):
    nonce: str

class PrepareMessageRequest(BaseModel):
    address: str
    chain_id: int
    nonce: str

class PrepareMessageResponse(BaseModel):
    message: str

class VerifyRequest(BaseModel):
    message: str
    signature: str

class AuthResponse(BaseModel):
    address: str
    is_new: bool

class UserResponse(BaseModel):
    address: str
    display_name: str | None