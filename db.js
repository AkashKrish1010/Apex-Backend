import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// USER SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
const profileSchema = new mongoose.Schema({
    name: String,
    age: Number,
    gender: String,
    height: Number,
    weight: Number,
    targetWeight: Number,
    activityLevel: String,
    goal: String,
    profileCompleted: { type: Boolean, default: false }
}, { _id: false, strict: false });

const userSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    profile: { type: profileSchema, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() }
}, { versionKey: false });

const User = mongoose.models.User || mongoose.model('User', userSchema);

// ─────────────────────────────────────────────────────────────────────────────
// CONNECT
// ─────────────────────────────────────────────────────────────────────────────
export async function connectDB() {
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
export async function findUserByEmail(email) {
    return User.findOne({ email: email.toLowerCase().trim() }).lean();
}

/** Find a user by their custom string `id` field. Returns null if not found. */
export async function findUserById(id) {
    return User.findOne({ id }).lean();
}

/**
 * Create a new user document.
 * @param {{ email: string, passwordHash: string, name: string, age: number }} user
 * @returns {Promise<object>} The newly created user (plain object).
 */
export async function createUser(user) {
    const newUser = new User({
        ...user,
        id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
        email: user.email.toLowerCase().trim(),
        createdAt: new Date().toISOString()
    });
    await newUser.save();
    return newUser.toObject();
}

/**
 * Merge profile fields into an existing user.
 * Also syncs top-level `name` and `age` if the profile contains them.
 * @returns {Promise<object|null>} Updated user (plain object), or null if not found.
 */
export async function updateUserProfile(userId, profileData) {
    const user = await User.findOne({ id: userId });
    if (!user) return null;

    // Merge existing profile with new data
    const existingProfile = user.profile ? user.profile.toObject() : {
        name: user.name,
        age: user.age,
        profileCompleted: false
    };

    user.profile = { ...existingProfile, ...profileData };

    // Sync top-level fields if changed in profile
    if (profileData.name) user.name = profileData.name;
    if (profileData.age) user.age = profileData.age;

    await user.save();
    return user.toObject();
}

/**
 * Update a user's password hash.
 * @returns {Promise<boolean>} True if updated, false if user not found.
 */
export async function updateUserPassword(userId, newPasswordHash) {
    const result = await User.updateOne({ id: userId }, { $set: { passwordHash: newPasswordHash } });
    return result.matchedCount > 0;
}
