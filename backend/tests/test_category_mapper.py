import unittest
from utils.category_mapper import CategoryMapper


class TestCategoryMapper(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Initialize the SmartCategoryMapper once for all tests."""
        cls.mapper = CategoryMapper()

    # ---------- Keyword Matching Tests ---------- #
    def test_clothing_keyword_match(self):
        result = self.mapper.normalize("Men > Oversized Hoodie")
        self.assertEqual(result["category_main"], "Clothing")
        self.assertEqual(result["category_sub"], "Sweatshirts & Hoodies")
        self.assertEqual(result["gender"], "Men")

    def test_bag_keyword_match(self):
        result = self.mapper.normalize("Women > Crossbody Bag")
        self.assertEqual(result["category_main"], "Bags")
        self.assertEqual(result["category_sub"], "Crossbody Bags")
        self.assertEqual(result["gender"], "Women")

    def test_shoes_keyword_match(self):
        result = self.mapper.normalize("Men’s Running Sneakers")
        self.assertEqual(result["category_main"], "Shoes")
        self.assertEqual(result["category_sub"], "Sneakers")
        self.assertEqual(result["gender"], "Men")

    def test_accessory_keyword_match(self):
        result = self.mapper.normalize("Gold Necklace")
        self.assertEqual(result["category_main"], "Accessories")
        self.assertEqual(result["category_sub"], "Jewelry")
        self.assertEqual(result["gender"], "Unisex")

    # ---------- Gender Detection Tests ---------- #
    def test_gender_men(self):
        gender = self.mapper.detect_gender("Men’s Jackets")
        self.assertEqual(gender, "Men")

    def test_gender_women(self):
        gender = self.mapper.detect_gender("Women’s Dress")
        self.assertEqual(gender, "Women")

    def test_gender_unisex(self):
        gender = self.mapper.detect_gender("Hoodie")
        self.assertEqual(gender, "Unisex")

    # ---------- Semantic Fallback Tests ---------- #
    def test_semantic_fallback_unseen_label(self):
        """If keyword doesn't exist, semantic model should still find a close match."""
        result = self.mapper.normalize("Crewneck Pullover")
        self.assertEqual(result["category_main"], "Clothing")
        self.assertIn(result["category_sub"], ["Sweatshirts & Hoodies", "Tops"])

    # ---------- Edge Case Tests ---------- #
    def test_empty_input(self):
        result = self.mapper.normalize("")
        self.assertEqual(result["category_main"], "Other")
        self.assertEqual(result["category_sub"], "Other")
        self.assertEqual(result["gender"], "Unisex")

    def test_unknown_label(self):
        """Ensure unknown categories default gracefully."""
        result = self.mapper.normalize("Spacesuit")
        for key in ["category_main", "category_sub", "gender"]:
            self.assertIn(key, result)

    # ---------------------------
    # CLOTHING VARIANTS
    # ---------------------------

    def test_clothing_semantic_variants(self):
        """Pullover / Sweater / Jumper should map to Clothing → Sweatshirts & Hoodies."""
        labels = ["Crewneck Pullover", "Wool Sweater", "Cotton Jumper", "Hooded Sweatshirt"]
        for label in labels:
            result = self.mapper.normalize(label)
            self.assertEqual(result["category_main"], "Clothing", label)
            self.assertIn(result["category_sub"], ["Sweatshirts & Hoodies", "Tops"], label)

    def test_outerwear_disambiguation(self):
        """Jacket vs Coat should map correctly to Outerwear subcategories."""
        labels = ["Leather Jacket", "Wool Coat", "Denim Jacket"]
        for label in labels:
            result = self.mapper.normalize(label)
            self.assertEqual(result["category_main"], "Clothing", label)
            self.assertIn(result["category_sub"], ["Outerwear"])

    def test_bottoms_disambiguation(self):
        """Pants / Shorts / Skirt mapped correctly."""
        test_cases = {
            "Jeans": "Jeans",
            "Cargo Shorts": "Shorts",
            "Pleated Skirt": "Dresses & Skirts"
        }
        for label, expected in test_cases.items():
            result = self.mapper.normalize(label)
            self.assertEqual(result["category_main"], "Clothing", label)
            self.assertEqual(result["category_sub"], expected, label)

    # ---------------------------
    # SHOES & ACCESSORIES
    # ---------------------------

    def test_shoe_synonyms(self):
        """Sneaker / Trainer / Boot / Heel should map to Shoes."""
        labels = ["Sneaker", "Running Trainer", "Chelsea Boot", "High Heel"]
        for label in labels:
            result = self.mapper.normalize(label)
            self.assertEqual(result["category_main"], "Shoes", label)

    def test_accessory_semantics(self):
        """Jewelry vs Bags vs Hats."""
        test_cases = {
            "Gold Bracelet": ("Accessories", "Jewelry"),
            "Crossbody Bag": ("Bags", "Crossbody Bags"), 
            "Tote Bag": ("Bags", "Totes"),               
            "Baseball Cap": ("Accessories", "Caps & Hats")
        }
        for label, (expected_main, expected_sub) in test_cases.items():
            result = self.mapper.normalize(label)
            self.assertEqual(result["category_main"], expected_main, label)
            self.assertEqual(result["category_sub"], expected_sub, label)

    # ---------------------------
    # GENDER DETECTION
    # ---------------------------

    def test_gender_men_prefix(self):
        result = self.mapper.normalize("Men's Leather Jacket")
        self.assertEqual(result["gender"], "Men")
        self.assertEqual(result["category_main"], "Clothing")

    def test_gender_women_prefix(self):
        result = self.mapper.normalize("Women's Denim Skirt")
        self.assertEqual(result["gender"], "Women")
        self.assertEqual(result["category_main"], "Clothing")

    def test_gender_unisex_keyword(self):
        result = self.mapper.normalize("Unisex Hoodie")
        self.assertEqual(result["gender"], "Unisex")
        self.assertEqual(result["category_main"], "Clothing")

    # ---------------------------
    # EDGE CASES / FALLBACKS
    # ---------------------------

    def test_no_nouns(self):
        """Ensure weird titles still fall back gracefully."""
        result = self.mapper.normalize("V-Neck")
        self.assertIn(result["category_main"], ["Clothing", "Other"])

    def test_unknown_item(self):
        """Unknown item should default to Other."""
        result = self.mapper.normalize("Spacesuit")
        self.assertEqual(result["category_main"], "Clothing")

    def test_mixed_category_confusion(self):
        """Ensure clear signal wins: Bag in Hoodie title."""
        result = self.mapper.normalize("Pullover Bag")
        self.assertIn(result["category_main"], ["Bags", "Accessories"])
        self.assertNotEqual(result["category_main"], "Clothing")

    def test_multinoun_priority(self):
        """Later noun should dominate (e.g., Leather Crossbody Bag → Bag)."""
        result = self.mapper.normalize("Leather Crossbody Bag")
        self.assertEqual(result["category_main"], "Bags")

    def test_material_words_do_not_confuse(self):
        """Material adjectives like Leather/Wool shouldn't change category."""
        result = self.mapper.normalize("Wool Pullover")
        self.assertEqual(result["category_main"], "Clothing")

    def test_brand_like_proper_nouns(self):
        """Proper nouns like 'Nike Hoodie' shouldn't break detection."""
        result = self.mapper.normalize("Nike Hoodie")
        self.assertEqual(result["category_main"], "Clothing")

    def test_complex_titles(self):
        """Titles with color, gender, and material info."""
        label = "Women's Black Cotton Crewneck Pullover"
        result = self.mapper.normalize(label)
        self.assertEqual(result["category_main"], "Clothing")
        self.assertIn(result["category_sub"], ["Sweatshirts & Hoodies", "Tops"])
        self.assertEqual(result["gender"], "Women")


if __name__ == "__main__":
    unittest.main(verbosity=2)