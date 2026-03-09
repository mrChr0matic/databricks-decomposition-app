from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from databricks import sql
from typing import Optional, List, Dict
import os, requests, time
from dotenv import load_dotenv

load_dotenv()

# ==============================
# CONFIG
# ==============================

ALLOWED_TABLES = ["sales_gold", "taxi_gold", "bi_taxi"]

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
    conversation_id: Optional[str] = None

class SplitRequest(BaseModel):
    filters: dict[str, str]
    split_col: str
    kpi_metric: str
    table: str

# ==============================
# AUTH
# ==============================

def get_user_token(request: Request) -> str:

    token = request.headers.get("x-forwarded-access-token")

    if token:
        return token

    env_token = os.getenv("ACCESS_TOKEN")

    if env_token:
        return env_token

    raise HTTPException(
        status_code=401,
        detail="No user token available"
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
# KPI REGISTRY
# ==============================

def fetch_kpi_registry(token):
    
    with get_connection(token) as conn:
        with conn.cursor() as cursor:

            query = """
            SELECT DISTINCT
                r.kpi_name,
                r.sql_expression
            FROM poc_catalog.dashboard_poc.kpi_registry r
            JOIN poc_catalog.dashboard_poc.kpi_permissions p
              ON r.kpi_name = p.kpi_name
            WHERE is_member(p.group_name)
            """

            cursor.execute(query)
            rows = cursor.fetchall()

    return {r[0]: r[1] for r in rows}

# ==============================
# API ENDPOINTS
# ==============================

@app.get("/api/available-kpis")
def get_available_kpis(token: str = Depends(get_user_token)):
    try:
        registry = fetch_kpi_registry(token)

        return {
            "kpis": list(registry.keys())
        }
    except Exception as e:

        raise HTTPException(
            500,
            detail={"error": str(e), "type": type(e).__name__}
        )

# ==============================
# TOTAL KPI
# ==============================

@app.get("/api/total-sales")
def get_total_sales(kpi_metric: str, table: str, token: str = Depends(get_user_token)):

    registry = fetch_kpi_registry(token)

    if kpi_metric not in registry:
        raise HTTPException(403, "KPI access denied")

    metric_expr = registry[kpi_metric]

    query = f"""
    SELECT {metric_expr}
    FROM poc_catalog.dashboard_poc.bi_taxi_secure
    """

    try:

        with get_connection(token) as conn:
            with conn.cursor() as cursor:

                cursor.execute(query)

                result = cursor.fetchone()

        return {"total": result[0] if result and result[0] else 0}

    except Exception as e:

        raise HTTPException(
            500,
            detail={"error": str(e), "query": query}
        )

# ==============================
# SPLIT DATA
# ==============================

@app.post("/api/split-data")
def get_split_data(payload: SplitRequest, token: str = Depends(get_user_token)):

    if payload.split_col.lower() not in VALID_DIMS:
        raise HTTPException(400, "Invalid dimension")

    registry = fetch_kpi_registry(token)

    if payload.kpi_metric not in registry:
        raise HTTPException(403, "KPI access denied")

    metric_expr = registry[payload.kpi_metric]

    conditions = []
    params = []

    for k, v in payload.filters.items():

        if k.lower() not in VALID_DIMS:
            raise HTTPException(400, f"Invalid filter column: {k}")

        conditions.append(f"`{k}` = ?")
        params.append(v)

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    query = f"""
        SELECT `{payload.split_col}` AS node_name,
               {metric_expr} AS value
        FROM poc_catalog.dashboard_poc.bi_taxi_secure
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

        raise HTTPException(
            500,
            detail={"error": str(e), "query": query}
        )

# ==============================
# AVAILABLE DIMENSIONS
# ==============================

METRIC_COLS = {
    "passenger_count",
    "trip_distance",
    "fare_amount",
    "extra",
    "mta_tax",
    "tip_amount",
    "tolls_amount",
    "improvement_surcharge",
    "total_amount",
    "pickup_latitude",
    "pickup_longitude",
    "dropoff_latitude",
    "dropoff_longitude"
}

@app.get("/api/available-dims")
def get_available_dims(token: str = Depends(get_user_token)):

    try:

        with get_connection(token) as conn:
            with conn.cursor() as cursor:

                cursor.execute(
                    "DESCRIBE poc_catalog.dashboard_poc.bi_taxi_secure"
                )

                all_cols = [row[0] for row in cursor.fetchall()]

                dim_candidates = [
                    col for col in all_cols
                    if col not in METRIC_COLS
                ]

        return {"dims": dim_candidates}

    except Exception as e:

        raise HTTPException(
            500,
            detail={"error": str(e)}
        )

# ==============================
# GENIE ENDPOINT
# ==============================

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

        if status == "COMPLETED":

            attachments = poll_data.get("attachments", [])

            for attachment in attachments:

                if attachment.get("text"):

                    return {
                        "answer": attachment["text"]["content"],
                        "conversation_id": conversation_id
                    }

        elif status in ("FAILED", "CANCELLED"):

            raise Exception(f"Genie query {status}")

        time.sleep(2)

    raise Exception("Genie timeout")

@app.post("/api/genie")
def genie_endpoint(payload: GenieRequest, token: str = Depends(get_user_token)):

    try:

        context = {
            "question": payload.question,
            "table": "poc_catalog.dashboard_poc.bi_taxi_secure",
            "kpi": payload.kpi_metric,
            "filters": payload.path,
            "conversation_id": payload.conversation_id
        }

        result = call_genie_service(context, token)

        return {
            "response": result["answer"],
            "conversation_id": result["conversation_id"]
        }

    except Exception as e:

        raise HTTPException(
            500,
            detail={"error": str(e)}
        )

# ==============================
# SERVE REACT SPA
# ==============================

@app.get("/{full_path:path}")
def serve_react_app(request: Request, full_path: str):

    if request.url.path.startswith("/api"):
        raise HTTPException(status_code=404)

    file_path = os.path.join(REACT_BUILD_PATH, full_path)

    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)

    return FileResponse(os.path.join(REACT_BUILD_PATH, "index.html"))