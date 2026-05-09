import { z } from "astro/zod";

export const LoginSchema = z.object({
	email: z.string().email("Invalid email format"),
	password: z.string().min(1, "Password is required"),
});

export const RegisterSchema = z.object({
	email: z.string().email().max(255, "Email cannot exceed 255 characters"),
	username: z.string().min(3, "Username must be at least 3 characters").max(30, "Username cannot exceed 30 characters"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.max(255, "Password is too long"),
});

export const SocialLoginSchema = z.object({
	provider: z.enum(["google", "github"]),
	idToken: z.string().min(1, "ID token is required"),
	referralCode: z.string().optional(),
});

export const RefreshTokenSchema = z.object({
	refreshToken: z.string().min(1, "Refresh token cannot be empty"),
});

export const ActivateAccountSchema = z.object({
	token: z.string().min(1, "Activation token cannot be empty"),
});
