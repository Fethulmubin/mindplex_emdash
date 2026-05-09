import { PluginRouteError } from "emdash";
import type { PluginContext } from "emdash";
import {
	activateUser,
	loginUser,
	logoutUser,
	refreshSession,
	registerUser,
	socialLogin,
} from "../../services/auth";
import {
	ActivateAccountSchema,
	LoginSchema,
	RefreshTokenSchema,
	RegisterSchema,
	SocialLoginSchema,
} from "./auth.schemas";

export async function loginHandler(routeCtx: any, ctx: PluginContext) {
	if (routeCtx.request.method !== "POST") {
		throw methodNotAllowed();
	}
	const input = await parseJsonInput(routeCtx);
	const parsed = LoginSchema.safeParse(input);
	if (!parsed.success) throw validationError(parsed.error.flatten());

	const result = await loginUser(ctx, parsed.data);
	return normalizeAuthResult(result.status, result.body);
}

export async function registerHandler(routeCtx: any, ctx: PluginContext) {
	if (routeCtx.request.method !== "POST") {
		throw methodNotAllowed();
	}
	const input = await parseJsonInput(routeCtx);
	const parsed = RegisterSchema.safeParse(input);
	if (!parsed.success) throw validationError(parsed.error.flatten());

	const result = await registerUser(ctx, parsed.data);
	return normalizeAuthResult(result.status, result.body);
}

export async function activateHandler(routeCtx: any, ctx: PluginContext) {
	if (routeCtx.request.method !== "POST") {
		throw methodNotAllowed();
	}
	const input = await parseJsonInput(routeCtx);
	const parsed = ActivateAccountSchema.safeParse(input);
	if (!parsed.success) throw validationError(parsed.error.flatten());

	const result = await activateUser(ctx, parsed.data);
	return normalizeAuthResult(result.status, result.body);
}

export async function socialLoginHandler(routeCtx: any, ctx: PluginContext) {
	if (routeCtx.request.method !== "POST") {
		throw methodNotAllowed();
	}
	const input = await parseJsonInput(routeCtx);
	const parsed = SocialLoginSchema.safeParse(input);
	if (!parsed.success) throw validationError(parsed.error.flatten());

	const result = await socialLogin(ctx, parsed.data, routeCtx.request);
	return normalizeAuthResult(result.status, result.body);
}

export async function refreshHandler(routeCtx: any, ctx: PluginContext) {
	if (routeCtx.request.method !== "POST") {
		throw methodNotAllowed();
	}
	const input = await parseJsonInput(routeCtx);
	const parsed = RefreshTokenSchema.safeParse(input);
	if (!parsed.success) throw validationError(parsed.error.flatten());

	const result = await refreshSession(ctx, parsed.data);
	return normalizeAuthResult(result.status, result.body);
}

export async function logoutHandler(routeCtx: any, ctx: PluginContext) {
	if (routeCtx.request.method !== "POST") {
		throw methodNotAllowed();
	}
	const input = await parseJsonInput(routeCtx);
	const parsed = RefreshTokenSchema.safeParse(input);
	if (!parsed.success) throw validationError(parsed.error.flatten());

	const result = await logoutUser(ctx, parsed.data);
	return normalizeAuthResult(result.status, result.body);
}

async function parseJsonInput(routeCtx: any) {
	if (routeCtx.input) return routeCtx.input;
	return await routeCtx.request.json().catch(() => ({}));
}

function validationError(details: unknown) {
	return PluginRouteError.badRequest("Validation failed", details);
}

function methodNotAllowed() {
	return new PluginRouteError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
}

function normalizeAuthResult(status: number, body: Record<string, unknown>) {
	if (status >= 200 && status < 300) return body;

	const message = typeof body.error === "string"
		? body.error
		: typeof body.message === "string"
			? body.message
			: "Request failed";

	switch (status) {
		case 400:
			throw PluginRouteError.badRequest(message, body);
		case 401:
			throw PluginRouteError.unauthorized(message);
		case 403:
			throw PluginRouteError.forbidden(message);
		case 404:
			throw PluginRouteError.notFound(message);
		case 409:
			throw PluginRouteError.conflict(message, body);
		default:
			throw PluginRouteError.internal(message);
	}
}
