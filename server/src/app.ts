import express from "express";
import cors from "cors";
import path from "node:path";
import routes from "./routes";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api/v1/", routes);

app.use("/api/v1/", routes);

export default app;
