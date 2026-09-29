import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { LogoutButton } from "./AuthButtons";
import { Link, useLocation } from "react-router-dom";
import { useUser } from "../hooks/useUser"; // ✅ Import hook
import UserAvatar from "./UserAvatar";

export default function UserDropdown({ onClose }: { onClose?: () => void }) {
  const { user: auth0User, isAuthenticated } = useAuth0();
  const { data: dbUser } = useUser(); // ✅ Fetch DB user
  const location = useLocation();

  // ✅ Close dropdown whenever the route changes
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Header never shows the dropdown when signed out, but keep this guard.
  if (!isAuthenticated) return null;

  const displayName = dbUser?.name || auth0User?.name;
  const displayEmail = dbUser?.email || auth0User?.email;


  return (
    <>
      <div
        className="
          bg-white border-t border-gray-100
          shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]
          rounded-b-lg
        "
      >
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <UserAvatar className="w-10 h-10 rounded-full border object-cover" />

            <div className="flex flex-col">
              <span className="font-semibold text-sm text-gray-900">
                {displayName}
              </span>
              {displayEmail && (
                <span className="text-xs text-gray-500">{displayEmail}</span>
              )}
            </div>
          </div>

          <hr className="border-gray-200 mb-4" />

          <div className="flex flex-col space-y-3">

            <DropdownLink to="/account" onClick={onClose}>
              My Account
            </DropdownLink>
            <DropdownLink to="/closets" onClick={onClose}>
              My Closets
            </DropdownLink>
          </div>

          <div className="mt-4" onClick={onClose}>
            <LogoutButton />
          </div>
        </div>
      </div>
    </>
  );
}

function DropdownLink({
  to,
  children,
  onClick,
}: {
  to: string;
  children: any;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="
        block text-sm text-gray-700 font-medium
        hover:text-[#213A53] transition-colors
      "
    >
      {children}
    </Link>
  );
}
