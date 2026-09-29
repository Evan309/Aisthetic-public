import sys
from unittest.mock import MagicMock, patch
from auth.dependencies import get_or_create_user
from db.models import User

# Mock User model behaviors if needed, though simple instantiation is usually fine
# Since we are mocking the DB, we don't need to actually instantiate SQLAlchemy models connected to a DB.
# But we do need to instantiate User objects to return them.

def test_missing_data_population():
    print("Test 1: Missing Data Population")
    mock_db = MagicMock()
    
    # Setup mock query behavior
    # First query checks auth0_id -> returns None (user not found)
    # Second query (if reached) checks email -> returns None (user not found)
    mock_db.query.return_value.filter.return_value.first.return_value = None
    
    payload = {"sub": "auth0|123", "nickname": "testuser"} # no email
    token = "mock_token"
    
    with patch("requests.get") as mock_get:
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "email": "fetched@example.com",
            "name": "Fetched Name",
            "picture": "http://pfp.com",
            "email_verified": True
        }
        
        user = get_or_create_user(mock_db, payload, token)
        
        # Verify fetched
        mock_get.assert_called()
        print("  [PASS] Fetched userinfo from Auth0")
        
        # Verify user creation attributes
        # get_or_create_user returns the object passed to db.add
        # We need to capture the argument passed to db.add
        args, _ = mock_db.add.call_args
        created_user = args[0]
        
        if created_user.email != "fetched@example.com":
            raise AssertionError(f"Expected email fetched@example.com, got {created_user.email}")
        print("  [PASS] Created user has fetched email")
        
        if created_user.name != "Fetched Name":
            raise AssertionError(f"Expected name Fetched Name, got {created_user.name}")
        print("  [PASS] Created user has fetched name")

def test_account_linking():
    print("\nTest 2: Account Linking")
    mock_db = MagicMock()
    
    # Scenario:
    # 1. User with auth0_id="google|2" NOT found.
    # 2. User with email="test@example.com" FOUND.
    
    existing_user = User(id=1, auth0_id="auth0|1", email="test@example.com", name="User 1")
    
    # We need to mock the chained query calls carefully.
    # db.query(User).filter(User.auth0_id == ...).first() -> None
    # db.query(User).filter(User.email == ...).first() -> existing_user
    
    # Create a side_effect function for first()
    # It depends on what filter was called prior.
    # This is tricky with chained mocks. 
    # Simpler approach: Check what was passed to filter().
    
    # Let's mock the query object returned by db.query(User)
    mock_query = mock_db.query.return_value
    
    def filter_side_effect(*args, **kwargs):
        # returns a new mock object that has a .first() method
        # The arg is a BinaryExpression. formatting str(arg) usually gives "user.auth0_id = :auth0_id_1"
        # But relying on string representation is brittle.
        # Instead, we can observe the order of calls if we know the implementation.
        # 1st call: auth0_id check. 2nd call: email check.
        return mock_filter_result
    
    mock_filter_result = MagicMock()
    # We can use a simplified side effect for .first() based on call count
    # But call count on the SAME mock object accumulates.
    # Implementation does:
    # 1. query(User).filter(ID).first()
    # 2. query(User).filter(Email).first()
    
    # Since query(User) returns the SAME mock_query object each time (default behavior),
    # filter() returns the SAME mock_filter_result (if we set it so).
    # so .first() starts with 0 calls.
    
    # Let's define an iterator for first() return values
    # Call 1: None (Auth0 ID miss)
    # Call 2: existing_user (Email hit)
    mock_filter_result.first.side_effect = [None, existing_user]
    
    mock_query.filter.return_value = mock_filter_result
    
    payload = {
        "sub": "google|2", 
        "email": "test@example.com", 
        "email_verified": True,
        "name": "User 2"
    }
    
    linked_user = get_or_create_user(mock_db, payload, "token")
    
    if linked_user.id != 1:
         raise AssertionError(f"Expected linked user ID 1, got {linked_user.id}")
    print("  [PASS] Linked to existing user ID 1")
    
    if linked_user.auth0_id != "auth0|1":
         raise AssertionError(f"Expected original auth0_id 'auth0|1', got {linked_user.auth0_id}")
    print("  [PASS] Preserved original auth0_id")
    
    # Check that mutable fields were updated (name updated to User 2)
    if linked_user.name != "User 2":
        raise AssertionError(f"Expected name updated to 'User 2', got {linked_user.name}")
    print("  [PASS] Updated name on existing account")


from api.routers.users import delete_me

def test_delete_account():
    print("\nTest 3: Delete Account")
    mock_db = MagicMock()
    # Create a proper mock request with state for slowapi
    mock_request = MagicMock()
    mock_request.state = MagicMock()
    
    # Bypass rate limiting by mocking the limiter or ensuring request has necessary attributes
    # The error "parameter `request` must be an instance of starlette.requests.Request" comes from slowapi
    # We can mock the isinstance check or better yet, just mock the rate limiter to do nothing
    
    import sys
    from unittest.mock import Mock
    
    # Mock slowapi's limitation check to avoid the Starlette Request type check
    # Or simpler: just pass a Mock that claims to be a Request? 
    # slowapi checks `isinstance(request, Request)` which is hard to fake with MagicMock unless we spec it
    # BUT we can just disable the rate limit dependency or mock the decorator?
    # Hard to mock decorator at runtime since it's already applied.
    
    # Strategy: Mock `slowapi.extension.Limiter` before it's used? No, already imported.
    # Strategy: Use a real Request object?
    from starlette.requests import Request
    scope = {"type": "http", "client": ("127.0.0.1", 8000), "server": ("127.0.0.1", 8000), "method": "DELETE", "headers": []}
    mock_request = Request(scope)

    # We also need to mock `get_current_user` and `get_db` which are dependencies,
    # but `delete_me` calls them directly if passed? No, they are Depends.
    # The function `delete_me` expects `request`, `user`, `db`.
    # Rate limit decorator runs BEFORE the function. 
    # IF we call `delete_me(request, ...)` directly, the decorator is WRAPPING it.
    
    # If `delete_me` is decorated, `delete_me` IS the wrapper.
    # We need to satisfy the wrapper.
    
    # The error came from `slowapi` trying to extract remote address from `request`.
    # Providing a real Starlette Request with a scope should fix it.

    with patch.dict(sys.modules, {'auth.management': MagicMock()}):
        delete_me(mock_request, user_to_delete, mock_db)
    
    # Verification
    # Check manual deletion of SearchEvents
    # expected: db.query(SearchEvent).filter(...).delete()
    # Logic is db.query(SearchEvent).filter(SearchEvent.user_id == user.id).delete()
    
    # Since we can't easily assert the exact filter expression object equality in mocks without complex setup,
    # we verify that db.query was called with SearchEvent and SearchSession
    
    # 1. Verify SearchEvent deletion
    mock_db.query.assert_any_call(SearchEvent)
    # We can assume the chain was .filter().delete()
    
    # 2. Verify SearchSession deletion
    mock_db.query.assert_any_call(SearchSession)
    
    # 3. Verify User deletion
    mock_db.delete.assert_called_with(user_to_delete)
    print("  [PASS] User deletion requested", flush=True)
    
    mock_db.commit.assert_called()
    print("  [PASS] DB Commit called", flush=True)


if __name__ == "__main__":
    try:
        test_missing_data_population()
        test_account_linking()
        test_delete_account()
        print("\nALL TESTS PASSED", flush=True)
    except Exception as e:
        print(f"\nFAIL: {e}", flush=True)
        import traceback
        traceback.print_exc()
        exit(1)
