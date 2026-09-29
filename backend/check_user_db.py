import sys
import traceback
import os

with open("db_check_output.txt", "w") as f:
    f.write("Starting script...\n")
    try:
        sys.path.append(os.getcwd())
        from db.session import SessionLocal
        from db.models import User, Closet

        f.write("Imported db modules.\n")

        db = SessionLocal()
        email = "evaniscool309@gmail.com"
        f.write(f"Checking for user: {email}\n")
        user = db.query(User).filter(User.email == email).first()

        if user:
            f.write(f"User FOUND: ID={user.id} Email={user.email}\n")
            closets = db.query(Closet).filter(Closet.user_id == user.id).all()
            f.write(f"Closet Count: {len(closets)}\n")
        else:
            f.write("User NOT FOUND\n")

    except Exception:
        f.write(traceback.format_exc())
        sys.exit(1)
