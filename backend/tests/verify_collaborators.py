import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from db.session import SessionLocal, engine
from db.models import Base, User, Closet, ClosetCollaborator
from api.schemas import ClosetResponse, ClosetSummaryResponse

def verify_collaborators():
    created_ids = {"users": [], "closets": []}
    db = SessionLocal()

    try:
        # Find a closet with collaborators
        closet_with_collabs = db.query(Closet).join(ClosetCollaborator).first()
        
        if not closet_with_collabs:
            print("No existing closet with collaborators found. Creating dummy data...")
            
            # Create Owner
            owner = User(auth0_id="test|owner", email="owner@test.com", name="Test Owner")
            db.add(owner)
            db.flush()
            created_ids["users"].append(owner.id)
            
            # Create Collaborator
            collab_user = User(auth0_id="test|collab", email="collab@test.com", name="Test Collaborator")
            db.add(collab_user)
            db.flush()
            created_ids["users"].append(collab_user.id)
            
            # Create Closet
            closet = Closet(name="Test Closet", user_id=owner.id, description="Test Description")
            db.add(closet)
            db.flush()
            created_ids["closets"].append(closet.id)
            
            # Add Collaborator
            collaboration = ClosetCollaborator(closet_id=closet.id, user_id=collab_user.id, role="editor")
            db.add(collaboration)
            db.commit()
            
            print(f"Created dummy closet {closet.id} with owner {owner.id} and collaborator {collab_user.id}")
            closet_with_collabs = closet

        print(f"Testing Closet ID: {closet_with_collabs.id}")

        # Fetch using schema logic (simulation)
        # In reality we should hit the API, but testing the ORM fetching logic here is a good proxy 
        # for what we changed in routers/closets.py
        
        owner = db.query(User).filter(User.id == closet_with_collabs.user_id).first()
        collabs = db.query(ClosetCollaborator).filter_by(closet_id=closet_with_collabs.id).all()
        
        print(f"Owner: {owner.name} ({owner.email})")
        print(f"Collaborators Count: {len(collabs)}")
        
        for c in collabs:
            u = db.query(User).filter(User.id == c.user_id).first()
            print(f" - {u.name} ({c.role})")

        # Verify we can construct the response object with new fields
        # This confirms Pydantic schema is happy
        
        collab_list = []
        for c in collabs:
             u = db.query(User).filter(User.id == c.user_id).first()
             collab_list.append({
                "user_id": c.user_id,
                "role": c.role,
                "username": u.name
             })

        response = ClosetResponse(
            id=closet_with_collabs.id,
            name=closet_with_collabs.name,
            description=closet_with_collabs.description,
            slug=closet_with_collabs.slug,
            user_id=closet_with_collabs.user_id,
            view_token=closet_with_collabs.view_token,
            edit_token=closet_with_collabs.edit_token,
            items=[],
            owner={
                "id": owner.id, 
                "auth0_id": owner.auth0_id,
                "email": owner.email,
                "name": owner.name,
                "profile_picture_url": owner.profile_picture_url
            },
            collaborators=collab_list
        )
        
        print("\n✅ ClosetResponse construction successful:")
        print(response.model_dump_json(indent=2, exclude={'items'}))

    except Exception as e:
        print(f"\n❌ Verification Failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        if created_ids["closets"]:
            print("\nCleaning up dummy closets...")
            db.query(ClosetCollaborator).filter(ClosetCollaborator.closet_id.in_(created_ids["closets"])).delete(synchronize_session=False)
            db.query(Closet).filter(Closet.id.in_(created_ids["closets"])).delete(synchronize_session=False)
        
        if created_ids["users"]:
             print("Cleaning up dummy users...")
             db.query(User).filter(User.id.in_(created_ids["users"])).delete(synchronize_session=False)
        
        db.commit()
        db.close()

if __name__ == "__main__":
    verify_collaborators()
