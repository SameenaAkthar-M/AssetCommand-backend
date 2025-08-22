import mongoose from "mongoose";

const assetMovement = mongoose.Schema({
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Asset",
    required: true
  },
  base: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Base",
    required: true
  },
  type: {
    type: String,
    enum: ["purchase", "transfer_in", "transfer_out", "assignment", "expenditure"],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  remarks: {
    type: String
  }
}, { timestamps: true });

const AssetMovement = mongoose.model("AssetMovement", assetMovement);
export default AssetMovement;
