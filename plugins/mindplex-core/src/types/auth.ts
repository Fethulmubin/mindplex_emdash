export type Role = "user" | "admin" | "moderator" | "collaborator" | "editor";

export type SocialAuthProvider = "google" | "github";

export type SocialMedia = {
	twitter?: string;
	linkedin?: string;
	github?: string;
	website?: string;
};

export type SessionMetadata = {
	ip?: string;
	userAgent?: string;
	deviceType?: string;
	location?: string;
};

export type UserRecord = {
	id: number;
	username: string;
	email: string;
	passwordHash?: string | null;
	role: Role;
	isActivated: boolean;
	createdAt: string;
	updatedAt: string;
};

export type UserProfileRecord = {
	userId: number;
	firstName?: string | null;
	lastName?: string | null;
	avatarUrl?: string | null;
	bio?: string | null;
	dateOfBirth?: string | null;
	gender?: string | null;
	education?: string | null;
	socialMedia?: SocialMedia;
};

export type UserPreferencesRecord = {
	userId: number;
	theme?: "light" | "dark" | "system";
	privacyAge?: "public" | "private" | "followersOnly";
	privacyGender?: "public" | "private" | "followersOnly";
	privacyEducation?: "public" | "private" | "followersOnly";
};

export type UserNotificationSettingsRecord = {
	userId: number;
	notifyPublications: boolean;
	notifyFollower: boolean;
	notifyInteraction: boolean;
	notifyWeekly: boolean;
	notifyUpdates: boolean;
};

export type UserSocialAuthRecord = {
	id: number;
	userId: number;
	provider: SocialAuthProvider;
	providerId: string;
	createdAt: string;
};

export type RefreshTokenRecord = {
	id: number;
	userId: number;
	token: string;
	familyId: string;
	isRevoked: boolean;
	metadata?: SessionMetadata;
	expiresAt: string;
	familyExpiresAt: string;
	createdAt: string;
};

export type ActivationTokenRecord = {
	id: number;
	userId: number;
	token: string;
	expiresAt: string;
	createdAt: string;
};
