import React, { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useJoinCloset } from "../hooks/closets";
import { Loader2, AlertCircle } from "lucide-react";

const JoinClosetPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const joinCloset = useJoinCloset();
    const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
    const formRef = useRef<boolean>(false);

    useEffect(() => {
        if (!token || isLoading) return;

        if (!isAuthenticated) {
            loginWithRedirect({
                appState: { returnTo: window.location.pathname },
                authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
            });
            return;
        }

        if (formRef.current) return;

        formRef.current = true;

        joinCloset.mutate(token, {
            onSuccess: (closet) => {
                navigate(`/closets/${closet.id}`, { replace: true });
            },
            onError: (err) => {
                console.error("[JoinClosetPage] Join error:", err);
            },
        });
    }, [token, joinCloset, navigate, isLoading, isAuthenticated, loginWithRedirect]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
            <div className="text-center max-w-sm w-full">
                {joinCloset.isPending || (!joinCloset.isError && !joinCloset.isSuccess) ? (
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-8 h-8 text-[#213A53] animate-spin mb-4" />
                        <h2 className="text-lg font-semibold text-gray-900">Joining closet...</h2>
                        <p className="text-sm text-gray-500 mt-2">Please wait while we verify your invite.</p>
                    </div>
                ) : joinCloset.isError ? (
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900">Unable to join</h2>
                        <p className="text-sm text-gray-500 mt-2 mb-6">
                            {joinCloset.error instanceof Error
                                ? joinCloset.error.message
                                : "The invite link may be invalid or expired."}
                        </p>
                        <button
                            onClick={() => navigate("/closets")}
                            className="w-full rounded-lg bg-gray-900 text-white py-2.5 text-sm font-semibold hover:bg-gray-800 transition"
                        >
                            Go to my closets
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default JoinClosetPage;
