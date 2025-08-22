import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import Asset from "../models/asset.js";
import AssetMovement from "../models/assetMovement.js";
import mongoose from "mongoose";

const router = express.Router();

const createAsset = async (req, res) => {
  try {
    const { name, type, base, openingBalance } = req.body;

    if (!name || !type || !base || openingBalance === undefined) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const opening = Number(openingBalance);
    if (isNaN(opening)) {
      return res.status(400).json({ message: "Opening balance must be a number" });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized: user not found" });
    }

    const asset = await Asset.create({
      name,
      type,
      base: new mongoose.Types.ObjectId(base),
      openingBalance: opening,
      closingBalance: opening,
    });

    await AssetMovement.create({
      asset: asset._id,
      base: new mongoose.Types.ObjectId(base),
      type: "purchase",
      quantity: opening,
      balanceAfter: opening,
      createdBy: new mongoose.Types.ObjectId(req.user.id),
      remarks: "Initial stock",
    });

    res.status(201).json({ message: "Asset created successfully", asset });
  } catch (error) {
    console.error("Create asset error:", error);
    res.status(500).json({ message: error.message });
  }
};

const getAssets = async (req, res) => {
  try {
    const assets = await Asset.find().populate("base");
    res.json({ success: true, assets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateAsset = async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, asset });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteAsset = async (req, res) => {
  try {
    await Asset.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Asset deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.post("/create", authMiddleware, createAsset);
router.get("/allasset", authMiddleware, getAssets);
router.put("/:id", authMiddleware, updateAsset);
router.delete("/:id", authMiddleware, deleteAsset);

export default router;
