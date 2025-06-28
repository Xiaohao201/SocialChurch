import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { SigninValidation } from "@/lib/validation"
import { Loader } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/components/ui/use-toast"
import { useSignInAccount } from "@/lib/react-query/queriesAndMutations"
import { useUserContext } from "@/context/AuthContext"

const SigninForm = () => {
  const { toast } = useToast();
  const { checkAuthUser, isLoading: isUserLoading } = useUserContext();
  const navigate = useNavigate();

  const { mutateAsync: signInAccount, isPending: isSigningIn } = useSignInAccount();
  
  const form = useForm<z.infer<typeof SigninValidation>>({
    resolver: zodResolver(SigninValidation),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(values: z.infer<typeof SigninValidation>) {
    const session = await signInAccount({
      email: values.email,
      password: values.password,
    });

    if(!session) {
      return toast({ 
        title: "登录失败，请重试",
        variant: "destructive",
      });
    }

    const isLoggedIn = await checkAuthUser();

    if(isLoggedIn) {
      form.reset();
      navigate('/home');
    } else {
      return toast({ 
        title: "登录失败，请重试",
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <div className="sm:w-420 flex-center flex-col">
        <img 
          src="/assets/images/logo.png"
          alt='logo'
          width={96}
          height={96}
        />
        
        <h2 className="h3-bold md:h2-bold pt-5 sm:pt-12 text-dark-1">
          登录你的账号
        </h2>
        <p className="text-gray-600 small-medium md:base-regular mt-2">
          欢迎回来，感谢你的信心和爱心
        </p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5 w-full mt-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700">邮箱</FormLabel>
                <FormControl>
                  <Input 
                    type="email" 
                    className="h-12 bg-white/50 border-gray-300 text-dark-1 focus:border-accent-blue focus-visible:ring-accent-blue" 
                    {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700">密码</FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    className="h-12 bg-white/50 border-gray-300 text-dark-1 focus:border-accent-blue focus-visible:ring-accent-blue" 
                    {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="shad-button_primary h-12">
            {isSigningIn ? (
              <div className="flex-center gap-2">
                <Loader/>Loading...
              </div>
            ): "登录"}
          </Button>
        </form>
      </div>
    </Form>
  )
}

export default SigninForm

