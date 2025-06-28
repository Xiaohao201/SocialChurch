import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../ui/button'
import { useSignOutAccount } from '@/lib/react-query/queriesAndMutations';
import { useUserContext } from '@/context/AuthContext';

const Topbar = () => {
    const { mutate: signOut, isSuccess } = useSignOutAccount();

    const navigate = useNavigate();
    const { user } = useUserContext();
    
    useEffect(() => {
        if(isSuccess) navigate(0) 
    }, [isSuccess]);

    const handleSignOut = async (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
        e.preventDefault();
        signOut();
        navigate("/sign-in");
    };

  return (
    <section className='topbar bg-cream'>
        <div className='flex-between py-4 px-5'>

            <Link to='/' className='flex gap-2 items-center'>
                <img src="/assets/images/logo.png" alt="logo" width={36} height={36} />
                <p className="text-xl font-bold text-dark-1">教会社交软件</p>
            </Link>

            <div className='flex gap-4'>
                <Button variant='ghost' 
                className='shad-button_ghost' 
                onClick={(e) => handleSignOut(e)}>
                    <img src="/assets/icons/logout.svg" alt="logout" className="logout-icon" />
                </Button>
                <Link to={`/profile/${user.$id}`} className='flex-center gap-3'>
                    <img 
                        key={user.imageUrl}
                        src={user.imageUrl || '/assets/icons/profile-placeholder.svg'} 
                        alt="profile" 
                        className='rounded-full w-8 h-8 object-cover' 
                    />
                </Link>
            </div>
        </div>
    </section>

  )
}

export default Topbar