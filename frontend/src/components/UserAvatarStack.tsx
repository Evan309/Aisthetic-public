import React, { useMemo } from "react";

interface UserAvatarStackProps {
    owner?: {
        id: number;
        name: string | null;
        profile_picture_url?: string | null;
    } | null;
    collaborators?: Array<{
        user_id: number;
        username?: string;
        role: "viewer" | "editor" | "owner";
        profile_picture_url?: string | null;
    }> | null;
    maxAvatars?: number;
    className?: string;
}

const UserAvatarStack: React.FC<UserAvatarStackProps> = ({
    owner,
    collaborators,
    maxAvatars = 3,
    className = "",
}) => {
    const { displayUsers, remainderCount } = useMemo(() => {
        // Flatten all users: [Owner, ...Collaborators]
        const allUsers = [
            ...(owner
                ? [
                    {
                        userId: owner.id,
                        name: owner.name,
                        profilePicture: owner.profile_picture_url,
                        role: "owner" as const,
                    },
                ]
                : []),
            ...(collaborators ?? []).map((c) => ({
                userId: c.user_id,
                name: c.username,
                profilePicture: c.profile_picture_url,
                role: c.role,
            })),
        ];

        const displayUsers = allUsers.slice(0, maxAvatars);
        const remainderCount = Math.max(0, allUsers.length - maxAvatars);

        return { displayUsers, remainderCount };
    }, [owner, collaborators, maxAvatars]);

    if (displayUsers.length === 0) return null;

    return (
        <div className={`flex -space-x-2 ${className}`}>
            {displayUsers.map((u, idx) => (
                <div
                    key={`${u.userId}-${idx}`}
                    className="w-6 h-6 rounded-full border border-white bg-gray-100 overflow-hidden shadow-sm z-10"
                    title={`${u.role === "owner" ? "Owner" : u.role === "editor" ? "Editor" : "Viewer"
                        }: ${u.name}`}
                    style={{ zIndex: displayUsers.length - idx }}
                >
                    {u.profilePicture ? (
                        <img
                            src={u.profilePicture}
                            alt={u.name || "User"}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#213A53] text-white text-[10px] font-bold">
                            {u.name?.[0]?.toUpperCase() ?? "U"}
                        </div>
                    )}
                </div>
            ))}

            {remainderCount > 0 && (
                <div
                    className="w-6 h-6 rounded-full border border-white bg-gray-100 flex items-center justify-center text-[8px] font-medium text-gray-600 shadow-sm z-0"
                    title={`+${remainderCount} more`}
                >
                    +{remainderCount}
                </div>
            )}
        </div>
    );
};

export default UserAvatarStack;
