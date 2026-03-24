# 🤖 AI Assistant Protocol (Homecare Hub)

This file provides context for any AI assistant (like Claude or Antigravity) working on this repository.

## 🚀 Tech Stack
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide React.
- **Backend**: FastAPI (Python 3.10+), SQLAlchemy, PostgreSQL (or SQLite for dev), Pydantic.
- **Authentication**: JWT-based with Role-Based Access Control (RBAC).

## 🛠️ Operational Rules
1. **Design Principle**: ShigenTech Premium - High contrast (`#000000` text/headers), emerald greens (`#064e3b`), and professional whitespace.
2. **Security First**: Every new dashboard route MUST be wrapped in the `AuthGuard` or added to a protected layout. 
3. **Ghost Route Policy**: Never leave a navigation link pointing to a 404. If a feature isn't built, create a placeholder dashboard with professional stats.
4. **Environment**: 
   - Frontend runs on `localhost:3000`.
   - Backend runs on `localhost:8000`.
   - API Documentation is at `/api/v1/docs`.

## 📂 Key Connection Points
- **API Fetching**: Always use the custom `apiFetch` utility in `frontend/lib/api.ts`.
- **User Roles**: Roles are `ADMIN`, `SERVICER`, and `USER`. Check roles using `getRole()` in `frontend/lib/auth.ts`.
- **Database Modifying**: Update `backend/app/internal/models.py` for schema changes and always verify Pydantic schemas in `backend/app/internal/schemas.py`.

## 📝 Recent Task Context
The ecosystem is currently transitioning from a simple booking app to a **Home Maintenance Incident & Alert Ledger**.
