import { useUserContext } from '@/context/AuthContext';
import { INavLink } from '@/types';
import React, { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { sidebarLinks } from '../constants';
import { Button } from '../ui/button';
import { useSignOutAccount } from '@/lib/react-query/queriesAndMutations';
import { getUnreadNotificationsCount, markNotificationsAsRead } from '@/lib/appwrite/api';
import { useNotificationContext } from '@/context/NotificationContext';
import { useChatContext } from '@/context/ChatContext';

const LeftSidebar = () => {
    const { user, setUser, setIsAuthenticated } = useUserContext();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { mutate: signOut, isSuccess } = useSignOutAccount();
    const [unreadCount, setUnreadCount] = useState(0);
    const { friendRequestCount, setFriendRequestCount } = useNotificationContext();
    const { totalUnreadCount } = useChatContext();

    const fetchUnreadCount = async () => {
        if (user.id) {
            const count = await getUnreadNotificationsCount(user.id!);
            setUnreadCount(count);
        }
    };

    useEffect(() => {
        fetchUnreadCount(); // Initial fetch
        const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30 seconds
        return () => clearInterval(interval);
    }, [user.id]);

    const handleCallHistoryClick = async () => {
        if (unreadCount > 0) {
            await markNotificationsAsRead(user.id!, 'missed_call');
            setUnreadCount(0); // Immediately update UI
        }
    };

    const handleFriendsClick = () => {
        setFriendRequestCount(0);
    };

    useEffect(() => {
        if (isSuccess) {
            setUser({
                $id: '',
                name: '',
                email: '',
                accountId: '',
            });
            setIsAuthenticated(false);
            navigate('/sign-in');
        }
    }, [isSuccess, navigate, setUser, setIsAuthenticated]);

    return (
        <nav className='leftsidebar bg-sidebar-gray'>
            <div className='flex flex-col gap-11'>
                <Link to='/' className='flex items-center gap-3'>
                    <img src="/assets/images/logo.png" alt="logo" 
                    width={56} height={56} />
                    <h2
                    className='text-charcoal text-2xl font-bold'
                    >
                        教会社交软件
                    </h2>
                    
                </Link>

                {user.$id ? (
                    <div className='flex flex-col gap-3'>
                        <Link to={`/profile/${user.$id}`} className='flex items-center gap-3'>
                            <img 
                                key={user.imageUrl}
                                src={user.imageUrl || '/assets/icons/profile-placeholder.svg'} 
                                alt="profile" 
                                className='rounded-full w-14 h-14 object-cover' 
                            />

                            <div className='flex flex-col'>
                                <p className='text-charcoal text-l font-bold'>{user.name}</p>
                                <p className='small-regular text-warm-gray'>
                                    {user.ministry ? `📋 ${user.ministry}` : '📋 未分配事工'}
                                </p>
                            </div>
                        </Link>
                    </div>
                ) : (
                    <div className='h-14'></div>
                )}

                <ul className='flex flex-col gap-6'>
                    {sidebarLinks.map((link: INavLink) => {
                        const isActive = pathname === link.route || pathname.startsWith(link.route + '/');
                        // 处理个人页面路由，添加用户ID
                        const routePath = link.route === '/profile' ? `/profile/${user.$id}` : link.route;
                        
                        return (
                            <li key={link.label} className={`leftsidebar-link group relative ${isActive && 'bg-accent-blue rounded-lg'}`}>
                                <NavLink 
                                    to={routePath}
                                    className="flex gap-4 items-center p-4"
                                    onClick={link.route === '/call-history' ? handleCallHistoryClick : link.route === '/friends' ? handleFriendsClick : undefined}
                                >
                                    <div className="relative">
                                        <img 
                                            src={link.imgURL}
                                            alt={link.label}
                                            className={`group-hover:invert-white w-5 h-5 transition-all ${isActive ? 'invert-white' : ''}`}
                                        />
                                        {link.route === '/home' && totalUnreadCount > 0 && (
                                            <span className="absolute -top-1 -right-1 w-5 h-5 text-xs flex items-center justify-center bg-notification-red text-white rounded-full">
                                                {totalUnreadCount}
                                            </span>
                                        )}
                                        {link.route === '/friends' && friendRequestCount > 0 && (
                                            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-notification-red rounded-full"></span>
                                        )}
                                    </div>
                                    <span className={`group-hover:text-white ${isActive ? 'text-white' : 'text-charcoal'}`}>{link.label}</span>
                                    {link.route === '/call-history' && unreadCount > 0 && (
                                        <span className="ml-auto w-5 h-5 text-xs flex items-center justify-center bg-notification-red text-white rounded-full">
                                            {unreadCount}
                                        </span>
                                    )}
                                </NavLink>
                            </li>
                        );
                    })}
                </ul>
            </div>
            <Button 
                variant='ghost' 
                className='shad-button_ghost' 
                onClick={() => signOut()}>
                <img src="/assets/icons/logout.svg" 
                     alt="logout" />
                <p className='small-medium lg:base-medium logout-button-text text-charcoal'>登出</p>
            </Button>
        </nav>
    )
}

export default LeftSidebar