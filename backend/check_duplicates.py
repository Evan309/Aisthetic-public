import sys
import os

with open("duplicates_output.txt", "w") as f:
    try:
        sys.path.append(os.getcwd())
        from db.session import SessionLocal
        from db.models import User

        db = SessionLocal()
        email = "evaniscool309@gmail.com"
        f.write(f"Checking for email: {email}\n")
        
        users = db.query(User).filter(User.email == email).all()

        f.write(f"Found {len(users)} users with email {email}:\n")
        for u in users:
            f.write(f"ID: {u.id}, Auth0 ID: {u.auth0_id}, Email: {u.email}, Name: {u.name}\n")
            
    except Exception as e:
        f.write(f"Error: {e}\n")

