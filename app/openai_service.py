import base64
from openai import OpenAI
import os

# API key should be set in environment
def get_client():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        # In a real app, we'd handle this better.
        # For now, we'll return a dummy or let it fail later.
        return None
    return OpenAI(api_key=api_key)

def encode_image(image_path):
  with open(image_path, "rb") as image_file:
    return base64.b64encode(image_file.read()).decode('utf-8')

def solve_math_problem(image_path: str):
    """
    Sends the image to GPT-4o and requests a step-by-step math solution.
    """
    client = get_client()
    if not client:
        return "Error: OPENAI_API_KEY not set. Please set the environment variable to solve problems."

    base64_image = encode_image(image_path)

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a helpful math teacher. Your task is to solve the math problem "
                    "in the provided image. Provide a step-by-step solution, a clear explanation "
                    "of the methods used, and state the final answer clearly. "
                    "Format your response in Markdown."
                )
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Please solve this math problem step-by-step."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}",
                        },
                    },
                ],
            }
        ],
        max_tokens=1000,
    )

    return response.choices[0].message.content
