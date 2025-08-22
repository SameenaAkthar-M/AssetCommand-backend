import express from 'express';
import Asset from "../models/asset.js";
import Base from "../models/base.js";
import Purchase from "../models/purchase.js";
import Transfer from "../models/transfer.js";
import Assignment from "../models/assignment.js";
import Expenditure from "../models/expenditure.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { authorizeRoles } from "../middlewares/roleMiddleware.js";
import User from "../models/user.js"
import bcrypt from 'bcryptjs';
import AssetMovement from '../models/assetMovement.js'
import mongoose from 'mongoose';

const router = express.Router();

router.use(authMiddleware, authorizeRoles("admin"));

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
    const assetId = req.params.id;
    await Asset.findByIdAndDelete(assetId);
    await AssetMovement.deleteMany({ asset: assetId });
    await Transfer.deleteMany({ asset: assetId });
    await Assignment.deleteMany({ asset: assetId });
    res.json({ success: true, message: "Asset and all related records deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createBase = async (req, res) => {
  try {
    const base = await Base.create(req.body);
    res.status(201).json({ success: true, base });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getBases = async (req, res) => {
  try {
    const bases = await Base.find();
    res.json({ success: true, bases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteBase = async (req, res) => {
  try {
    const baseId = req.params.id;
    const defaultBase = await Base.findOne({ name: "Default Base" });
    if (!defaultBase) {
      return res.status(400).json({ success: false, message: "Default Base not found. Please create it first." });
    }
    await Asset.updateMany({ base: baseId }, { base: defaultBase._id });

    await Purchase.updateMany({ base: baseId }, { base: defaultBase._id });
    await Assignment.updateMany({ base: baseId }, { base: defaultBase._id });
    await Expenditure.updateMany({ base: baseId }, { base: defaultBase._id });

    await Transfer.updateMany({ fromBase: baseId }, { fromBase: defaultBase._id });
    await Transfer.updateMany({ toBase: baseId }, { toBase: defaultBase._id });

    await Base.findByIdAndDelete(baseId);

    res.json({ success: true, message: "Base deleted and all related records reassigned to Default Base" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createPurchase = async (req, res) => {
  try {
    const { assetId, quantity, base } = req.body;

    const asset = await Asset.findById(assetId);
    if (!asset) return res.status(404).json({ message: "Asset not found" });

    asset.closingBalance += quantity;
    await asset.save();

    const purchase = await Purchase.create({ asset: assetId, quantity, base });

    await AssetMovement.create({
      asset: asset._id,
      base,
      type: "purchase",
      quantity,
      balanceAfter: asset.closingBalance,
      createdBy: req.user._id,
      remarks: "Purchase added",
    });

    res.status(201).json(purchase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find().populate("asset base");
    res.json({ success: true, purchases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deletePurchase = async (req, res) => {
  try {
    const purchaseId = req.params.id;

    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) return res.status(404).json({ message: "Purchase not found" });

    const asset = await Asset.findById(purchase.asset);
    if (asset) {
      asset.closingBalance -= purchase.quantity;
      await asset.save();

      await AssetMovement.create({
        asset: asset._id,
        base: purchase.base,
        type: "purchase",
        quantity: -purchase.quantity,
        balanceAfter: asset.closingBalance,
        createdBy: req.user._id,
        remarks: "Purchase deleted/reversed",
      });
    }

    await purchase.deleteOne();

    res.json({ message: "Purchase deleted successfully" });
  } catch (error) {
    console.error("Delete purchase error:", error);
    res.status(500).json({ message: error.message });
  }
};

const createTransfer = async (req, res) => {
  try {
    const { assetId, fromBase, toBase, quantity } = req.body;

    if (!assetId || !fromBase || !toBase || !quantity) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const asset = await Asset.findOne({
      _id: new mongoose.Types.ObjectId(assetId),
      base: new mongoose.Types.ObjectId(fromBase),
    });
    if (!asset) return res.status(404).json({ message: "Asset not found in fromBase" });

    if (asset.closingBalance < quantity) {
      return res.status(400).json({ message: "Not enough balance to transfer" });
    }

    asset.closingBalance -= quantity;
    await asset.save();

    let targetAsset = await Asset.findOne({
      name: asset.name,
      base: new mongoose.Types.ObjectId(toBase),
    });
    if (!targetAsset) {
      targetAsset = await Asset.create({
        name: asset.name,
        type: asset.type,
        base: new mongoose.Types.ObjectId(toBase),
        openingBalance: 0,
        closingBalance: 0,
      });
    }

    targetAsset.closingBalance += quantity;
    await targetAsset.save();

    const transfer = await Transfer.create({ asset: asset._id, fromBase, toBase, quantity });

    await AssetMovement.create({
      asset: asset._id,
      base: new mongoose.Types.ObjectId(fromBase),
      type: "transfer_out",
      quantity,
      balanceAfter: asset.closingBalance,
      createdBy: req.user._id,
    });

    await AssetMovement.create({
      asset: targetAsset._id,
      base: new mongoose.Types.ObjectId(toBase),
      type: "transfer_in",
      quantity,
      balanceAfter: targetAsset.closingBalance,
      createdBy: req.user._id,
    });

    res.status(201).json(transfer);
  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).json({ message: error.message });
  }
};

const getTransfers = async (req, res) => {
  try {
    const transfers = await Transfer.find().populate("asset fromBase toBase");
    res.json({ success: true, transfers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteTransfer = async (req, res) => {
  try {
    const { id } = req.params;

    const transfer = await Transfer.findById(id);
    if (!transfer) return res.status(404).json({ message: "Transfer not found" });

    const fromAsset = await Asset.findById(transfer.asset);
    const toAsset = await Asset.findOne({ name: fromAsset.name, base: transfer.toBase });

    if (!fromAsset || !toAsset) {
      return res.status(404).json({ message: "Related asset not found" });
    }

    fromAsset.closingBalance += transfer.quantity;
    await fromAsset.save();

    toAsset.closingBalance -= transfer.quantity;
    await toAsset.save();

    await transfer.deleteOne();

    await AssetMovement.create({
      asset: fromAsset._id,
      base: transfer.fromBase,
      type: "transfer_in",
      quantity: transfer.quantity,
      balanceAfter: fromAsset.closingBalance,
      createdBy: req.user._id,
      remarks: "Transfer deleted/reversed",
    });

    await AssetMovement.create({
      asset: toAsset._id,
      base: transfer.toBase,
      type: "transfer_out",
      quantity: transfer.quantity,
      balanceAfter: toAsset.closingBalance,
      createdBy: req.user._id,
      remarks: "Transfer deleted/reversed",
    });

    res.json({ message: "Transfer deleted and balances rolled back" });
  } catch (error) {
    console.error("Delete transfer error:", error);
    res.status(500).json({ message: error.message });
  }
};

const createAssignment = async (req, res) => {
  try {
    const { assetId, base, quantity, assignedTo } = req.body;

    const asset = await Asset.findById(assetId);
    if (!asset) return res.status(404).json({ message: "Asset not found" });

    if (asset.closingBalance < quantity) {
      return res.status(400).json({ message: "Not enough balance to assign" });
    }

    asset.closingBalance -= quantity;
    await asset.save();

    const assignment = await Assignment.create({ asset: assetId, base, quantity, assignedTo });

    await AssetMovement.create({
      asset: asset._id,
      base,
      type: "assignment",
      quantity,
      balanceAfter: asset.closingBalance,
      createdBy: req.user._id,
    });

    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const getAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find().populate("asset base");
    res.json({ success: true, assignments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await Assignment.findById(id);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });

    const asset = await Asset.findById(assignment.asset);
    if (!asset) return res.status(404).json({ message: "Asset not found" });

    asset.closingBalance += assignment.quantity;
    await asset.save();

    await assignment.deleteOne();

    await AssetMovement.create({
  asset: asset._id,
  base: assignment.base,
  type: "assignment",
  quantity: -assignment.quantity,
  balanceAfter: asset.closingBalance,
  createdBy: req.user._id,
  remarks: "Assignment deleted/reversed",
});

    res.json({ message: "Assignment deleted and balance rolled back" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createExpenditure = async (req, res) => {
  try {
    const { asset, base, quantity, reason } = req.body;

    if (!asset || !base || !quantity) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const assetDoc = await Asset.findById(asset);
    if (!assetDoc) return res.status(404).json({ message: "Asset not found" });

    const qty = Number(quantity);
    if (assetDoc.closingBalance < qty) {
      return res.status(400).json({ message: "Not enough balance to expend" });
    }

    assetDoc.closingBalance -= qty;
    await assetDoc.save();

    const expenditure = await Expenditure.create({
      asset: assetDoc._id,
      base: new mongoose.Types.ObjectId(base),
      quantity: qty,
      reason: reason || "N/A",
    });

    await AssetMovement.create({
      asset: assetDoc._id,
      base: new mongoose.Types.ObjectId(base),
      type: "expenditure",
      quantity: qty,
      balanceAfter: assetDoc.closingBalance,
      createdBy: req.user._id,
      remarks: reason || "Expenditure",
    });

    res.status(201).json({ success: true, expenditure });
  } catch (error) {
    console.error("Expenditure creation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getExpenditures = async (req, res) => {
  try {
    const expenditures = await Expenditure.find().populate("asset base");
    res.json({ success: true, expenditures });
  } catch (err) {
    console.error("Get expenditures error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteExpenditure = async (req, res) => {
  try {
    const { id } = req.params;

    const expenditure = await Expenditure.findById(id);
    if (!expenditure) return res.status(404).json({ message: "Expenditure not found" });

    const asset = await Asset.findById(expenditure.asset);
    if (!asset) return res.status(404).json({ message: "Asset not found" });

    asset.closingBalance += expenditure.quantity;
    await asset.save();

    await AssetMovement.create({
      asset: asset._id,
      base: expenditure.base,
      type: "expenditure",
      quantity: -expenditure.quantity,
      balanceAfter: asset.closingBalance,
      createdBy: req.user._id,
      remarks: "Expenditure deleted/reversed",
    });

    await expenditure.deleteOne();

    res.json({ message: "Expenditure deleted successfully" });
  } catch (error) {
    console.error("Delete expenditure error:", error);
    res.status(500).json({ message: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, base } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      base: role === "base_commander" ? base : null,
    });

    res.status(201).json({
      success: true,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, base: user.base }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



const getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("base", "name");
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password");
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.post("/asset", createAsset);
router.get("/asset", getAssets);
router.put("/asset/:id", updateAsset);
router.delete("/asset/:id", deleteAsset);

router.post("/base", createBase);
router.get("/base", getBases);
router.delete("/base/:id",deleteBase);

router.post("/purchase", createPurchase);
router.get("/purchase", getPurchases);
router.delete("/purchase/:id",deletePurchase);

router.post("/transfer", createTransfer);
router.get("/transfer", getTransfers);
router.delete("/transfer/:id", deleteTransfer);

router.post("/assignment", createAssignment);
router.get("/assignment", getAssignments);
router.delete("/assignment/:id",deleteAssignment)

router.post("/expenditure", createExpenditure);
router.get("/expenditure", getExpenditures);
router.delete("/expenditure/:id", deleteExpenditure);

router.post("/users/create", createUser);
router.get("/users", getUsers);
router.delete("/users/:id", deleteUser);
router.put("/users/:id/role", updateUserRole);


export default router;