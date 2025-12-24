import mongoose from "mongoose";
export async function connectDb(mongoUri) {
    mongoose.set("strictQuery", true);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
    return mongoose.connection;
}
//# sourceMappingURL=db.js.map