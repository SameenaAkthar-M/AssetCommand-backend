import express from "express";
import mongoose from "mongoose";
import Asset from "../models/asset.js";
import AssetMovement from "../models/assetMovement.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import Assignment from "../models/assignment.js";
import Transfer from "../models/transfer.js";
const router = express.Router();

router.get("/base-commander", authMiddleware, async (req, res) => {
  try {
    const { base } = req.query;
    if (!base) return res.status(400).json({ assets: [], message: "Base ID is required" });

    const baseId = mongoose.Types.ObjectId.isValid(base) ? new mongoose.Types.ObjectId(base) : base;
    const assets = await Asset.find({ base: baseId }).lean();

    const assetsWithMovements = await Promise.all(
      assets.map(async (asset) => {
        const movements = await AssetMovement.find({ asset: asset._id })
          .sort({ createdAt: 1 })
          .lean();
        return { ...asset, movements };
      })
    );

    res.status(200).json({ assets: assetsWithMovements });
  } catch (err) {
    console.error("Base Commander fetch error:", err);
    res.status(500).json({ assets: [], message: err.message });
  }
});

router.post("/assign", authMiddleware, async (req, res) => {
  try {
    console.log("Assign request body:", req.body);
    const { assetId, quantity, baseId } = req.body;

    if (!assetId || !quantity || !baseId) {
      return res.status(400).json({ message: "assetId, baseId and quantity are required" });
    }

    const asset = await Asset.findById(assetId);
    if (!asset) return res.status(404).json({ message: "Asset not found" });

    if (asset.closingBalance < quantity) {
      return res.status(400).json({ message: "Not enough stock available" });
    }

    asset.closingBalance -= quantity;
    asset.assigned = (asset.assigned || 0) + quantity;
    await asset.save();

    const assignment = await Assignment.create({
      asset: assetId,
      base: baseId,
      quantity,
    });

    await AssetMovement.create({
      asset: assetId,
      type: "assignment",
      quantity,
      balanceAfter: asset.closingBalance,
      base: baseId,
      createdBy: req.user.id
    });

    res.json({ message: "Asset assigned successfully", assignment, asset });
  } catch (err) {
    console.error("Assign error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.post("/expend", authMiddleware, async (req, res) => {
  try {
    const { assetId, quantity, note } = req.body;
    if (!assetId || !quantity) return res.status(400).json({ message: "assetId and quantity are required" });

    const asset = await Asset.findById(assetId);
    if (!asset) return res.status(404).json({ message: "Asset not found" });

    if (asset.closingBalance < quantity)
      return res.status(400).json({ message: "Insufficient balance to expend" });

    asset.closingBalance -= quantity;
    await asset.save();

    const movement = new AssetMovement({
      asset: asset._id,
      type: "Expended",
      quantity,
      balanceAfter: asset.closingBalance,
      note
    });
    await movement.save();

    res.status(200).json({ message: "Expenditure recorded successfully", asset });
  } catch (err) {
    console.error("Expenditure error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/transfer", authMiddleware, async (req, res) => {
  try {
    const { assetId, toBaseId, quantity } = req.body;
    const fromBaseId = req.user.base?._id;

    if (!fromBaseId) return res.status(400).json({ message: "User has no base assigned" });
    if (!assetId || !toBaseId || !quantity) return res.status(400).json({ message: "All fields are required" });

    const asset = await Asset.findById(assetId);
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    if (asset.closingBalance < quantity) return res.status(400).json({ message: "Not enough assets to transfer" });

    const transfer = await Transfer.create({
      asset: assetId,
      fromBase: fromBaseId,
      toBase: toBaseId,
      quantity
    });

    asset.closingBalance -= quantity;
    await asset.save();

    res.status(201).json({ message: "Transfer successful", transfer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/transferhistory", authMiddleware, async (req, res) => {
  try {
    const { baseId } = req.query;

    if (!baseId) return res.status(400).json({ message: "baseId is required" });
    if (!mongoose.Types.ObjectId.isValid(baseId)) {
      return res.status(400).json({ message: "Invalid baseId" });
    }

    const objectId = new mongoose.Types.ObjectId(baseId);
    const transfers = await Transfer.find({
  $or: [{ fromBase: objectId }, { toBase: objectId }]
})
.populate("asset", "name")
.populate("fromBase", "name")
.populate("toBase", "name")
.sort({ createdAt: -1 });

res.json({ transfers });
  } catch (err) {
    console.error("Error in transfer history route:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
