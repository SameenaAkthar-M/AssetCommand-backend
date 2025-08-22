import mongoose from "mongoose";

const transferSchema = mongoose.Schema({
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Asset",
    required: true
  },
  fromBase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Base",
    required: true
  },
  toBase: {
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

const Transfer = mongoose.model("Transfer", transferSchema);
export default Transfer;
