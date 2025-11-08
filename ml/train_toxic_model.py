import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report
import joblib

# 1️⃣ Load dataset
data = pd.read_csv("train.csv")
data = data[["comment_text", "toxic"]]  
data["comment_text"] = data["comment_text"].fillna("")

X_train, X_test, y_train, y_test = train_test_split(
    data["comment_text"], data["toxic"], test_size=0.2, random_state=42
)

model = Pipeline([
    ("tfidf", TfidfVectorizer(max_features=50000, stop_words="english")),
    ("clf", LogisticRegression(max_iter=300))
])

print("Training model... please wait")
model.fit(X_train, y_train)


preds = model.predict(X_test)
print("\nModel Evaluation:")
print(classification_report(y_test, preds))


joblib.dump(model, "toxic_model.pkl")
print("\nModel saved as toxic_model.pkl")
