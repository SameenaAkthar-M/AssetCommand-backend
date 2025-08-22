import express from "express";
import Base from "../models/base.js";
const router = express.Router();

router.get("/allbase", async (req, res) => {
  try {
    const bases = await Base.find();
    res.json(bases);
  } catch (err) {
    res.status(500).json({ error: "Error fetching bases" });
  }
});

export default router;
