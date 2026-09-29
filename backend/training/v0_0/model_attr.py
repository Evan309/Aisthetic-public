import torch.nn as nn
from transformers import CLIPVisionModel
from backend.utils.logger import init_logger

logger = init_logger("model_attr")

class FashionCLIPAttr(nn.Module):
    def __init__(self, num_type, num_color, num_style):
        super().__init__()
        self.backbone = CLIPVisionModel.from_pretrained("openai/clip-vit-base-patch32")
        hidden = self.backbone.config.hidden_size  # typically 768
        self.type_head  = nn.Linear(hidden, num_type)
        self.color_head = nn.Linear(hidden, num_color)
        self.style_head = nn.Linear(hidden, num_style)
        logger.info(f"FashionCLIPAttr initialized with {num_type} types, {num_color} colors, {num_style} styles")

    def forward(self, images):
        feats = self.backbone(images).pooler_output
        logger.info(f"Feats shape: {feats.shape}")
        return {
            "type":  self.type_head(feats),
            "color": self.color_head(feats),
            "style": self.style_head(feats)
        }