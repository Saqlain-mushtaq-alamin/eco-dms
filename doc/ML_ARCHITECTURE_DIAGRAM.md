# ML Verification Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DECENTRALIZED SOCIAL MEDIA                         │
│                         with ML Verification                             │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   Frontend   │  (React + TypeScript)
│  apps/web/   │
└──────┬───────┘
       │
       │ 1. Upload Image
       ▼
┌──────────────┐
│     IPFS     │  NFT.Storage / Pinata
│   Storage    │  
└──────┬───────┘
       │ Returns: image_cid
       │
       │ 2. Create Post
       ▼
┌────────────────────────────────────────────────────────────────────┐
│                         Backend API                                 │
│                   (FastAPI + Python)                                │
│                                                                     │
│  POST /api/posts                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ 1. Store post on IPFS → post_cid                        │    │
│  │ 2. Index in OrbitDB                                      │    │
│  │ 3. Trigger ML verification (async) ──────────┐          │    │
│  └──────────────────────────────────────────────┼──────────┘    │
│                                                  │                 │
└──────────────────────────────────────────────────┼─────────────────┘
                                                   │
                                                   │ Celery Task
                                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Redis Queue                                 │
│  Task: verify_eco_content(image_cid, text, post_id, author)        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Celery Worker                                 │
│                    (background process)                              │
│                                                                      │
│  Step 1: Fetch Image from IPFS                                     │
│  ┌────────────────────────────────────────────────┐                │
│  │  GET https://ipfs.io/ipfs/{image_cid}          │                │
│  │  ↓ Returns: image bytes                        │                │
│  └────────────────────────────────────────────────┘                │
│                                                                      │
│  Step 2: Run ML Models (Parallel)                                  │
│  ┌──────────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │   YOLOv8s (40%)  │  │ CLIP (30%)   │  │ EfficientNet (20%) │  │
│  │  Object Detection│  │ Image-Text   │  │  Classification    │  │
│  │                  │  │  Alignment   │  │                    │  │
│  │ Detects:         │  │ Matches:     │  │ Identifies:        │  │
│  │ • bicycle        │  │ • eco words  │  │ • nature scenes    │  │
│  │ • tree           │  │ • green text │  │ • outdoor images   │  │
│  │ • solar panel    │  │ • keywords   │  │                    │  │
│  └────────┬─────────┘  └──────┬───────┘  └─────────┬──────────┘  │
│           │                   │                     │              │
│           └───────────────────┼─────────────────────┘              │
│                               ▼                                     │
│  Step 3: Eco Scoring Logic                                        │
│  ┌────────────────────────────────────────────────┐                │
│  │  EcoScorer.calculate_final_score()             │                │
│  │                                                 │                │
│  │  final_score = yolo*0.4 + clip*0.3 +          │                │
│  │                efficientnet*0.2 + text*0.1     │                │
│  │                                                 │                │
│  │  is_eco = final_score > 0.8                   │                │
│  └────────────────────┬───────────────────────────┘                │
│                       │                                             │
│                       ▼                                             │
│  Step 4: Cryptographic Signing                                     │
│  ┌────────────────────────────────────────────────┐                │
│  │  VerdictSigner.sign_verdict()                  │                │
│  │  • Add nonce + timestamp (anti-replay)         │                │
│  │  • Sign with Ethereum private key              │                │
│  │  • Returns: {verdict, signature, address}      │                │
│  └────────────────────┬───────────────────────────┘                │
│                       │                                             │
│                       ▼                                             │
│  Step 5: Store on IPFS                                            │
│  ┌────────────────────────────────────────────────┐                │
│  │  signed_verdict_cid ← IPFS.add(verdict_json)   │                │
│  └────────────────────┬───────────────────────────┘                │
│                       │                                             │
│                       ▼                                             │
│  Step 6: Save Mapping                                             │
│  ┌────────────────────────────────────────────────┐                │
│  │  ml_verdicts/verdicts.json:                    │                │
│  │  {                                              │                │
│  │    "post_cid": {                                │                │
│  │      "verdict_cid": "Qm...",                   │                │
│  │      "eco": true,                               │                │
│  │      "confidence": 0.87                         │                │
│  │    }                                            │                │
│  │  }                                              │                │
│  └─────────────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               │ Task Complete
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend                                    │
│                     (Feed Display)                                   │
│                                                                      │
│  GET /api/posts/{wallet} OR /api/posts/feed/timeline               │
│  ┌──────────────────────────────────────────────┐                  │
│  │  Backend returns posts with verdict data:    │                  │
│  │  {                                            │                  │
│  │    "cid": "Qm...",                           │                  │
│  │    "content": "Riding bicycle!",             │                  │
│  │    "media_cids": ["QmImage..."],             │                  │
│  │    "verified": true,        ◄─── From ML     │                  │
│  │    "eco_score": 0.87,       ◄─── From ML     │                  │
│  │    "signed_verdict_cid": "QmVerdict..."      │                  │
│  │  }                                            │                  │
│  └───────────────────┬──────────────────────────┘                  │
│                      │                                               │
│                      ▼                                               │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  Post Card Rendering                                     │       │
│  │  ┌──────────────────────────────────────────┐           │       │
│  │  │  user123...  │  🟢 ECO ✓ (87%)           │           │       │
│  │  │              │                            │           │       │
│  │  │  [Bicycle Image]                         │           │       │
│  │  │  "Riding to work today!"                 │           │       │
│  │  │                                           │           │       │
│  │  │  👍 12   💬 3                            │           │       │
│  │  └──────────────────────────────────────────┘           │       │
│  │                                                          │       │
│  │  Click badge → Shows verification details modal         │       │
│  └─────────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════

                         DATA FLOW SUMMARY

┌────────┐   image    ┌──────┐   post    ┌─────────┐   task    ┌────────┐
│ User   │ ─────────► │ IPFS │ ────────► │ Backend │ ────────► │ Celery │
└────────┘            └──────┘           └─────────┘           └────┬───┘
                                                                     │
                                                                     │ ML
                                                                     ▼
┌────────┐  display   ┌──────┐  mapping  ┌─────────┐  verdict  ┌────────┐
│ User   │ ◄───────── │ Feed │ ◄──────── │ Backend │ ◄──────── │ Worker │
└────────┘            └──────┘           └─────────┘           └────────┘

═══════════════════════════════════════════════════════════════════════


                      DECENTRALIZATION FEATURES

┌─────────────────────────────────────────────────────────────────────┐
│  ✓ No Central Database - All data on IPFS/OrbitDB                  │
│  ✓ Optional Verification - Posts work without ML                   │
│  ✓ Cryptographic Proofs - Signed verdicts on IPFS                  │
│  ✓ Censorship Resistant - Immutable once stored                    │
│  ✓ Transparent Algorithm - Open source scoring logic               │
│  ✓ User Sovereignty - No central authority                         │
└─────────────────────────────────────────────────────────────────────┘


                        TIMING DIAGRAM

User                Backend              IPFS      Celery       Frontend
│                      │                  │          │             │
│─ Upload Image ──────►│                  │          │             │
│                      │─ Store ─────────►│          │             │
│◄── image_cid ────────│◄─────────────────│          │             │
│                      │                  │          │             │
│─ Create Post ───────►│                  │          │             │
│                      │─ Store Post ────►│          │             │
│                      │◄─ post_cid ──────│          │             │
│                      │─ Queue Task ────────────────►│             │
│◄── Success ──────────│                  │          │             │
│                      │                  │          │─ Fetch Img ─►│
│                      │                  │◄─ Image ─│             │
│                      │                  │          │             │
│                      │                  │         [ML Inference] │
│                      │                  │          │ (5-15 sec)  │
│                      │                  │          │             │
│                      │                  │◄─ Store ─│             │
│                      │◄─ Save Mapping ──────────────│             │
│                      │                  │          │             │
│─ Load Feed ─────────►│                  │          │             │
│                      │─ Get Posts ─────►│          │             │
│                      │◄─ Posts ─────────│          │             │
│                      │─ Get Verdicts ───►│          │             │
│◄── Posts+Verdicts ───│                  │          │             │
│                      │                  │          │             │
│                   [Shows ECO Badge ✓]   │          │             │
```
