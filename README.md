# AIsthetic

AIsthetic is an AI-powered fashion discovery platform. Shoppers can search a product catalog with natural language or an image, explore brands, and organize products into personal or collaborative closets.

## Preview

![AIsthetic multimodal fashion search](docs/screenshots/home-desktop.png)

## Highlights

- Multimodal product search using text, images, or both
- Semantic similarity search backed by OpenCLIP and PostgreSQL/pgvector
- Product, brand, category, and curated-closet browsing
- Auth0 authentication and user-owned closets
- Shareable closets with viewer and editor roles
- Responsive React storefront plus a separate editorial experience
- FastAPI backend with rate limiting, health checks, and API documentation

## Tech stack

- **Storefront:** React 19, TypeScript, Vite, Tailwind CSS, TanStack Query
- **Editorial:** React 19, TypeScript, Vite, static prerendering
- **API:** FastAPI, SQLAlchemy, PostgreSQL, pgvector
- **Search:** OpenCLIP embeddings and vector similarity
- **Authentication:** Auth0
- **Deployment:** Vercel for web apps and Render for the API

## Repository structure

```text
.
├── frontend/          # Shopper-facing React application
├── editorial/         # Editorial and curated-content application
├── backend/           # FastAPI API, database code, and search pipeline
├── render.yaml        # Render API blueprint
└── API_SETUP.md       # Detailed local API notes
```

## Local setup

### Requirements

- Node.js 22+
- Python 3.11+
- PostgreSQL with the pgvector extension
- An Auth0 application and API

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python main.py
```

Fill in `backend/.env` before starting the API. At minimum, configure `DATABASE_URL`, `AUTH0_DOMAIN`, and `AUTH0_AUDIENCE`. Auth0 management operations also require `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET`.

The API runs at `http://localhost:8000`. In development, interactive documentation is available at `http://localhost:8000/docs`.

### 2. Storefront

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Alternatively, after installing frontend dependencies, run `npm run dev` from the repository root. The storefront defaults to `http://localhost:5173`.

### 3. Editorial app

```bash
cd editorial
npm ci
npm run dev
```

## Quality checks

```bash
# Storefront
npm run build
npm run lint

# Editorial app
npm run typecheck:editorial
npm run build:editorial

# Backend syntax
python -m compileall -q backend
```

GitHub Actions runs these checks on pushes and pull requests.

## Deployment

- Import `frontend/` into Vercel as a Vite project and configure its `VITE_*` variables.
- Create the API from `render.yaml` and add the secret environment variables in Render.
- If publishing the editorial app separately, configure `editorial/` as its own Vite project.
- Set `FRONTEND_URL` on the API to the final storefront origin and add that origin to Auth0's allowed callback, logout, and web-origin settings.

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities privately through GitHub Security Advisories and rotate any credential that has ever been committed.
