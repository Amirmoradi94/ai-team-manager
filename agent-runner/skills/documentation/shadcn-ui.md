"use client"import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"const formSchema = z.object({
email: z.string().email("Invalid email"),
password: z.string().min(8, "Password must be at least 8 characters"),
})export function LoginForm() {
const form = useForm&#x3C;z.infer&#x3C;typeof formSchema>>({
resolver: zodResolver(formSchema),
defaultValues: { email: "", password: "" },
})return (
&#x3C;Form {...form}>
&#x3C;form onSubmit={form.handleSubmit(console.log)} className="space-y-4">
&#x3C;FormField name="email" render={({ field }) => (
&#x3C;FormItem>
&#x3C;FormLabel>Email&#x3C;/FormLabel>
&#x3C;FormControl>&#x3C;Input type="email" {...field} />&#x3C;/FormControl>
&#x3C;FormMessage />
&#x3C;/FormItem>
)} />
&#x3C;Button type="submit">Login&#x3C;/Button>
&#x3C;/form>
&#x3C;/Form>
)
}