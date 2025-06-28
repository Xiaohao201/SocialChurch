import { getCurrentUser } from '@/lib/appwrite/api';
import { account, appwriteConfig, client } from '@/lib/appwrite/config';
import { onlineStatusService } from '@/lib/webrtc/onlineStatusService';
import { IUser } from '@/types';
import { createContext, useContext, useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'

export const INITIAL_USER = {
    $id: '',
    accountId: '',
    email: '',
    name: '',
    imageUrl: undefined,
    gender: undefined,
    dateOfFaith: undefined,
    faithTestimony: undefined,
    ministry: undefined,
    ministryId: undefined,
};

type IContextType = {
    user: IUser;
    setUser: React.Dispatch<React.SetStateAction<IUser>>;
    isLoading: boolean;
    isAuthenticated: boolean;
    setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
    checkAuthUser: () => Promise<boolean>;
}

const AuthContext = createContext<IContextType>({
    user: INITIAL_USER,
    setUser: () => {},
    isLoading: false,
    isAuthenticated: false,
    setIsAuthenticated: () => {},
    checkAuthUser: async () => false,
});

const AuthProvider = ({ children }: { children: React.ReactNode}) => {
    const [user, setUser] = useState<IUser>(INITIAL_USER);
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const navigate = useNavigate();

    const checkAuthUser = async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            const currentAccount = await getCurrentUser();
            console.log("AuthContext - Current account:", currentAccount);

            if(currentAccount) {
                console.log("AuthContext - Setting user data:", {
                    $id: currentAccount.$id,
                    email: currentAccount.email,
                    imageUrl: currentAccount.imageUrl,
                    dateOfFaith: currentAccount.dateOfFaith,
                    faithTestimony: currentAccount.faithTestimony,
                    accountId: currentAccount.accountId,
                    ministryId: currentAccount.ministryId,
                });

                setUser({
                    $id: currentAccount.$id,
                    accountId: currentAccount.accountId,
                    email: currentAccount.email,
                    name: currentAccount.name,
                    imageUrl: currentAccount.imageUrl,
                    gender: currentAccount.gender,
                    dateOfFaith: currentAccount.dateOfFaith,
                    faithTestimony: currentAccount.faithTestimony,
                    ministry: currentAccount.ministry,
                    ministryId: currentAccount.ministryId,
                });

                console.log("AuthContext - 用户数据设置完成:", {
                    userId: currentAccount.$id,
                    userIdType: typeof currentAccount.$id,
                    userIdLength: currentAccount.$id?.length || 0,
                    fullUserData: {
                        $id: currentAccount.$id,
                        accountId: currentAccount.accountId,
                        email: currentAccount.email,
                        name: currentAccount.name
                    }
                });

                onlineStatusService.startUserSession(currentAccount.$id);

                setIsAuthenticated(true);
                console.log("AuthContext - Authentication successful");
                return true;
            }

            console.log("AuthContext - No current account found, resetting state");
            onlineStatusService.stopUserSession();
            setUser(INITIAL_USER);
            setIsAuthenticated(false);
            return false;

        } catch (error) {
            console.error("AuthContext - Auth check error:", error);
            setError(error instanceof Error ? error.message : "认证检查失败");
            onlineStatusService.stopUserSession();
            setUser(INITIAL_USER);
            setIsAuthenticated(false);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (
            localStorage.getItem("cookieFallback") === "[]" ||
            localStorage.getItem("cookieFallback") === null
        ) {
            navigate("/sign-in");
        }

        checkAuthUser();

        return () => {
            onlineStatusService.stopUserSession();
        };
    }, []);

    // 实时订阅当前用户的数据变化
    useEffect(() => {
        if (!user.$id) return;

        const documentId = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.userCollectionId}.documents.${user.$id}`;
        
        const unsubscribe = client.subscribe(documentId, (response) => {
            const updatedUser = response.payload as IUser;
            setUser((prevUser) => ({
                ...prevUser,
                ...updatedUser,
            }));
        });

        return () => {
            unsubscribe();
        };
    }, [user.$id]);

    if (isLoading) {
        return <div className="flex h-screen w-full items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
        </div>;
    }

    if (error) {
        return <div className="flex h-screen w-full items-center justify-center text-red-500">
            {error}
        </div>;
    }
            
    const value = {
        user,
        setUser,
        isLoading,
        isAuthenticated,
        setIsAuthenticated,
        checkAuthUser
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export default AuthProvider;

export const useUserContext = () => useContext(AuthContext);
