"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const mongoose_1 = __importDefault(require("mongoose"));
const product_model_js_1 = require("../mongoDb/models/product.model.js");
const sales_model_js_1 = require("../mongoDb/models/sales.model.js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error("MongoDB URI is missing. Add MONGO_URI to your .env file.");
    process.exit(1);
}
mongoose_1.default
    .connect(MONGO_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
});
const BATCH_SIZE = 1000;
const importData = async (filePath, type) => {
    try {
        let totalSalesInserted = 0;
        if (type === 'products') {
            const products = [];
            fs_1.default.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on("data", (row) => {
                products.push({
                    ProductID: row.ProductID,
                    ProductName: row.ProductName,
                    Category: row.Category,
                    Price: parseFloat(row.Price),
                });
                if (products.length === BATCH_SIZE) {
                    product_model_js_1.Product.insertMany(products)
                        .then(() => {
                        totalSalesInserted += products.length;
                        console.log(`Inserted ${BATCH_SIZE} products.`);
                        products.length = 0;
                    })
                        .catch(err => console.error("Error inserting batch of products:", err));
                }
            })
                .on("end", async () => {
                if (products.length > 0) {
                    await product_model_js_1.Product.insertMany(products);
                    totalSalesInserted += products.length;
                    console.log(`Inserted remaining ${products.length} products.`);
                }
                console.log("Product CSV file successfully processed.");
                mongoose_1.default.connection.close();
            });
        }
        else if (type === 'sales') {
            const sales = [];
            fs_1.default.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on("data", (row) => {
                sales.push({
                    SaleID: row.SaleID,
                    ProductID: row.ProductID,
                    Quantity: parseInt(row.Quantity, 10),
                    Date: row.Date,
                    TotalAmount: parseFloat(row.TotalAmount),
                });
                if (sales.length === BATCH_SIZE) {
                    sales_model_js_1.Sale.insertMany(sales)
                        .then(() => {
                        totalSalesInserted += sales.length;
                        console.log(`Inserted ${BATCH_SIZE} sales.`);
                        sales.length = 0;
                    })
                        .catch(err => console.error("Error inserting batch of sales:", err));
                }
            })
                .on("end", async () => {
                if (sales.length > 0) {
                    await sales_model_js_1.Sale.insertMany(sales);
                    totalSalesInserted += sales.length;
                    console.log(`Inserted remaining ${sales.length} sales.`);
                }
                console.log(`Total sales inserted: ${totalSalesInserted}`);
                console.log("Sales CSV file successfully processed.");
                mongoose_1.default.connection.close();
            });
        }
    }
    catch (error) {
        console.error("Error inserting data:", error);
        mongoose_1.default.connection.close();
    }
};
// run node dist/scripts/import-data.js to insert products data 
importData("src/assets/products.csv", 'products');
// Uncomment to import sales data and run npm run build then run this commande   node dist/scripts/import-data.js
//importData("src/assets/sales.csv", 'sales'); 
//# sourceMappingURL=import-data.js.map