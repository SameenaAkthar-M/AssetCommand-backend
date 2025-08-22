import mongoose from "mongoose";

const expenditureSchema = mongoose.Schema({
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
  reason: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Expenditure = mongoose.model("Expenditure", expenditureSchema);
export default Expenditure;
