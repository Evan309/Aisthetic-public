import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.db.ingestion.full_musinsa_ingestion_pipeline import run_pipeline

async def run_test():
    checkpoint_file = "backend/tests/test_checkpoint.json"
    
    # Clean previous test state
    if os.path.exists(checkpoint_file):
        os.remove(checkpoint_file)

    print("Running Full Pipeline Test (Limited natively to exactly 4 pages -> 2 batches)")
    
    # We set a limit of 1000 items per category to avoid stopping by product limit.
    # We statically strictly cap at 4 total pages to enforce exactly 2 2-page batches to occur.
    try:
        await run_pipeline(
            checkpoint_path=checkpoint_file,
            headless=True,
            limit=1000,
            max_pages=4,
            wipe=True
        )
    except KeyboardInterrupt:
        print("Test Pipeline Safely Interrupted.")

if __name__ == "__main__":
    asyncio.run(run_test())
