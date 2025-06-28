import Bottombar from '@/components/shared/Bottombar'
import LeftSidebar from '@/components/shared/LeftSidebar'
import Topbar from '@/components/shared/Topbar'
import { useUserContext } from '@/context/AuthContext'
import { Outlet, Navigate } from 'react-router-dom'

const RootLayout = () => {
  const { isAuthenticated, isLoading, user } = useUserContext()

  if (!isAuthenticated && !isLoading) {
    return <Navigate to="/sign-in" />
  }
  if (isAuthenticated && user.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  return (
    <>
      {isLoading ? (
        <div className="flex-center w-full h-full">
          <p>Loading...</p>
        </div>
      ) : (
        <div className='w-full md:flex'>
          <Topbar />
          <LeftSidebar />
          <section className='flex h-full flex-1 overflow-y-auto bg-cream'>
            <Outlet />
          </section>
          <Bottombar />
        </div>
      )}
    </>
  )
}

export default RootLayout