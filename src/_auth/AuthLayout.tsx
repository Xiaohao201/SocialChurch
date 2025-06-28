import { useUserContext } from "@/context/AuthContext";
import { Outlet, Navigate } from "react-router-dom"

const AuthLayout = () => {
  const { isAuthenticated, user } = useUserContext();

  if (isAuthenticated && user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  if (isAuthenticated && window.location.pathname === '/sign-in') {
    return <Navigate to='/home' />;
  }

  return (
    <section className="flex h-screen w-full bg-cream">
      <div className="flex flex-1 justify-center items-center flex-col py-10 bg-cream">
        <Outlet/>
      </div>

      <img
        src="/assets/images/dog.jpg"
        alt="side image"
        className="hidden md:block h-screen w-1/2 object-cover bg-no-repeat"
      />
    </section>
  )
}

export default AuthLayout