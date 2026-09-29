import pandas as pd, joblib, os
from backend.utils.logger import init_logger
from sklearn.preprocessing import LabelEncoder

logger = init_logger("prepare_labels")

# Load dataset safely
try:
    DATA_PATH = "backend/data/kaggle_fashion_dataset/styles.csv"
    logger.info(f"Loading dataset from {DATA_PATH}")

    df = pd.read_csv(DATA_PATH, on_bad_lines="skip", quotechar='"', engine="python")
    logger.info(f"Loaded {len(df)} rows from dataset")

    df = df.dropna(subset=["id","articleType","baseColour","usage"])
    df = df[df["id"].apply(lambda x: str(x).isdigit())]

    logger.info(f"After cleaning: {len(df)} valid rows")

    le_type  = LabelEncoder().fit(df["articleType"])
    le_color = LabelEncoder().fit(df["baseColour"])
    le_style = LabelEncoder().fit(df["usage"])

    os.makedirs("backend/models", exist_ok=True)
    encoders = {"type": le_type, "color": le_color, "style": le_style}
    joblib.dump(encoders, "backend/models/label_encoders.pkl")

    logger.info(f"Encoders saved to backend/models/")
    logger.info(f"Classes → Type: {len(le_type.classes_)} | Color: {len(le_color.classes_)} | Style: {len(le_style.classes_)}")

except Exception as e:
    logger.exception(f"❌ Failed to prepare labels: {e}")
    raise