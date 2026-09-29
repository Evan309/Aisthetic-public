import { useAuth0 } from "@auth0/auth0-react";
import { User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useUser } from "../hooks/useUser";

export default function UserAvatar({ className }: { className?: string }) {
  const { user: auth0User, isAuthenticated } = useAuth0();
  const { data: dbUser } = useUser();

  const dbPic = dbUser?.profile_picture_url;
  const auth0Pic = auth0User?.picture;

  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Sync state with props/data changes
  useEffect(() => {
    setFailed(false);
    if (dbPic) {
      setCurrentSrc(dbPic);
    } else if (auth0Pic) {
      setCurrentSrc(auth0Pic);
    } else {
      setCurrentSrc(null);
    }
  }, [dbPic, auth0Pic]);

  const handleError = () => {
    // If we were trying to load the DB pic and it failed, fallback to Auth0 pic
    if (currentSrc === dbPic && auth0Pic && auth0Pic !== dbPic) {
      setCurrentSrc(auth0Pic);
    } else {
      // Otherwise (Auth0 failed, or we only had DB pic), show fallback UI
      setFailed(true);
    }
  };

  if (!isAuthenticated) return null;

  // 1. If we have a valid src and haven't failed hard
  if (currentSrc && !failed) {
    return (
      <img
        src={currentSrc}
        alt="profile"
        className={className || "w-8 h-8 rounded-full object-cover cursor-pointer border border-gray-300"}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={handleError}
      />
    );
  }

  // 2. Hard failure or no image -> Fallback Icon
  return (
    <div className={className || "w-8 h-8 rounded-full flex items-center justify-center cursor-pointer bg-gray-100 border border-gray-200"}>
      <UserIcon className="w-5 h-5 text-gray-400" />
    </div>
  );
}
