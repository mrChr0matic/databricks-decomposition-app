from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from databricks import sql
from typing import Optional
import os, requests
from dotenv import load_dotenv
from typing import List, Dict

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


class GenieRequest(BaseModel):
    question: str
    table: str
    kpi_metric: str
    path: List[Dict[str, str]]
    conversation_id: Optional[str] = None  # <-- add this
    
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

# def get_user_token(request: Request) -> str:
#     token = request.headers.get("x-forwarded-access-token")
#     if not token:
#         raise HTTPException(status_code=401, detail="Not authenticated")
#     return token


import time

def call_genie_service(context, token):
    workspace_url = os.getenv("DATABRICKS_HOST")
    space_id = os.getenv("GENIE_SPACE_ID")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    conversation_id = context.get("conversation_id")

    if conversation_id:
        url = f"{workspace_url}/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages"
        res = requests.post(url, headers=headers, json={"content": context["question"]})
    else:
        url = f"{workspace_url}/api/2.0/genie/spaces/{space_id}/start-conversation"
        res = requests.post(url, headers=headers, json={"content": context["question"]})

    print("Genie start/continue status:", res.status_code)
    res.raise_for_status()
    data = res.json()

    conversation_id = data["conversation_id"]
    message_id = data["message_id"]

    poll_url = f"{workspace_url}/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages/{message_id}"

    for _ in range(30):
        poll_res = requests.get(poll_url, headers=headers)
        poll_res.raise_for_status()
        poll_data = poll_res.json()

        status = poll_data.get("status")
        print("Poll status:", status)

        if status == "COMPLETED":
            attachments = poll_data.get("attachments", [])
            for attachment in attachments:
                if attachment.get("text"):
                    return {
                        "answer": attachment["text"]["content"],
                        "conversation_id": conversation_id  # <-- return it
                    }
            return {"answer": "No text response found.", "conversation_id": conversation_id}

        elif status in ("FAILED", "CANCELLED"):
            raise Exception(f"Genie query {status}: {poll_data}")

        time.sleep(2)

    raise Exception("Genie timed out")

def get_user_token(request: Request) -> str:
    token = request.headers.get("x-forwarded-access-token")
    if token:
        return token

    # Local fallback
    env_token = os.getenv("ACCESS_TOKEN")
    if env_token:
        return env_token

    raise HTTPException(
        status_code=401,
        detail="No user token available (header or env)"
    )


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
        
# GENIE endpoint

@app.post("/api/genie")
def genie_endpoint(payload: GenieRequest, token: str = Depends(get_user_token)):
    try:
        context = {
            "question": payload.question,
            "table": payload.table,
            "kpi": payload.kpi_metric,
            "filters": payload.path,
            "conversation_id": payload.conversation_id, 
        }
        result = call_genie_service(context, token)
        return {
            "response": result.get("answer", "No answer returned"),
            "conversation_id": result.get("conversation_id"),  # <-- return to frontend
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "type": type(e).__name__})

# @app.post("/api/genie")
# async def genie_endpoint(request: Request):
#     body = await request.json()
#     print(body)
#     return {"ok": True}
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