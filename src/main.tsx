import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import AuthProvider from "./context/AuthContext";
import { QueryProvider } from "./lib/react-query/QueryProvider";
import { AudioProvider } from "./context/AudioContext";

ReactDOM.createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <QueryProvider>
            <AuthProvider>
                <AudioProvider>
                    <App />
                </AudioProvider>
            </AuthProvider>
        </QueryProvider>
    </BrowserRouter>
)