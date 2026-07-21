import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  age: number;
  gender?: 'M' | 'F';
  height?: number;
  weight?: number;
  targetWeight?: number;
  unitSystem?: 'metric' | 'imperial';
  bmi?: number;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  calorieOffset?: number;
  profileCompleted?: boolean;
  [key: string]: unknown;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  age: number;
  createdAt?: string;
  profile?: UserProfile | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const profileSchema = new mongoose.Schema<UserProfile>(
  {
    name: String,
    age: Number,
    gender: String,
    height: Number,
    weight: Number,
    targetWeight: Number,
    activityLevel: String,
    goal: String,
    profileCompleted: { type: Boolean, default: false },
  },
  { _id: false, strict: false }
);

const userSchema = new mongoose.Schema<User>(
  {
    id: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    profile: { type: profileSchema, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false }
);

const UserModel = mongoose.models['User'] as mongoose.Model<User> | undefined
  ?? mongoose.model<User>('User', userSchema);

// ─────────────────────────────────────────────────────────────────────────────
// CONNECT
// ─────────────────────────────────────────────────────────────────────────────

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set in environment variables.');
  }
  await mongoose.connect(uri);
  console.log('[MongoDB] Connected successfully.');
}

// ─────────────────────────────────────────────────────────────────────────────
// DB OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Find a user by email (case-insensitive). Returns null if not found. */
export async function findUserByEmail(email: string): Promise<User | null> {
  return UserModel.findOne({ email: email.toLowerCase().trim() }).lean<User>();
}

/** Find a user by their custom string `id` field. Returns null if not found. */
export async function findUserById(id: string): Promise<User | null> {
  return UserModel.findOne({ id }).lean<User>();
}

/**
 * Create a new user document.
 * @returns The newly created user (plain object).
 */
export async function createUser(user: Omit<User, 'id'>): Promise<User> {
  const newUser = new UserModel({
    ...user,
    id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
    email: user.email.toLowerCase().trim(),
    createdAt: new Date().toISOString(),
  });
  await newUser.save();
  return newUser.toObject() as User;
}

/**
 * Merge profile fields into an existing user.
 * Also syncs top-level `name` and `age` if the profile contains them.
 * @returns Updated user (plain object), or null if not found.
 */
export async function updateUserProfile(
  userId: string,
  profileData: Partial<UserProfile>
): Promise<User | null> {
  const user = await UserModel.findOne({ id: userId });
  if (!user) return null;

  const existingProfile: UserProfile = (user.profile as UserProfile) ?? {
    name: user.name,
    age: user.age,
    profileCompleted: false,
  };

  user.profile = { ...existingProfile, ...profileData } as UserProfile;

  if (profileData.name) user.name = profileData.name;
  if (profileData.age) user.age = profileData.age;

  await user.save();
  return user.toObject() as User;
}

/**
 * Update a user's password hash.
 * @returns True if updated, false if user not found.
 */
export async function updateUserPassword(
  userId: string,
  newPasswordHash: string
): Promise<boolean> {
  const result = await UserModel.updateOne(
    { id: userId },
    { $set: { passwordHash: newPasswordHash } }
  );
  return result.matchedCount > 0;
}
