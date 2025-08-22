import mongoose from "mongoose";

const assetSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["Vehicle", "Weapon", "Ammunition", "Equipment"],
    required: true
  },
  base: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Base",
    required: true
  },
  openingBalance: {
    type: Number,
    default: 0
  },
  closingBalance: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const Asset = mongoose.model("Asset", assetSchema);
export default Asset;
