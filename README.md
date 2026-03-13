# JengoRoute


Quick start

1. Database — Run backend/db/schema.sql in Supabase SQL Editor

#backend
```bash
cd backend
cp .env.example .env        # Fill in real values
pip install -r requirements.txt
docker-compose up -d redis   # Start Redis
uvicorn main:app --reload    # Start API server
python worker.py             # Start queue worker (separate terminal)
```

#frontend
```bash
cd frontend
cp .env.example .env.local   # Fill in real values
npm install
npm run dev
```