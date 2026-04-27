import os
from dotenv import load_dotenv

load_dotenv()

SAMBANOVA_API_KEY=os.getenv("SAMBANOVA_API_KEY")
SAMBANOVA_BASE_URL=os.getenv("SAMBANOVA_BASE_URL")
SAMBANOVA_MODEL=os.getenv("SAMBANOVA_MODEL","DeepSeek-V3.1-cb")
SAMBANOVA_FALLBACK_MODELS=[
    model.strip()
    for model in os.getenv("SAMBANOVA_FALLBACK_MODELS","gemma-3-12b-it").split(",")
    if model.strip()
]
SAMBANOVA_REQUEST_TIMEOUT=float(os.getenv("SAMBANOVA_REQUEST_TIMEOUT","35"))
SAMBANOVA_MAX_TOKENS=int(os.getenv("SAMBANOVA_MAX_TOKENS","450"))

SPRING_BACKEND_URL=os.getenv("SPRING_BACKEND_URL","http://localhost:8080")
