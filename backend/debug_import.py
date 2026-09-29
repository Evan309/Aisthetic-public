
import sys
import os
sys.path.append(os.getcwd())

try:
    from api.routers import products
    print("Import products successful")
except Exception as e:
    print(f"Import products failed: {e}")
    import traceback
    traceback.print_exc()
