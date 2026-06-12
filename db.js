import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'users.json');
// Ensure the db file exists
function initDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ users: [] }, null, 2), 'utf-8');
    }
}
export function readDB() {
    initDB();
    try {
        const data = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(data);
    }
    catch (error) {
        console.error("Database read failed, resetting:", error);
        return { users: [] };
    }
}
export function writeDB(db) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
    }
    catch (error) {
        console.error("Database write failed:", error);
    }
}
export function findUserByEmail(email) {
    const db = readDB();
    const target = email.toLowerCase().trim();
    return db.users.find(u => u.email.toLowerCase() === target);
}
export function findUserById(id) {
    const db = readDB();
    return db.users.find(u => u.id === id);
}
export function createUser(user) {
    const db = readDB();
    const newUser = {
        ...user,
        id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
        email: user.email.toLowerCase().trim(),
        createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    writeDB(db);
    return newUser;
}
export function updateUserProfile(userId, profile) {
    const db = readDB();
    const index = db.users.findIndex(u => u.id === userId);
    if (index === -1)
        return null;
    const user = db.users[index];
    user.profile = {
        ...(user.profile || {
            name: user.name,
            age: user.age,
            profileCompleted: false
        }),
        ...profile
    };
    // Sync user name/age if changed in profile
    if (profile.name)
        user.name = profile.name;
    if (profile.age)
        user.age = profile.age;
    db.users[index] = user;
    writeDB(db);
    return user;
}
export function updateUserPassword(userId, newPasswordHash) {
    const db = readDB();
    const index = db.users.findIndex(u => u.id === userId);
    if (index === -1)
        return false;
    db.users[index].passwordHash = newPasswordHash;
    writeDB(db);
    return true;
}
