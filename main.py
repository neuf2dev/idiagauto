import os
import io
import json
import base64
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
from PIL import Image

app = FastAPI(title="iDiagAuto API", version="1.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("La variable d'environnement GEMINI_API_KEY n'est pas configurée.")

client = genai.Client(api_key=API_KEY)

class DiagnosticRequest(BaseModel):
    vehicle: str
    dtc_code: Optional[str] = ""
    symptoms: Optional[str] = ""
    image_base64: Optional[str] = None

SYSTEM_INSTRUCTION = """
Tu es iDiagAuto, un maître-mécanicien expert et formateur d'atelier automobile.
Tu analyses les pannes et codes DTC. Tu dois OBLIGATOIREMENT répondre sous forme d'un objet JSON strict valide sans texte avant ni après, avec la structure suivante :

{
  "severity_level": "RED" | "ORANGE" | "GREEN",
  "severity_label": "Arrêt immédiat" | "Roulage dégradé / Atelier rapide" | "Roulage possible / Défaut mineur",
  "severity_advice": "Phrase courte expliquant le danger mécanique ou la sécurité routière.",
  "checklist": [
    "Contrôler la tension batterie (doit être > 12.4V au repos)",
    "Mesurer la continuité et la masse sur le faisceau...",
    "Vérifier l'état mécanique / visuel de..."
  ],
  "report_markdown": "Le rapport technique complet et détaillé en Markdown avec sections : Analyse technique, Causes probables, Protocole multimètre détaillé, Pièces à suspecter."
}
"""

@app.post("/api/diagnose")
async def diagnose(req: DiagnosticRequest):
    if not req.vehicle.strip():
        raise HTTPException(status_code=400, detail="Le modèle du véhicule est obligatoire.")

    user_prompt = f"Véhicule : {req.vehicle}\n"
    if req.dtc_code:
        user_prompt += f"Code défaut (DTC) : {req.dtc_code}\n"
    if req.symptoms:
        user_prompt += f"Symptômes : {req.symptoms}\n"

    contents = []

    if req.image_base64:
        try:
            if "," in req.image_base64:
                img_data = req.image_base64.split(",")[1]
            else:
                img_data = req.image_base64
            
            image_bytes = base64.b64decode(img_data)
            img = Image.open(io.BytesIO(image_bytes))
            contents.append(img)
            user_prompt += "\nUne photo est fournie. Analyse-la précisément dans le rapport."
        except Exception as img_err:
            print(f"Erreur image : {img_err}")

    contents.append(user_prompt)

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.2,
                response_mime_type="application/json"
            )
        )
        data = json.loads(response.text)
        return {
            "vehicle": req.vehicle,
            "dtc_code": req.dtc_code,
            "severity_level": data.get("severity_level", "ORANGE"),
            "severity_label": data.get("severity_label", "Roulage avec précaution"),
            "severity_advice": data.get("severity_advice", "Effectuer les contrôles avant long trajet."),
            "checklist": data.get("checklist", []),
            "report": data.get("report_markdown", response.text)
        }
    except Exception as e:
        print(f"Erreur Gemini : {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'analyse IA.")

@app.get("/")
def health():
    return {"status": "ok", "app": "iDiagAuto API"}