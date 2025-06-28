import { Link, useLocation } from 'react-router-dom';
import { bottombarLinks } from '../constants';
import { useUserContext } from '@/context/AuthContext';

const Bottombar = () => {
    const { pathname } = useLocation();
    const { user } = useUserContext();

    return (
        <section className='bottom-bar'>
            {bottombarLinks.map((link) => {
                const isActive = pathname === link.route;
                // 处理个人页面路由，添加用户ID
                const routePath = link.route === '/profile' ? `/profile/${user.$id}` : link.route;

                return (
                    <Link
                        to={routePath} 
                        key={link.label} 
                        className={`flex-center flex-col gap-1 p-2 transition ${
                            isActive ? 'bg-primary-500 rounded-[10px]' : ''
                        }`}
                    >
                        <img 
                            src={link.imgURL}
                            alt={link.label}
                            width={24}
                            height={24}
                            className={`${isActive ? 'invert-white' : ''}`}
                        />
                        <p className={`small-regular ${isActive ? 'text-white' : 'text-dark-1'}`}>
                            {link.label}
                        </p>
                    </Link>
                )
            })}
        </section>
    )
}

export default Bottombar