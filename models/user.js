import mongoose from "mongoose";

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
  },
  password: {
    type: String,
    required: true,
    minlength: [6, 'Password must be at least 6 characters long'],
  },
  role: {
    type: String,
    enum: ["admin", "base_commander", "logistics_officer"],
    default: "logistics_officer"
  },
  base: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Base",
  }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
export default User;