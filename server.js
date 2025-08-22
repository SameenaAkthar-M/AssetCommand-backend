import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import cors from 'cors';
import userRoute from './routes/authRoute.js'
import adminRoute from "./routes/adminRoute.js";
import commanderRoutes from "./routes/commandarRoute.js"
import baseRoutes from "./routes/base.js";
import assetRoute from "./routes/assetRoute.js"
import purchaseRoute from "./routes/purchaseRoute.js"
import transferRoute from "./routes/transferRoute.js"

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

connectDB();
app.use(express.json());
app.use(cors());

app.use("/api/users", userRoute);
app.use("/api/admin", adminRoute); 
app.use("/api/dashboard", commanderRoutes);
app.use("/api/base", baseRoutes);
app.use("/api/asset",assetRoute);
app.use("/api/purchase",purchaseRoute);
app.use("/api/transfer",transferRoute)

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});