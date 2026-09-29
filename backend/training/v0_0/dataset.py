import pandas as pd, torch
from PIL import Image
from torch.utils.data import Dataset
from torchvision import transforms
from backend.utils.logger import init_logger

logger = init_logger("dataset")

class FashionDataset(Dataset):
    def __init__(self, csv_path, img_dir, label_encoders):
        self.img_dir = img_dir
        self.label_encoders = label_encoders

        # ---- Safe CSV loading ----
        try:
            self.df = pd.read_csv(
                csv_path,
                on_bad_lines="skip",   # skip bad rows
                quotechar='"',
                engine="python",       # more tolerant parser
            )
            logger.info(f"Loaded {len(self.df)} rows from {csv_path}")
        except Exception as e:
            logger.exception(f"❌ Failed to load CSV: {e}")
            raise

        # ---- Clean data ----
        if not all(col in self.df.columns for col in ["id", "articleType", "baseColour", "usage"]):
            missing = [c for c in ["id","articleType","baseColour","usage"] if c not in self.df.columns]
            raise KeyError(f"Missing required columns: {missing}")

        self.df = self.df.dropna(subset=["id", "articleType", "baseColour", "usage"])
        self.df = self.df[self.df["id"].apply(lambda x: str(x).isdigit())]

        logger.info(f"After cleaning: {len(self.df)} valid rows")

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.5]*3, [0.5]*3)
        ])

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        img_path = f"{self.img_dir}/{row['id']}.jpg"
        try:
            image = Image.open(img_path).convert("RGB")
        except Exception as e:
            logger.warning(f"⚠️ Failed to load image {img_path}: {e}")
            image = Image.new("RGB", (224,224), color=(0,0,0))

        image = self.transform(image)

        y_type  = self.label_encoders["type"].transform([row["articleType"]])[0]
        y_color = self.label_encoders["color"].transform([row["baseColour"]])[0]
        y_style = self.label_encoders["style"].transform([row["usage"]])[0]

        return image, torch.tensor(y_type), torch.tensor(y_color), torch.tensor(y_style)
