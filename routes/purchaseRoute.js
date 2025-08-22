import express from "express";
import Purchase from "../models/purchase.js";
import Asset from "../models/asset.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/purchasehistory", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    let query = {};
    if (user.role === "logistics_officer" && user.base) {
      query.base = user.base;
    }

    const purchases = await Purchase.find(query).populate("base", "name");

    const purchasesWithAssetName = await Promise.all(
      purchases.map(async (p) => {
        let assetName = "N/A";
        if (p.asset) {
          const assetDoc = await Asset.findById(p.asset).select("name");
          if (assetDoc) assetName = assetDoc.name;
        }
        return {
          _id: p._id,
          quantity: p.quantity,
          date: p.date,
          base: p.base,
          asset: { _id: p.asset, name: assetName },
        };
      })
    );

    console.log(purchasesWithAssetName);

    res.json({ purchases: purchasesWithAssetName });
  } catch (err) {
    console.error("Error fetching purchases:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
