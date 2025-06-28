import { useUserContext } from '@/context/AuthContext';
import { INavLink } from '@/types';
import React, { useEffect } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { sidebarLinks } from '../constants';
import { Button } from '../ui/button';
import { useSignOutAccount } from '@/lib/react-query/queriesAndMutations';

const LeftSidebar = () => {
    const { user, setUser, setIsAuthenticated } = useUserContext();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { mutate: signOut, isSuccess } = useSignOutAccount();


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
        <nav className='leftsidebar'>
            <div className='flex flex-col gap-11'>
                <Link to='/' className='flex items-center gap-3'>
                    <img src="/assets/images/logo.png" alt="logo" 
                    width={56} height={56} />
                    <h2
                    className='text-dark-1 text-2xl font-bold'
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
                                <p className='text-dark-1 text-l font-bold'>{user.name}</p>
                                <p className='small-regular text-light-3'>
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
                            <li key={link.label} className={`leftsidebar-link ${isActive ? 'active' : ''} relative`}>
                                <NavLink 
                                    to={routePath}
                                    className={({ isActive: navIsActive }) => 
                                        `flex gap-4 items-center p-4 transition-all ${
                                            isActive ? 'text-white font-semibold' : 'text-warm-gray hover:text-dark-1'
                                        }`
                                    }
                                >
                                    <div className="relative">
                                        <img 
                                            src={link.imgURL}
                                            alt={link.label}
                                            className={`w-5 h-5 transition-all ${
                                                isActive ? 'brightness-0 invert' : ''
                                            }`}
                                        />
                                    </div>
                                    <span>{link.label}</span>
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
                <p className='small-medium lg:base-medium logout-button-text'>登出</p>
            </Button>
        </nav>
    )
}

export default LeftSidebar