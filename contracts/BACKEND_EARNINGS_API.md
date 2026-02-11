# Backend Earnings API Endpoint

Add this to your backend to support the earnings dashboard:

## File: `backend/app/earnings_routes.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from typing import Optional
from .deps import get_current_user

router = APIRouter(prefix="/api/verify", tags=["verification"])

# In-memory storage (replace with database in production)
earnings_data = {}

@router.get("/earnings/{wallet_address}")
async def get_earnings(
    wallet_address: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get earnings statistics for a wallet
    
    Returns:
    - lifetime_earned: Total ECO tokens earned
    - today_earned: ECO tokens earned in last 24 hours
    - total_claims: Number of successful claims
    - last_claim_time: Timestamp of last claim
    """
    
    # Get  earnings from storage (or database)
    wallet_earnings = earnings_data.get(wallet_address, {
        "lifetime_earned": "0",
        "today_earned": "0",
        "total_claims": 0,
        "claims": []
    })
    
    # Calculate today's earnings
    now = datetime.now()
    today_start = now - timedelta(hours=24)
    
    today_claims = [
        claim for claim in wallet_earnings.get("claims", [])
        if datetime.fromisoformat(claim["timestamp"]) > today_start
    ]
    
    today_earned = sum(float(claim["amount"]) for claim in today_claims)
    
    return {
        "wallet_address": wallet_address,
        "lifetime_earned": wallet_earnings.get("lifetime_earned", "0"),
        "today_earned": str(today_earned),
        "total_claims": wallet_earnings.get("total_claims", 0),
       "last_claim_time": wallet_earnings.get("last_claim_time"),
    }


@router.post("/claim/record")
async def record_claim(
    wallet_address: str,
    post_cid: str,
    amount: str,
    tx_hash: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Record a successful claim for earnings tracking
    
    Called by frontend after successful blockchain transaction
    """
    
    if wallet_address not in earnings_data:
        earnings_data[wallet_address] = {
            "lifetime_earned": "0",
            "total_claims": 0,
            "claims": [],
            "last_claim_time": None
        }
    
    # Update earnings
    current_lifetime = float(earnings_data[wallet_address]["lifetime_earned"])
    new_lifetime = current_lifetime + float(amount)
    
    earnings_data[wallet_address]["lifetime_earned"] = str(new_lifetime)
    earnings_data[wallet_address]["total_claims"] += 1
    earnings_data[wallet_address]["last_claim_time"] = datetime.now().isoformat()
    
    # Add to claims history
    earnings_data[wallet_address]["claims"].append({
        "post_cid": post_cid,
        "amount": amount,
        "tx_hash": tx_hash,
        "timestamp": datetime.now().isoformat()
    })
    
    return {
        "success": True,
        "lifetime_earned": str(new_lifetime),
        "total_claims": earnings_data[wallet_address]["total_claims"]
    }
```

## Add to `backend/app/main.py`:

```python
from .earnings_routes import router as earnings_router

# ... existing code ...

app.include_router(earnings_router)
```

## Better Option: Use Database

For production, store earnings in your database instead of in-memory:

```python
# backend/app/models.py
from sqlalchemy import Column, String, Integer, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Claim(Base):
    __tablename__ = "claims"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String, index=True)
    post_cid = Column(String, unique=True)
    amount = Column(Float)
    tx_hash = Column(String, unique=True)
    claimed_at = Column(DateTime)

# Then query:
# - SUM(amount) for lifetime
# - SUM(amount WHERE claimed_at > today) for today
```

This approach is more reliable and persists data across restarts.
