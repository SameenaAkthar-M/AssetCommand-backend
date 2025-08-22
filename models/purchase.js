import mongoose from "mongoose";

const purchaseSchema = mongoose.Schema({
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
  quantity: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Purchase = mongoose.model("Purchase", purchaseSchema);
export default Purchase;
