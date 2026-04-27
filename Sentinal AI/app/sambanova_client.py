from openai import OpenAI
from app.config import (
    SAMBANOVA_API_KEY,
    SAMBANOVA_BASE_URL,
    SAMBANOVA_MODEL,
    SAMBANOVA_FALLBACK_MODELS,
    SAMBANOVA_REQUEST_TIMEOUT,
    SAMBANOVA_MAX_TOKENS,
)

client = OpenAI(
    api_key = SAMBANOVA_API_KEY,
    base_url = SAMBANOVA_BASE_URL,
)

def ask_sambanova(prompt: str) -> str:
    ordered_models = []
    for model in [SAMBANOVA_MODEL, *SAMBANOVA_FALLBACK_MODELS]:
        if model not in ordered_models:
            ordered_models.append(model)

    errors = []
    for model in ordered_models:
        try:
            response = client.with_options(timeout=SAMBANOVA_REQUEST_TIMEOUT).chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are Sentinal AI, an infrastructure monitoring agent.",
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                temperature=0.2,
                max_tokens=SAMBANOVA_MAX_TOKENS
            )
            content = response.choices[0].message.content
            if content:
                return content
            errors.append(f"{model}: empty response")
        except Exception as exc:
            errors.append(f"{model}: {type(exc).__name__}: {exc}")

    raise RuntimeError("All SambaNova models failed. " + " | ".join(errors))
