import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Link } from 'react-router-dom';

void React;

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
                    <h2 className="font-display text-4xl mb-4 text-gray-900">Something went wrong</h2>
                    <p className="text-gray-600 max-w-md mx-auto mb-8">
                        An unexpected error occurred. Our team has been notified.
                        Please try refreshing the page or navigating back home.
                    </p>
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-gray-900 text-white text-sm tracking-wider uppercase hover:bg-black transition-colors"
                        >
                            Refresh Page
                        </button>
                        <Link
                            to="/"
                            className="px-6 py-3 border border-gray-200 text-gray-900 text-sm tracking-wider uppercase hover:bg-gray-50 transition-colors"
                            onClick={() => this.setState({ hasError: false })}
                        >
                            Go Home
                        </Link>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
