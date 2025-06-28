import * as z from "zod"


// SignupValidation 已废弃（如无引用可删除）

export const SigninValidation = z.object({
    email: z.string().email(),
    password: z.string().min(8, {message: 'Password must at least 8 characters'}),
  })

export const PostValidation = z.object({
  caption: z.string().min(5).max(2200),
  file: z.array(z.instanceof(File)),
  location: z.string().min(2).max(100),
  tags: z.string(),
})