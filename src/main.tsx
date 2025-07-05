import React from 'react';
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import AuthProvider from './context/AuthContext.tsx'
import { QueryProvider } from './lib/react-query/QueryProvider.tsx'
import { NotificationProvider } from './context/NotificationContext.tsx'
import { ChatProvider } from './context/ChatContext.tsx'
import { AudioProvider } from "./context/AudioContext.tsx";
import { CallProvider } from "./context/CallContext.tsx";

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <QueryProvider>
                <AuthProvider>
                    <NotificationProvider>
                        <ChatProvider>
                            <AudioProvider>
                                <CallProvider>
                                    <App />
                                </CallProvider>
                            </AudioProvider>
                        </ChatProvider>
                    </NotificationProvider>
                </AuthProvider>
            </QueryProvider>
        </BrowserRouter>
    </React.StrictMode>,
)