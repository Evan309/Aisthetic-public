import re, json, os
import spacy, spacy.cli
import logging
import torch

from backend.utils.embedding_client import EmbeddingClient
from dotenv import load_dotenv
from difflib import SequenceMatcher


load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

# implement nlp approach to avoid misclassification of cross words (pullover)
class CategoryMapper:
    def __init__(self):
        self.embedder = EmbeddingClient(model = "AnnaWegmann/Style-Embedding")
        self.rules_path = os.getenv("GLOBAL_CATEGORY_MAP")

        logging.info("loading nlp")
        spacy.cli.download("en_core_web_lg")
        self.nlp = spacy.load("en_core_web_lg")
        logging.info("nlp successfully loaded")

        logging.info("loading global catgory rules")
        self.rules = json.load(open(self.rules_path, "r", encoding="utf-8"))
        logging.info(f"loaded {len(self.rules)} global category rules")

        self.canonical_flat = [
            sub for main_cat in self.rules.keys() for sub in self.rules[main_cat].keys()
        ]
        logging.info(f"loaded {len(self.canonical_flat)} canonical categories")
        self.canonical_embs = self.embedder.embed_texts(self.canonical_flat)

        self.gender_keywords = {
            "Men": ["men", "male", "gentleman", "boy", "man"],
            "Women": ["women", "female", "lady", "girl", "woman"],
            "Unisex": ["unisex", "universal", "both", "neutral", "unisex"],
        }

        self.category_centroids = {}
        for main_cat, subs in self.rules.items():
            # Gather representative texts (main + sub + keywords)
            examples = [main_cat] + list(subs.keys())
            for sub, kws in subs.items():
                examples.extend(kws)
            self.category_centroids[main_cat] = self.embedder.embed_texts(examples).mean(dim=0)


    def infer_main_category(self, phrase: str) -> tuple[str, float]:
        phrase = phrase.lower().strip()
        emb = self.embedder.embed_one(phrase)
        emb = torch.nn.functional.normalize(emb, dim=0)

        sims = {}
        for cat, centroid in self.category_centroids.items():
            centroid_norm = torch.nn.functional.normalize(centroid, dim=0)
            sim = self.embedder.similarity(emb, centroid_norm.unsqueeze(0)).item()
            sims[cat] = sim

        # --- Apply lexical cue boosts ---
        lexical_boost = {
            "Clothing": ["shirt", "hoodie", "sweater", "pant", "dress", "skirt", "top", "coat", "jacket"],
            "Shoes":    ["shoe", "boot", "sneaker", "trainer", "heel", "loafers", "mule"],
            "Bags":     ["bag", "tote", "crossbody", "backpack", "wallet", "duffel"],
            "Accessories": ["bracelet", "ring", "watch", "belt", "hat", "beanie", "scarf", "glasses"]
        }

        for cat, cues in lexical_boost.items():
            if any(re.search(rf"\b{cue}\b", phrase) for cue in cues):
                sims[cat] += 0.2  # strong lexical cue boost

        # --- Normalize scores ---
        all_vals = torch.tensor(list(sims.values()))
        sims_z = {k: (v - all_vals.mean().item()) / (all_vals.std().item() + 1e-6)
                for k, v in sims.items()}

        best_cat = max(sims_z, key=sims_z.get)
        confidence = sims_z[best_cat]

        # --- Threshold to reject weak bias toward "Bags" ---
        if best_cat == "Bags" and confidence < 0.5:
            # find next best that differs significantly
            alt = sorted(sims_z.items(), key=lambda kv: kv[1], reverse=True)[1]
            if alt[1] > confidence * 0.9:
                best_cat, confidence = alt

        logging.info(f"semantic category inference {phrase} → {best_cat} (score={confidence:.3f})")
        return best_cat, confidence


    def get_nouns(self, text: str) -> list[str]:
        """
        Extracts fashion/product-relevant noun phrases.
        Handles multiword compounds like 'cargo shorts', 'crossbody bag', 'tote bag', etc.
        Includes VERB compounds if semantically close to canonical categories.
        """
        doc = self.nlp(text)
        nouns = set()

        for chunk in doc.noun_chunks:
            phrase = chunk.text.strip()
            if len(phrase.split()) <= 4 and any(tok.is_alpha for tok in chunk):
                nouns.add(phrase.lower())

        for tok in doc:
            if tok.pos_ in {"NOUN", "PROPN"} and tok.is_alpha:
                nouns.add(tok.lemma_.lower())

        for tok in doc:
            head = tok.head
            if tok.dep_ in {"compound", "amod"} and head.is_alpha:
                if tok.pos_ in {"NOUN", "ADJ", "PROPN"} and head.pos_ in {"NOUN", "PROPN"}:
                    phrase = f"{tok.text} {head.text}".lower()
                    nouns.add(phrase)

                elif tok.pos_ == "VERB" and head.pos_ in {"NOUN", "PROPN"}:
                    phrase = f"{tok.text} {head.text}".lower()
                    try:
                        emb = self.embedder.embed_one(phrase)
                        sims = self.embedder.similarity(emb, self.canonical_embs)[0]
                        if sims.max().item() > 0.3:
                            nouns.add(phrase)
                    except Exception as e:
                        logging.warning(f"Embedding check failed for phrase '{phrase}': {e}")

        generic_words = {
            "men", "women", "male", "female", "unisex",
            "style", "collection", "design", "new", "fashion", "look"
        }
        nouns = {n for n in nouns if all(w not in generic_words for w in n.split())}

        clean_nouns = sorted(nouns)
        logging.info(f"nouns identified: {clean_nouns}")
        return clean_nouns

    def detect_gender(self, text: str) -> str:
        t = text.lower()
        for gender, keys in self.gender_keywords.items():
            for k in keys:
                if re.search(rf"\b{k}\b", t):
                    return gender
        return "Unisex"


    def normalize(self, raw_label: str, semantic_fallback: bool = True):
        if not raw_label:
            return {"category_main": "Other", "category_sub": "Other", "gender": "Unisex"}

        t = raw_label.lower()
        gender = self.detect_gender(t)
        nouns = self.get_nouns(t)

        if not nouns:
            nouns = [t]

        # 1️⃣ Detect main category using cues
        main_heads = {
            "clothing": ["clothing", "apparel", "garment", "hoodie", "sweater", "jacket", "shirt", "pant", "dress", "top"],
            "shoes": ["shoe", "sneaker", "boot", "heel", "loafer"],
            "bags": ["bag", "backpack", "tote", "duffel", "crossbody"],
            "accessories": ["bracelet", "watch", "belt", "scarf", "hat", "beanie", "ring", "sunglass"],
        }

        main_cat = None
        for cat, cues in main_heads.items():
            if any(cue in n for cue in cues for n in nouns):
                main_cat = cat.capitalize()
                logging.info(f"main category cue match → {main_cat}")
                break

        # 2️⃣ If main category is found → remove its cue words before subcategory matching
        if main_cat:
            main_cues = main_heads[main_cat.lower()]

            # only remove nouns that are EXACT cue words, not part of longer phrases
            filtered_nouns = []
            for n in nouns:
                # split by spaces to check if it's a single-word cue
                if n.strip() in main_cues and len(n.split()) == 1:
                    continue
                filtered_nouns.append(n)

            if not filtered_nouns:
                filtered_nouns = nouns  # fallback if everything was stripped

            logging.info(f"filtered nouns: {filtered_nouns}")

            # Match subcategories by keyword inclusion in either direction
            for sub_cat, keywords in self.rules[main_cat].items():
                if any(noun in keywords or any(k in noun for k in keywords) for noun in filtered_nouns):
                    return {
                        "category_main": main_cat,
                        "category_sub": sub_cat,
                        "gender": gender,
                    }


        # 3️⃣ Rule-based subcategory check (if no main_cat identified)
        for main_cat, subs in self.rules.items():
            for sub_cat, keywords in subs.items():
                if any(noun in keywords for noun in nouns):
                    return {
                        "category_main": main_cat,
                        "category_sub": sub_cat,
                        "gender": gender,
                    }

        # 4️⃣ Semantic fallback
        if semantic_fallback:
            # Step 1: infer main category first (semantic)
            best_main, main_conf = self.infer_main_category(raw_label)

            # Step 2: embed only subcategories from that main category
            sub_keys = list(self.rules.get(best_main, {}).keys())

            if sub_keys:
                emb_label = self.embedder.embed_one(raw_label)
                emb_subs = self.embedder.embed_texts(sub_keys)

                sims = self.embedder.similarity(emb_label, emb_subs)[0]
                best_idx = sims.argmax().item()
                best_sub = sub_keys[best_idx]
                sub_conf = sims[best_idx].item()
            else:
                best_sub, sub_conf = "Other", 0.0

            # Step 3: return semantically inferred result
            return {
                "category_main": best_main,
                "category_sub": best_sub,
                "gender": gender,
            }

        # 5️⃣ Default fallback
        return {"category_main": "Other", "category_sub": "Other", "gender": gender}


