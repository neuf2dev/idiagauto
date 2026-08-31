import os
import io
import json
import base64
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from PIL import Image

app = FastAPI(title="iDiagAuto API", version="1.3.2")

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

class DiagnosticResponseSchema(BaseModel):
    severity_level: str = Field(description="'RED', 'ORANGE', ou 'GREEN'")
    severity_label: str = Field(description="Ex: Arrêt immédiat, Roulage dégradé, Roulage possible")
    severity_advice: str = Field(description="Conseil court sur la conduite et les risques")
    checklist: List[str] = Field(description="Liste des 3 à 5 contrôles d'atelier prioritaires à réaliser")
    report_markdown: str = Field(description="Rapport technique complet formaté en Markdown")

SYSTEM_INSTRUCTION = """
Tu es iDiagAuto, maître-mécanicien expert et formateur d'atelier.
Tu analyses méthodiquement les pannes et codes DTC pour fournir un rapport technique d'atelier complet.
Dans 'report_markdown', inclus : Analyse technique, Causes probables, Protocole de contrôle électrique/mécanique détaillé, et Pièces suspectes.
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
            user_prompt += "\nUne photo technique est fournie. Analyse-la en détail."
        except Exception as img_err:
            print(f"Erreur décodage image : {img_err}")

    contents.append(user_prompt)

    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.2,
                response_mime_type="application/json",
                response_schema=DiagnosticResponseSchema,
            )
        )

        clean_text = response.text.strip()
        if clean_text.startswith("```"):
            clean_text = clean_text.split("\n", 1)[1].rsplit("\n", 1)[0].strip()

        data = json.loads(clean_text)
        return {
            "vehicle": req.vehicle,
            "dtc_code": req.dtc_code,
            "severity_level": data.get("severity_level", "ORANGE"),
            "severity_label": data.get("severity_label", "Roulage sous surveillance"),
            "severity_advice": data.get("severity_advice", "Effectuer les contrôles d'atelier rapidement."),
            "checklist": data.get("checklist", []),
            "report": data.get("report_markdown", "")
        }
    except Exception as e:
        print(f"Erreur détaillée : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'analyse IA : {str(e)}")

@app.get("/")
def health():
    return {"status": "ok", "app": "iDiagAuto API"}