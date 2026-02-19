from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from databricks import sql
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()


# ==============================
# CONFIG
# ==============================

ALLOWED_TABLES = ["sales_gold", "taxi_gold", "bi_taxi"]

ALLOWED_METRICS = [
    "total_amount",
    "trip_distance",
    "passenger_count",
]

VALID_DIMS = [
    "year",
    "month",
    "payment_type",
    "vendor_id",
    "time_bucket",
    "day",
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

REACT_BUILD_PATH = os.path.join(
    BASE_DIR,
    "..",
    "decomposition_tree_ui",
    "dist"
)


# ==============================
# VALIDATION
# ==============================

def validate(table: Optional[str] = None,
             metric: Optional[str] = None,
             dim: Optional[str] = None):

    if table and table.lower() not in ALLOWED_TABLES:
        raise HTTPException(400, "Invalid table")

    if metric and metric.lower() not in ALLOWED_METRICS:
        raise HTTPException(400, "Invalid metric")

    if dim and dim.lower() not in VALID_DIMS:
        raise HTTPException(400, "Invalid dimension")


# ==============================
# APP INIT
# ==============================

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# SERVE REACT
# ==============================

app.mount(
    "/assets",
    StaticFiles(directory=os.path.join(REACT_BUILD_PATH, "assets")),
    name="assets",
)

app.mount(
    "/static",
    StaticFiles(directory=REACT_BUILD_PATH),
    name="static",
)


# ==============================
# MODELS
# ==============================

class SplitRequest(BaseModel):
    filters: dict[str, str]
    split_col: str
    kpi_metric: str
    table: str

class BaseCol(BaseModel):
    kpi_metric: str


# ==============================
# AUTH
# ==============================

def get_user_token(request: Request) -> str:
    token = request.headers.get("x-forwarded-access-token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return token


# ==============================
# DB CONNECTION
# ==============================

def get_connection(token: str):
    return sql.connect(
        server_hostname=os.getenv("SQL_SERVER_HOSTNAME"),
        http_path=os.getenv("HTTP_PATH"),
        access_token=token,
    )


# ==============================
# API ENDPOINTS
# ==============================

# @app.get("/api/debug/headers")
# def debug_headers(request: Request):
#     return {"headers": dict(request.headers)}

# import base64, json

# @app.get("/api/debug/token-scopes")
# def token_scopes(token: str = Depends(get_user_token)):
#     try:
#         # JWT is 3 parts split by dots, middle part is the payload
#         payload = token.split(".")[1]
#         # Add padding if needed
#         payload += "=" * (4 - len(payload) % 4)
#         decoded = json.loads(base64.b64decode(payload).decode("utf-8"))
#         return {
#             "scopes": decoded.get("scp", decoded.get("scope", "not found")),
#             "sub": decoded.get("sub"),
#             "exp": decoded.get("exp")
#         }
#     except Exception as e:
#         return {"error": str(e)}

# @app.get("/api/debug/whoami")
# def whoami(token: str = Depends(get_user_token)):
#     try:
#         with get_connection(token) as conn:
#             with conn.cursor() as cursor:
#                 cursor.execute("SELECT current_user()")
#                 result = cursor.fetchone()
#         return {"user": result[0]}
#     except Exception as e:
#         raise HTTPException(500, detail={"error": str(e), "type": type(e).__name__})


@app.get("/api/total-sales")
def get_total_sales(kpi_metric: str, table: str, token: str = Depends(get_user_token)):

    validate(table, kpi_metric)

    query = f"SELECT SUM({kpi_metric}) FROM poc_db.{table}"

    try:
        with get_connection(token) as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                result = cursor.fetchone()

        return {"total": result[0] if result and result[0] else 0}

    except Exception as e:
        raise HTTPException(500, detail={
            "error": str(e),
            "type": type(e).__name__,
            "query": query,
            "table": table,
            "metric": kpi_metric
        })


@app.post("/api/split-data")
def get_split_data(payload: SplitRequest, token: str = Depends(get_user_token)):

    validate(payload.table, payload.kpi_metric, payload.split_col)

    for col in payload.filters:
        if col.lower() not in VALID_DIMS:
            raise HTTPException(400, f"Invalid filter column: {col}")

    conditions = []
    params = []

    for k, v in payload.filters.items():
        conditions.append(f"`{k}` = ?")
        params.append(v)

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    query = f"""
        SELECT `{payload.split_col}` AS node_name,
               SUM({payload.kpi_metric}) AS value
        FROM poc_db.{payload.table}
        WHERE {where_clause}
        GROUP BY `{payload.split_col}`
        ORDER BY value DESC
        LIMIT 50
    """

    try:
        with get_connection(token) as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                rows = cursor.fetchall()

        return [
            {
                "node_name": r[0],
                "value": float(r[1]) if r[1] else 0
            }
            for r in rows
        ]

    except Exception as e:
        raise HTTPException(500, detail={
            "error": str(e),
            "type": type(e).__name__,
            "query": query,
            "payload": payload.dict()
        })


# ==============================
# SERVE REACT SPA (must be LAST)
# ==============================

@app.get("/{full_path:path}")
def serve_react_app(request: Request, full_path: str):

    if request.url.path.startswith("/api"):
        raise HTTPException(status_code=404)

    file_path = os.path.join(REACT_BUILD_PATH, full_path)

    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)

    return FileResponse(os.path.join(REACT_BUILD_PATH, "index.html"))