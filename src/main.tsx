import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import AuthProvider from "./context/AuthContext";
import { QueryProvider } from "./lib/react-query/QueryProvider";
import { AudioProvider } from "./context/AudioContext";
import { CallProvider } from "./context/CallContext";

ReactDOM.createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <QueryProvider>
            <AuthProvider>
                <AudioProvider>
                    <CallProvider>
                        <App />
                    </CallProvider>
                </AudioProvider>
            </AuthProvider>
        </QueryProvider>
    </BrowserRouter>
)