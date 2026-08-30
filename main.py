import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="iDiagAuto API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """
Tu es un mecanicien automobile expert et pedagogue. 
Ton role est d'analyser un code defaut (DTC OBD-II) et/ou des symptomes decrits par l'utilisateur pour un vehicule donne.

Fournis une reponse structuree, concise et technique selon ce plan exact :
1. **Signification du code / Analyse rapide** : Explication claire en 1-2 phrases.
2. **Causes les plus probables** : Liste a puces ordonnee par frequence constatee en atelier.
3. **Protocole de controle pas-a-pas** :
   - Controles visuels (faisceau, connecteurs, fuites).
   - Mesures electriques recommandees (ex : multimetre, continuite, tension d'alimentation, resistance cible).
4. **Pieces a suspecter** : Preciser de toujours tester avant de remplacer a l'aveugle.

Reste factuel, rigoureux, sans jargon inutile, et adapte au modele precis mentionne.
"""

class DiagnosticRequest(BaseModel):
    vehicle: str
    dtc_code: str = ""
    symptoms: str = ""

@app.post("/api/diagnose")
async def diagnose(request: DiagnosticRequest):
    if not request.dtc_code and not request.symptoms:
        raise HTTPException(
            status_code=400, 
            detail="Precise au moins un code defaut (DTC) ou des symptomes."
        )

    user_content = f"Vehicule : {request.vehicle}\n"
    if request.dtc_code:
        user_content += f"Code defaut OBD : {request.dtc_code}\n"
    if request.symptoms:
        user_content += f"Symptomes observes : {request.symptoms}\n"

    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=user_content,
            config={
                "system_instruction": SYSTEM_PROMPT,
                "temperature": 0.3,
            }
        )
        return {"report": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))