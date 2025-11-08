from flask import Flask, request, jsonify
import joblib
import numpy as np
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

model = joblib.load("toxic_model.pkl")

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    text = data.get("content")

    if not text:
        return jsonify({"error": "No content provided"}), 400

    proba = float(model.predict_proba([text])[0][1])

    is_toxic = bool(proba > 0.3)  

    return jsonify({
        "is_toxic": bool(is_toxic),  
        "confidence": round(proba, 3)
    })
if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
