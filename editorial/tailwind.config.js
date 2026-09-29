/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
                display: ["Playfair Display", "ui-serif", "Georgia", "serif"],
                playfair: ['Playfair Display', 'ui-serif', 'Georgia', 'serif'],
            },
            colors: {
                primary: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                },
                brand: {
                    black: '#000000',
                    darkBlue: '#213A53',
                    slate: '#42596D',
                    lightGrey: '#9BA3AA',
                    white: '#FFFFFF',
                }
            },
            keyframes: {
                rise: {
                    '0%': { transform: 'translateY(0)' },
                    '100%': { transform: 'translateY(-50%)' },
                }
            },
            animation: {
                rise: 'rise linear infinite',
            }
        },
    },
    plugins: [],
}
