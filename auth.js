import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'apex_tactical_secret_key_2026';
export function generateToken(userId, email) {
    return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' });
}
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
    if (!token) {
        res.status(401).json({ error: "Access denied. Authentication token missing." });
        return;
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(403).json({ error: "Invalid or expired authentication token." });
    }
}
