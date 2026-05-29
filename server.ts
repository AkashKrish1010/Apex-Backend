import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

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
