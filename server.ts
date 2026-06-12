import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  findUserByEmail, 
  createUser, 
  updateUserProfile, 
  updateUserPassword, 
  findUserById 
} from "./db.js";
import { 
  generateToken, 
  authenticateToken, 
  AuthRequest 
} from "./auth.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable CORS for mobile app requests
app.use(cors());
app.use(express.json());

// Initialize Google Gemini Client
const apiKey = (process.env.GEMINI_API_KEY || "").replace(/['"]/g, "").trim();

const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name, age } = req.body;
    if (!email || !password || !name || age === undefined) {
      res.status(400).json({ error: "Missing required parameters (email, password, name, age)." });
      return;
    }

    const existing = findUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: "Email target already initialized/registered." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = createUser({
      email,
      passwordHash,
      name,
      age: Number(age),
    });

    const token = generateToken(user.id, user.email);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age
      }
    });
  } catch (error) {
    console.error("Registration failed:", error);
    res.status(500).json({ error: "Internal server error during registration." });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const user = findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Invalid credential parameters." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credential parameters." });
      return;
    }

    const token = generateToken(user.id, user.email);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age
      },
      profile: user.profile || null
    });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).json({ error: "Internal server error during verification." });
  }
});

// Forgot password
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email is required." });
      return;
    }

    const user = findUserByEmail(email);
    if (!user) {
      // Return 200 for security, but with warning
      res.json({ 
        success: true, 
        message: "If email exists in system baseline, recovery telemetry has been launched." 
      });
      return;
    }

    res.json({
      success: true,
      message: "RECOVERY PROTOCOL INITIATED. Mock recovery token has been synchronized.",
      resetCode: "APEX-RCVR-" + Math.floor(100000 + Math.random() * 900000)
    });
  } catch (error) {
    console.error("Forgot password failed:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Change password (auth required)
app.post("/api/auth/change-password", authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      res.status(400).json({ error: "Both old and new passwords are required." });
      return;
    }

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized access profile." });
      return;
    }

    const user = findUserById(userId);
    if (!user) {
      res.status(404).json({ error: "User profile not found." });
      return;
    }

    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "Current password validation failed." });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    updateUserPassword(userId, newHash);

    res.json({ success: true, message: "Credentials successfully updated." });
  } catch (error) {
    console.error("Change password failed:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Profile update (auth required)
app.post("/api/auth/profile", authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized access profile." });
      return;
    }

    const profileData = req.body;
    const updated = updateUserProfile(userId, profileData);
    if (!updated) {
      res.status(404).json({ error: "User profile update failed." });
      return;
    }

    res.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        age: updated.age
      },
      profile: updated.profile
    });
  } catch (error) {
    console.error("Profile sync failed:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Current User Details
app.get("/api/auth/me", authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized access profile." });
      return;
    }

    const user = findUserById(userId);
    if (!user) {
      res.status(404).json({ error: "User baseline not found." });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age
      },
      profile: user.profile || null
    });
  } catch (error) {
    console.error("Get user details failed:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MEAL & REC ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// Endpoint: Parse Meal Text to estimate macros
app.post("/api/parse-meal", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: "Missing or invalid text input" });
      return;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: `You are a nutrition assistant. Determine if the following input describes a valid edible food item or meal.
If the input is NOT food/edible (e.g., random characters, gibberish, computer code, programming terms, insults, or objects like tables/chairs/cars), set "isValidFood" to false, "name" to "invalid", and all macro values to 0.
Otherwise, if it is a valid food/meal, set "isValidFood" to true and estimate its name and macronutrients (calories, protein, carbs, fat).
Input text: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValidFood: { type: Type.BOOLEAN },
            name: { type: Type.STRING },
            calories: { type: Type.NUMBER },
            protein: { type: Type.NUMBER },
            carbs: { type: Type.NUMBER },
            fat: { type: Type.NUMBER }
          },
          required: ["isValidFood", "name", "calories", "protein", "carbs", "fat"]
        }
      }
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error) {
    console.error("Meal parsing failed:", error);
    res.status(500).json({ error: "Failed to parse meal macros" });
  }
});

// Endpoint: Generate fitness and diet recommendations
app.post("/api/recommendations", async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      res.status(400).json({ error: "Missing or invalid data telemetry" });
      return;
    }

    const { bmi, bmiCategory, currentWeight, startWeight, avgCalories, avgProtein, recentWorkouts, age, gender, activityLevel } = data;

    const prompt = `You are an expert fitness and nutrition AI coach. Based on the following user data, provide highly personalized recommendations. 
Format your response exactly as JSON with 3 specific sections (strings): dietRecommendations, workoutAdjustments, progressAnalysis.
Be specific, motivating, and actionable. Avoid using asterisks. Keep it relatively concise but impactful.

User Profile:
- BMI: ${bmi} (${bmiCategory})
- Current Weight: ${currentWeight}kg, Starting Weight: ${startWeight}kg
- Recent meals (last 3 days avg): ${avgCalories} kcal/day, ${avgProtein}g protein
- Recent workouts count: ${recentWorkouts}
- Age: ${age}, Gender: ${gender}
- Activity Level: ${activityLevel || "moderate"}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dietRecommendations: { type: Type.STRING },
            workoutAdjustments: { type: Type.STRING },
            progressAnalysis: { type: Type.STRING }
          },
          required: ["dietRecommendations", "workoutAdjustments", "progressAnalysis"]
        }
      }
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error) {
    console.error("Coaching analysis failed:", error);
    res.status(500).json({ error: "Failed to generate coaching suggestions" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "online", time: new Date().toISOString() });
});

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`===========================================`);
  console.log(` APEX FITNESS STANDALONE BACKEND RUNNING`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(`===========================================`);
});
