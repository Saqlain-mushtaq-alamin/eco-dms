
                            # Redis in my System - Complete Breakdown

                            Redis serves 4 critical but temporary roles:

                            ## 1. Celery Task Queue (Most Important)

                            ```
                            ┌─────────────┐         ┌─────────┐         ┌──────────────┐
                            │ POST        │ ──────> │  Redis  │ ──────> │ Celery       │
                            │ /api/posts  │ Trigger │  Queue  │ Consume │ Worker       │
                            └─────────────┘         └─────────┘         └──────────────┘
                                                         │
                                                         │ Stores:
                                                         │ - Task ID
                                                         │ - Task status
                                                         │ - Task result
                            ```

                            **What it stores:**

                            ```json
                            {
                              "celery-task-meta-86058625-fdca...": {
                                "status": "SUCCESS",
                                "result": {
                                  "verdict": {...},
                                  "signature": "0x2e22b6c..."
                                },
                                "task_id": "86058625-fdca-4528-9f43-a2cb06e15fb4"
                              }
                            }
                            ```

                            **Lifetime:** 24 hours (then auto-deleted)

                            ## 2. User Sessions (SIWE Authentication)

                            When user signs in with wallet:

                            ```python
                            session_data = {
                                "wallet": "0xdafcfd6c7d4d9f0eb63c812ad7712a720b3a92d1",
                                "authenticated": True,
                                "created_at": "2026-01-10T01:00:00Z"
                            }
                            redis.setex("session:abc123", 3600, json.dumps(session_data))
                            ```

                            **What it stores:**

                            - Active login sessions
                            - Wallet addresses
                            - Session tokens

                            **Lifetime:** 1 hour (SESSION_TTL_SECONDS)

                            ## 3. SIWE Nonces (Anti-Replay Protection)

                            ```python
                            # Generate nonce for wallet signature
                            nonce = secrets.token_urlsafe(32)
                            redis.setex(
                                f"nonce:{wallet_address}:{nonce}", 
                                300,  # 5 minutes
                                "1"
                            )
                            ```

                            **Purpose:** Prevent signature replay attacks

                            1. User requests nonce
                            2. Signs message with nonce
                            3. Nonce can only be used once
                            4. Expires after 5 minutes

                            **Lifetime:** 5 minutes (NONCE_TTL_SECONDS)

                            ## 4. Rate Limiting (API Protection)

                            ```python
                            # Track API calls per user
                            redis.incr(f"ratelimit:verify:{wallet_address}")
                            redis.expire(f"ratelimit:verify:{wallet_address}", 60)
                            ```

                            **What it tracks:**

                            - API calls per minute
                            - Verification requests
                            - Prevents abuse

                            **Lifetime:** 60 seconds (RATE_LIMIT_WINDOW_SEC)

                            ---

                            ## 🔑 Key Characteristics

                            ### ✅ Redis is EPHEMERAL (temporary):
                            - All data has expiration times
                            - If Redis crashes → no permanent data loss
                            - Posts/images are on IPFS (safe!)

                            ### ⚡ Redis is FAST:
                            - In-memory database
                            - Millisecond response times
                            - Perfect for real-time operations

                            ### 🔄 Redis is REPLACEABLE:
                            - Could use RabbitMQ for task queue
                            - Could use JWT for sessions (no server storage)
                            - Could use database for rate limiting

                            ---

                            ## 📊 Redis Data Lifespan

                            | Data Type | Lifetime | Example Key | Decentralized? |
                            |-----------|----------|-------------|----------------|
                            | Celery tasks | 24 hours | `celery-task-meta-{id}` | ❌ Centralized cache |
                            | Sessions | 1 hour | `session:{token}` | ❌ Server-side only |
                            | Nonces | 5 minutes | `nonce:{wallet}:{nonce}` | ❌ Temporary security |
                            | Rate limits | 60 seconds | `ratelimit:verify:{wallet}` | ❌ Anti-abuse only |

                            ---

                            ## 🤔 What Happens if Redis Dies?

                            ### Immediate Impact:

                            - ❌ Active sessions lost (users need to re-login)
                            - ❌ Pending ML tasks lost (need to re-trigger)
                            - ❌ Rate limiting stops working

                            ### NO Impact on:

                            - ✅ Existing posts (on IPFS)
                            - ✅ Existing images (on IPFS)
                            - ✅ Past verdicts (stored on IPFS)
                            - ✅ User wallets (self-sovereign)

                            ### Recovery:

                            ```bash
                            # Just restart Redis - system continues
                            docker run -d redis:7
                            make dev
                            # Users re-login → system fully operational
                            ```

                            ---

                            ## 🎯 Summary

                            **Redis is a temporary coordination layer for:**

                            1. **Task queue** → ML verification jobs
                            2. **Sessions** → User authentication state
                            3. **Nonces** → Security (anti-replay)
                            4. **Rate limits** → Anti-abuse

                            **It does NOT store:**

                            - ❌ Posts
                            - ❌ Images
                            - ❌ User profiles
                            - ❌ Verdicts (IPFS has the real copy)

                            > **Think of Redis as RAM** - fast, temporary, helps with performance, but not the source of truth. The real data lives on IPFS/OrbitDB forever! 🚀

