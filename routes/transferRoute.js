import express from "express";
import Transfer from "../models/transfer.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/alltransfer", authMiddleware, async (req, res) => {
  try {
    const transfers = await Transfer.find()
      .populate("asset", "name")
      .populate("fromBase", "name")
      .populate("toBase", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, transfers });
  } catch (err) {
    console.error("Error fetching transfers:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;