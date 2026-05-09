import type { PluginContext } from "emdash";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import bcrypt from "bcryptjs";
import type {
	ActivationTokenRecord,
	RefreshTokenRecord,
	Role,
	SocialAuthProvider,
	UserNotificationSettingsRecord,
	UserPreferencesRecord,
	UserProfileRecord,
	UserRecord,
	UserSocialAuthRecord,
} from "../../types/auth";

type AuthResponse = { status: number; body: Record<string, unknown> };

type StorageItem<T> = { id: string; data: T };

type StorageCollection<T> = {
	get: (id: string) => Promise<T | null>;
	put: (id: string, data: T) => Promise<void>;
	delete: (id: string) => Promise<boolean>;
	query: (options: Record<string, unknown>) => Promise<{ items: Array<StorageItem<T>>; cursor?: string }>;
	count: (where?: Record<string, unknown>) => Promise<number>;
};

const TOKEN_TTL_DAYS = 7;
const TOKEN_FAMILY_TTL_DAYS = 30;
const ACTIVATION_TTL_HOURS = 24;
const ACCESS_TOKEN_TTL_MINUTES = 15;

const ISSUER = "mindplex";
const AUDIENCE = "mindplex-api";

const AUTH_PROVIDERS = {
	google: {
		ISSUERS: ["https://accounts.google.com", "accounts.google.com"],
		TOKENINFO_URL: "https://oauth2.googleapis.com/tokeninfo",
	},
} as const;

const ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export async function loginUser(ctx: PluginContext, input: { email: string; password: string }): Promise<AuthResponse> {
	const users = ctx.storage.users as StorageCollection<UserRecord>;
	const userItem = await queryFirst(users, { email: input.email });

	if (!userItem || !userItem.data.passwordHash) {
		return { status: 401, body: { error: "Invalid credentials" } };
	}

	const user = userItem.data;
	const passwordHash = user.passwordHash;
	if (!passwordHash) {
		return { status: 401, body: { error: "Invalid credentials" } };
	}
	const legacy = isLegacyPassword(passwordHash);
	const isMatch = legacy
		? await verifyWordpressPassword(input.password, passwordHash)
		: await verifyPassword(input.password, passwordHash);

	if (!isMatch) {
		return { status: 401, body: { error: "Invalid credentials" } };
	}

	if (!user.isActivated) {
		return { status: 403, body: { error: "Account not activated" } };
	}

	if (legacy) {
		const newHash = await hashPassword(input.password);
		await updateUser(ctx, { ...user, passwordHash: newHash });
	}

	const { rawToken, hashedToken } = generateOpaqueToken();
	const familyId = randomUUID();
	const accessToken = await generateAccessToken(ctx, {
		sub: String(user.id),
		email: user.email,
		role: user.role,
		sessionId: familyId,
	});

	const now = new Date();
	const expiresAt = addDays(now, TOKEN_TTL_DAYS);
	const familyExpiresAt = addDays(now, TOKEN_FAMILY_TTL_DAYS);

	await insertRefreshToken(ctx, {
		userId: user.id,
		token: hashedToken,
		familyId,
		expiresAt: expiresAt.toISOString(),
		familyExpiresAt: familyExpiresAt.toISOString(),
		isRevoked: false,
		createdAt: new Date().toISOString(),
	});

	return { status: 200, body: { accessToken, refreshToken: rawToken } };
}

export async function registerUser(
	ctx: PluginContext,
	input: { email: string; username: string; password: string },
): Promise<AuthResponse> {
	const users = ctx.storage.users as StorageCollection<UserRecord>;

	const [existingByEmail, existingByUsername] = await Promise.all([
		queryFirst(users, { email: input.email }),
		queryFirst(users, { username: input.username }),
	]);

	if (existingByEmail || existingByUsername) {
		return { status: 409, body: { error: "User already exists" } };
	}

	const passwordHash = await hashPassword(input.password);
	const now = new Date().toISOString();
	const userId = await nextId(ctx, "users");

	const user: UserRecord = {
		id: userId,
		username: input.username,
		email: input.email,
		passwordHash,
		role: "user",
		isActivated: false,
		createdAt: now,
		updatedAt: now,
	};

	await users.put(String(userId), user);

	await initializeUserProfile(ctx, userId);
	await initializeUserPreferences(ctx, userId);
	await initializeUserNotificationSettings(ctx, userId);

	const { rawToken, hashedToken } = generateOpaqueToken();
	const expiresAt = new Date(Date.now() + ACTIVATION_TTL_HOURS * 60 * 60 * 1000);

	await insertActivationToken(ctx, {
		userId,
		token: hashedToken,
		expiresAt: expiresAt.toISOString(),
		createdAt: new Date().toISOString(),
	});

	ctx.log.info("Activation token generated", { token: rawToken });

	return {
		status: 201,
		body: { message: "User registered. Please check your email to activate." },
	};
}

export async function activateUser(ctx: PluginContext, input: { token: string }): Promise<AuthResponse> {
	const activationTokens = ctx.storage.activation_tokens as StorageCollection<ActivationTokenRecord>;
	const users = ctx.storage.users as StorageCollection<UserRecord>;

	const hashedIncomingToken = hashToken(input.token);
	const tokenItem = await queryFirst(activationTokens, { token: hashedIncomingToken });

	if (!tokenItem) {
		return { status: 400, body: { error: "Invalid activation token" } };
	}

	const tokenData = tokenItem.data;
	if (new Date(tokenData.expiresAt) < new Date()) {
		await activationTokens.delete(String(tokenData.id));
		return { status: 400, body: { error: "Token expired. Please request a new one." } };
	}

	const user = await users.get(String(tokenData.userId));
	if (!user) {
		await activationTokens.delete(String(tokenData.id));
		return { status: 400, body: { error: "Invalid activation token" } };
	}

	if (user.isActivated) {
		await activationTokens.delete(String(tokenData.id));
		return { status: 200, body: { message: "Account is already activated" } };
	}

	await updateUser(ctx, { ...user, isActivated: true });
	await activationTokens.delete(String(tokenData.id));

	return { status: 200, body: { message: "Account successfully activated" } };
}

export async function socialLogin(
	ctx: PluginContext,
	input: { provider: SocialAuthProvider; idToken: string; referralCode?: string },
	request: Request,
): Promise<AuthResponse> {
	if (input.provider !== "google") {
		return { status: 501, body: { error: "Provider not yet implemented" } };
	}

	let payload: GoogleTokenPayload;
	try {
		payload = await verifyGoogleToken(ctx, input.idToken);
	} catch (error) {
		ctx.log.error("Invalid social token", { provider: input.provider, error });
		return { status: 401, body: { error: "Invalid or expired social token" } };
	}

	const emailVerified = payload.email_verified === true || payload.email_verified === "true";
	if (!emailVerified) {
		return { status: 403, body: { error: "Google email must be verified" } };
	}

	const users = ctx.storage.users as StorageCollection<UserRecord>;
	const socialAuths = ctx.storage.user_social_auths as StorageCollection<UserSocialAuthRecord>;

	const providerId = payload.sub;
	const verifiedEmail = payload.email;
	const firstName = payload.given_name ?? "";
	const lastName = payload.family_name ?? "";
	const avatarUrl = payload.picture ?? "";

	let finalUserId: number;
	let userRole: Role = "user";

	const existingAuth = await queryFirst(socialAuths, { provider: input.provider, providerId });
	if (existingAuth) {
		finalUserId = existingAuth.data.userId;
		const existingUser = await users.get(String(finalUserId));
		if (existingUser) {
			userRole = existingUser.role;
		}
	} else {
		const existingUserItem = await queryFirst(users, { email: verifiedEmail });
		if (existingUserItem) {
			finalUserId = existingUserItem.data.id;
			userRole = existingUserItem.data.role;
			await createSocialAuth(ctx, {
				userId: finalUserId,
				provider: input.provider,
				providerId,
			});
		} else {
			const baseUsername = (verifiedEmail.split("@")[0] || "user").replace(/[^a-zA-Z0-9_]/g, "");
			const uniqueUsername = await generateUniqueUsername(ctx, baseUsername);
			const now = new Date().toISOString();
			finalUserId = await nextId(ctx, "users");

			const newUser: UserRecord = {
				id: finalUserId,
				username: uniqueUsername,
				email: verifiedEmail,
				role: "user",
				isActivated: true,
				createdAt: now,
				updatedAt: now,
			};

			await users.put(String(finalUserId), newUser);

			await initializeUserProfile(ctx, finalUserId, {
				firstName,
				lastName,
				avatarUrl,
			});
			await initializeUserPreferences(ctx, finalUserId);
			await initializeUserNotificationSettings(ctx, finalUserId);
			await createSocialAuth(ctx, {
				userId: finalUserId,
				provider: input.provider,
				providerId,
			});
		}
	}

	const familyId = randomUUID();
	const accessToken = await generateAccessToken(ctx, {
		sub: String(finalUserId),
		email: verifiedEmail,
		role: userRole,
		sessionId: familyId,
	});

	const { rawToken: refreshToken, hashedToken } = generateOpaqueToken();

	const expiresAt = addDays(new Date(), TOKEN_TTL_DAYS);
	const familyExpiresAt = addDays(new Date(), TOKEN_FAMILY_TTL_DAYS);

	await insertRefreshToken(ctx, {
		userId: finalUserId,
		token: hashedToken,
		familyId,
		metadata: getSessionMetadata(request),
		expiresAt: expiresAt.toISOString(),
		familyExpiresAt: familyExpiresAt.toISOString(),
		isRevoked: false,
		createdAt: new Date().toISOString(),
	});

	return { status: 200, body: { accessToken, refreshToken } };
}

export async function refreshSession(ctx: PluginContext, input: { refreshToken: string }): Promise<AuthResponse> {
	const refreshTokens = ctx.storage.refresh_tokens as StorageCollection<RefreshTokenRecord>;
	const users = ctx.storage.users as StorageCollection<UserRecord>;
	const hashedIncomingToken = hashToken(input.refreshToken);

	const tokenItem = await queryFirst(refreshTokens, { token: hashedIncomingToken });
	if (!tokenItem) return { status: 401, body: { error: "Invalid token" } };

	const tokenData = tokenItem.data;
	const user = await users.get(String(tokenData.userId));
	if (!user) return { status: 401, body: { error: "Invalid token" } };

	if (new Date(tokenData.expiresAt) < new Date()) {
		return { status: 401, body: { error: "Session inactive for too long. Please log in." } };
	}

	if (new Date(tokenData.familyExpiresAt) < new Date()) {
		await deleteRefreshFamily(refreshTokens, tokenData.familyId);
		return { status: 401, body: { error: "Session expired. Please log in again." } };
	}

	if (tokenData.isRevoked) {
		await deleteRefreshFamily(refreshTokens, tokenData.familyId);
		return { status: 403, body: { error: "Security alert: Token reuse detected. Please log in again." } };
	}

	const newAccessToken = await generateAccessToken(ctx, {
		sub: String(user.id),
		email: user.email,
		role: user.role,
		sessionId: tokenData.familyId,
	});

	const { rawToken, hashedToken } = generateOpaqueToken();

	await refreshTokens.put(String(tokenData.id), { ...tokenData, isRevoked: true });

	const expiresAt = addDays(new Date(), TOKEN_TTL_DAYS);
	await insertRefreshToken(ctx, {
		userId: user.id,
		token: hashedToken,
		familyId: tokenData.familyId,
		expiresAt: expiresAt.toISOString(),
		familyExpiresAt: tokenData.familyExpiresAt,
		isRevoked: false,
		createdAt: new Date().toISOString(),
	});

	return { status: 200, body: { accessToken: newAccessToken, refreshToken: rawToken } };
}

export async function logoutUser(ctx: PluginContext, input: { refreshToken: string }): Promise<AuthResponse> {
	const refreshTokens = ctx.storage.refresh_tokens as StorageCollection<RefreshTokenRecord>;
	const hashedToken = hashToken(input.refreshToken);
	const tokenItem = await queryFirst(refreshTokens, { token: hashedToken });

	if (tokenItem) {
		await deleteRefreshFamily(refreshTokens, tokenItem.data.familyId);
	}

	return { status: 200, body: { message: "Logged out successfully" } };
}

function getSessionMetadata(request: Request) {
	const userAgent = request.headers.get("user-agent") || "Unknown Device";
	const ip = request.headers.get("x-forwarded-for") || "Unknown IP";
	return { userAgent, ip };
}

async function initializeUserProfile(
	ctx: PluginContext,
	userId: number,
	partial?: Partial<UserProfileRecord>,
) {
	const profiles = ctx.storage.user_profiles as StorageCollection<UserProfileRecord>;
	const profile: UserProfileRecord = {
		userId,
		firstName: null,
		lastName: null,
		avatarUrl: null,
		bio: null,
		dateOfBirth: null,
		gender: null,
		education: null,
		socialMedia: {},
		...partial,
	};
	await profiles.put(String(userId), profile);
}

async function initializeUserPreferences(ctx: PluginContext, userId: number) {
	const preferences = ctx.storage.user_preferences as StorageCollection<UserPreferencesRecord>;
	const record: UserPreferencesRecord = {
		userId,
		theme: "light",
		privacyAge: "private",
		privacyGender: "private",
		privacyEducation: "private",
	};
	await preferences.put(String(userId), record);
}

async function initializeUserNotificationSettings(ctx: PluginContext, userId: number) {
	const notifications = ctx.storage.user_notification_settings as StorageCollection<UserNotificationSettingsRecord>;
	const record: UserNotificationSettingsRecord = {
		userId,
		notifyPublications: true,
		notifyFollower: true,
		notifyInteraction: true,
		notifyWeekly: true,
		notifyUpdates: true,
	};
	await notifications.put(String(userId), record);
}

async function insertActivationToken(ctx: PluginContext, record: Omit<ActivationTokenRecord, "id">) {
	const activationTokens = ctx.storage.activation_tokens as StorageCollection<ActivationTokenRecord>;
	const id = await nextId(ctx, "activation_tokens");
	await activationTokens.put(String(id), { ...record, id });
}

async function insertRefreshToken(ctx: PluginContext, record: Omit<RefreshTokenRecord, "id">) {
	const refreshTokens = ctx.storage.refresh_tokens as StorageCollection<RefreshTokenRecord>;
	const id = await nextId(ctx, "refresh_tokens");
	await refreshTokens.put(String(id), { ...record, id });
}

async function createSocialAuth(
	ctx: PluginContext,
	input: { userId: number; provider: SocialAuthProvider; providerId: string },
) {
	const socialAuths = ctx.storage.user_social_auths as StorageCollection<UserSocialAuthRecord>;
	const now = new Date().toISOString();
	const id = await nextId(ctx, "user_social_auths");
	await socialAuths.put(String(id), {
		id,
		userId: input.userId,
		provider: input.provider,
		providerId: input.providerId,
		createdAt: now,
	});
}

async function generateUniqueUsername(ctx: PluginContext, base: string) {
	const users = ctx.storage.users as StorageCollection<UserRecord>;
	let candidate = base || "user";

	for (let attempt = 0; attempt < 5; attempt++) {
		const existing = await queryFirst(users, { username: candidate });
		if (!existing) return candidate;
		candidate = `${base}_${randomUUID().split("-")[0]}`;
	}

	return `${base}_${randomUUID().split("-")[0]}`;
}

async function updateUser(ctx: PluginContext, user: UserRecord) {
	const users = ctx.storage.users as StorageCollection<UserRecord>;
	const updated = { ...user, updatedAt: new Date().toISOString() };
	await users.put(String(user.id), updated);
}

async function nextId(ctx: PluginContext, key: string) {
	const current = (await ctx.kv.get<number>(`state:${key}:seq`)) ?? 0;
	const next = current + 1;
	await ctx.kv.set(`state:${key}:seq`, next);
	return next;
}

async function queryFirst<T>(collection: StorageCollection<T>, where: Record<string, unknown>) {
	const result = await collection.query({ where, limit: 1 });
	return result.items[0] ?? null;
}

async function deleteRefreshFamily(collection: StorageCollection<RefreshTokenRecord>, familyId: string) {
	let cursor: string | undefined;
	do {
		const result = await collection.query({ where: { familyId }, limit: 200, cursor });
		await Promise.all(result.items.map((item) => collection.delete(item.id)));
		cursor = result.cursor;
	} while (cursor);
}

async function generateAccessToken(
	ctx: PluginContext,
	payload: { sub: string; email: string; role: Role; sessionId: string },
) {
	const secret = await getJwtSecret(ctx);
	const now = Math.floor(Date.now() / 1000);
	const tokenPayload = {
		...payload,
		iat: now,
		exp: now + ACCESS_TOKEN_TTL_MINUTES * 60,
		iss: ISSUER,
		aud: AUDIENCE,
	};

	const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
	const signature = createHmac("sha256", secret)
		.update(`${encodedHeader}.${encodedPayload}`)
		.digest("base64");

	return `${encodedHeader}.${encodedPayload}.${base64UrlNormalize(signature)}`;
}

function base64UrlEncode(value: string) {
	return base64UrlNormalize(Buffer.from(value).toString("base64"));
}

function base64UrlNormalize(value: string) {
	return value.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getJwtSecret(ctx: PluginContext) {
	const envSecret = process.env.JWT_SECRET;
	if (envSecret) return envSecret;
	const kvSecret = await ctx.kv.get<string>("settings:jwt_secret");
	if (kvSecret) return kvSecret;
	throw new Error("JWT secret is not configured");
}

async function verifyGoogleToken(ctx: PluginContext, idToken: string): Promise<GoogleTokenPayload> {
	const clientId = process.env.GOOGLE_CLIENT_ID ?? (await ctx.kv.get<string>("settings:google_client_id"));
	if (!clientId) throw new Error("Google client id is not configured");

	const httpFetch = ctx.http?.fetch ?? fetch;
	const response = await httpFetch(`${AUTH_PROVIDERS.google.TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
	if (!response.ok) throw new Error("Invalid token");

	const payload = (await response.json()) as GoogleTokenPayload;
	const issuers = AUTH_PROVIDERS.google.ISSUERS as readonly string[];
	if (payload.aud !== clientId || !issuers.includes(payload.iss)) {
		throw new Error("Invalid token");
	}

	return payload;
}

async function hashPassword(password: string) {
	return argon2.hash(password, {
		type: argon2.argon2id,
		memoryCost: 65536,
		timeCost: 2,
	});
}

async function verifyPassword(password: string, hash: string) {
	return argon2.verify(hash, password);
}

function generateOpaqueToken() {
	const rawToken = randomBytes(40).toString("hex");
	const hashedToken = hashToken(rawToken);
	return { rawToken, hashedToken };
}

function hashToken(rawToken: string) {
	return createHash("sha256").update(rawToken).digest("hex");
}

function isLegacyPassword(storedHash: string) {
	return storedHash.startsWith("$wp") || storedHash.startsWith("$P$") || storedHash.startsWith("$H$");
}

async function verifyWordpressPassword(password: string, storedHash: string) {
	if (storedHash.startsWith("$wp")) {
		const hash = storedHash.replace("$wp", "");
		const preHashed = createHmac("sha384", "wp-sha384").update(password.trim()).digest("base64");
		return bcrypt.compare(preHashed, hash);
	}

	if (storedHash.startsWith("$P$") || storedHash.startsWith("$H$")) {
		return verifyPhpass(password, storedHash);
	}

	return false;
}

function verifyPhpass(password: string, storedHash: string) {
	const iterCount = 1 << ITOA64.indexOf(storedHash[3]);
	const salt = storedHash.substring(4, 12);

	let hash = createHash("md5")
		.update(salt + password)
		.digest();
	for (let i = 0; i < iterCount; i++) {
		hash = createHash("md5")
			.update(Buffer.concat([hash, Buffer.from(password)]))
			.digest();
	}

	let encoded = "";
	let i = 0;
	while (i < 16) {
		let value = hash[i++];
		encoded += ITOA64[value & 0x3f];
		if (i < 16) value |= hash[i] << 8;
		encoded += ITOA64[(value >> 6) & 0x3f];
		if (i++ >= 16) break;
		if (i < 16) value |= hash[i] << 16;
		encoded += ITOA64[(value >> 12) & 0x3f];
		if (i++ >= 16) break;
		encoded += ITOA64[(value >> 18) & 0x3f];
	}

	return encoded === storedHash.substring(12);
}

type GoogleTokenPayload = {
	aud: string;
	iss: string;
	sub: string;
	email: string;
	email_verified: boolean | string;
	given_name?: string;
	family_name?: string;
	picture?: string;
};

function addDays(date: Date, days: number) {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}
