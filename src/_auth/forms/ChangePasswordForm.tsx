import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "@/context/AuthContext";
import { Loader } from "lucide-react";
import { useState } from "react";
import { account } from "@/lib/appwrite/config";

const ChangePasswordValidation = z.object({
  currentPassword: z.string().min(8, "当前密码至少8个字符"),
  newPassword: z.string().min(8, "新密码至少8个字符"),
  confirmPassword: z.string().min(8, "确认密码至少8个字符"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "新密码与确认密码不匹配",
  path: ["confirmPassword"],
});

const ChangePasswordForm = () => {
  const { toast } = useToast();
  const { user, setUser } = useUserContext();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof ChangePasswordValidation>>({
    resolver: zodResolver(ChangePasswordValidation),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof ChangePasswordValidation>) {
    try {
      setIsLoading(true);

      // 验证当前密码
      try {
        await account.createSession(user.email, values.currentPassword);
      } catch (error) {
        toast({ title: "当前密码错误" });
        return;
      }

      // 更新密码
      await account.updatePassword(values.newPassword);

      // 更新用户状态
      const updatedUser = { ...user, mustChangePassword: false };
      setUser(updatedUser);

      toast({ title: "密码修改成功" });
      form.reset();
      navigate("/");
    } catch (error: any) {
      console.error("Change password error:", error);
      toast({
        title: "密码修改失败",
        description: error.message || "发生错误，请重试",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <div className="sm:w-420 flex-center flex-col">
        <img
          src="/assets/images/cross.png"
          alt="logo"
          width={96}
          height={96}
        />

        <h2 className="h3-bold md:h2-bold pt-5 sm:pt-12">
          修改密码
        </h2>
        <p className="text-light-3 small-medium md:base-regular mt-2">
          {user.mustChangePassword ? "首次登录需要修改密码" : "请输入当前密码和新密码"}
        </p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5 w-full mt-4">
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>当前密码</FormLabel>
                <FormControl>
                  <Input type="password" className="shad-input" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>新密码</FormLabel>
                <FormControl>
                  <Input type="password" className="shad-input" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>确认新密码</FormLabel>
                <FormControl>
                  <Input type="password" className="shad-input" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="shad-button_primary">
            {isLoading ? (
              <div className="flex-center gap-2">
                <Loader />Loading...
              </div>
            ) : "确认修改"}
          </Button>
        </form>
      </div>
    </Form>
  );
};

export default ChangePasswordForm; 