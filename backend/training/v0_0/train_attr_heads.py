import torch, torch.nn.functional as F
from torch.utils.data import DataLoader, random_split
from tqdm import tqdm
import joblib, os, numpy as np, json
from backend.training.v0_0.dataset import FashionDataset
from backend.training.v0_0.model_attr import FashionCLIPAttr
from backend.utils.logger import init_logger


def main():
    logger = init_logger("train_attr_heads")

    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        os.makedirs("backend/models", exist_ok=True)
        logger.info(f"Using device: {device}")

        encoders = joblib.load("backend/models/label_encoders.pkl")
        num_type, num_color, num_style = [len(encoders[k].classes_) for k in ["type","color","style"]]
        logger.info(f"Loaded encoders → Types: {num_type}, Colors: {num_color}, Styles: {num_style}")

        dataset = FashionDataset(
            "backend/data/kaggle_fashion_dataset/styles.csv",
            "backend/data/kaggle_fashion_dataset/images",
            encoders,
        )

        train_len = int(0.8 * len(dataset))
        train_set, val_set = random_split(dataset, [train_len, len(dataset) - train_len])

        # 👉 Use num_workers=0 on macOS
        train_loader = DataLoader(train_set, batch_size=16, shuffle=True, num_workers=0)
        val_loader = DataLoader(val_set, batch_size=16, num_workers=0)

        model = FashionCLIPAttr(num_type, num_color, num_style).to(device)
        opt = torch.optim.AdamW(model.parameters(), lr=2e-5)
        best_acc, history = 0.0, {}

        logger.info("🚀 Starting training loop...")
        for epoch in range(3):
            model.train()
            train_loss = 0.0
            logger.info(f"📘 Epoch {epoch+1}/3 started")

            for imgs, y_t, y_c, y_s in tqdm(train_loader, desc=f"Epoch {epoch+1}"):
                imgs, y_t, y_c, y_s = imgs.to(device), y_t.to(device), y_c.to(device), y_s.to(device)
                logits = model(imgs)
                loss = (
                    F.cross_entropy(logits["type"], y_t)
                    + F.cross_entropy(logits["color"], y_c)
                    + F.cross_entropy(logits["style"], y_s)
                ) / 3
                opt.zero_grad(); loss.backward(); opt.step()
                train_loss += loss.item()

            avg_loss = train_loss / len(train_loader)
            logger.info(f"Epoch {epoch+1} 🔁 Training Loss: {avg_loss:.4f}")

            # validation
            model.eval()
            correct = {"type": 0, "color": 0, "style": 0}
            total = 0
            with torch.no_grad():
                for imgs, y_t, y_c, y_s in val_loader:
                    imgs, y_t, y_c, y_s = imgs.to(device), y_t.to(device), y_c.to(device), y_s.to(device)
                    logits = model(imgs)
                    total += imgs.size(0)
                    correct["type"]  += (logits["type"].argmax(1)  == y_t).sum().item()
                    correct["color"] += (logits["color"].argmax(1) == y_c).sum().item()
                    correct["style"] += (logits["style"].argmax(1) == y_s).sum().item()

            val_acc = {k: correct[k] / total for k in correct}
            history[epoch] = val_acc
            logger.info(f"📊 Val Acc — Type: {val_acc['type']:.3f}, Color: {val_acc['color']:.3f}, Style: {val_acc['style']:.3f}")

            mean_acc = np.mean(list(val_acc.values()))
            if mean_acc > best_acc:
                best_acc = mean_acc
                torch.save(model.state_dict(), "backend/models/fashion_clip_attr.pt")
                logger.info(f"✅ New best model saved with mean acc={best_acc:.4f}")

        with open("backend/models/metrics.json", "w") as f:
            json.dump(history, f, indent=2)
        logger.info("🏁 Training complete.")
    except Exception as e:
        logger.exception(f"❌ Training failed: {e}")
        raise


if __name__ == "__main__":
    torch.multiprocessing.set_start_method("spawn", force=True)
    main()
