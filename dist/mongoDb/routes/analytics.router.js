"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const sales_model_js_1 = require("../models/sales.model.js");
const router = require("express").Router();
exports.router = router;
router.get("/analytics/total_sales", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            const allTimeTotalSales = await sales_model_js_1.Sale.aggregate([
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: "$TotalAmount" }
                    }
                }
            ]);
            if (!allTimeTotalSales || allTimeTotalSales.length === 0) {
                return res.status(200).json({ totalSales: 0 });
            }
            return res.status(200).json({ totalSales: allTimeTotalSales[0].totalAmount });
        }
        const from = new Date(startDate);
        const to = new Date(endDate);
        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            return res.status(400).json({ error: "Les dates startDate et endDate doivent être valides" });
        }
        const totalSales = await sales_model_js_1.Sale.aggregate([
            {
                $match: {
                    Date: {
                        $gte: from,
                        $lte: to,
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$TotalAmount" },
                },
            },
        ]);
        if (!totalSales || totalSales.length === 0) {
            return res.status(200).json({ totalSales: 0 });
        }
        return res.status(200).json({ totalSales: totalSales[0].totalAmount });
    }
    catch (e) {
        console.error("Erreur lors de la récupération des ventes :", e);
        return res.status(500).send("Erreur serveur");
    }
});
router.get("/analytics/trending_products", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let matchStage = null;
        if (startDate && endDate) {
            try {
                const from = new Date(decodeURIComponent(startDate));
                const to = new Date(decodeURIComponent(endDate));
                if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                    return res.status(400).json({
                        error: "Les dates startDate et endDate doivent être valides",
                        debug: {
                            startDate,
                            endDate,
                            parsedStartDate: from.toString(),
                            parsedEndDate: to.toString(),
                        }
                    });
                }
                matchStage = {
                    $match: {
                        Date: {
                            $gte: from,
                            $lte: to
                        }
                    }
                };
            }
            catch (error) {
                console.error('Date parsing error:', error);
                return res.status(400).json({
                    error: "Les dates startDate et endDate doivent être valides",
                    details: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        const pipeline = [
            ...(matchStage ? [matchStage] : []),
            {
                $lookup: {
                    from: "products",
                    localField: "ProductID",
                    foreignField: "ProductID",
                    as: "productDetails",
                }
            },
            { $unwind: "$productDetails" },
            {
                $group: {
                    _id: "$ProductID",
                    totalQuantity: { $sum: { $toInt: "$Quantity" } },
                    productName: { $first: "$productDetails.ProductName" },
                }
            },
            {
                $project: {
                    _id: 0,
                    productId: "$_id",
                    productName: 1,
                    totalQuantity: 1,
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 }
        ];
        const topSellingProducts = await sales_model_js_1.Sale.aggregate(pipeline);
        if (!topSellingProducts || topSellingProducts.length === 0) {
            return res.status(200).json({ products: [] });
        }
        return res.status(200).json({ products: topSellingProducts });
    }
    catch (e) {
        console.error("Erreur lors de la récupération des produits tendance:", e);
        return res.status(500).send("Erreur serveur");
    }
});
router.get("/analytics/category_sales", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let matchStage = null;
        if (startDate && endDate) {
            try {
                const from = new Date(decodeURIComponent(startDate));
                const to = new Date(decodeURIComponent(endDate));
                if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                    return res.status(400).json({
                        error: "Les dates startDate et endDate doivent être valides",
                        debug: {
                            startDate,
                            endDate,
                            parsedStartDate: from.toString(),
                            parsedEndDate: to.toString(),
                        }
                    });
                }
                matchStage = {
                    $match: {
                        Date: {
                            $gte: from,
                            $lte: to
                        }
                    }
                };
            }
            catch (error) {
                console.error('Date parsing error:', error);
                return res.status(400).json({
                    error: "Les dates startDate et endDate doivent être valides",
                    details: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        const pipeline = [
            ...(matchStage ? [matchStage] : []),
            {
                $lookup: {
                    from: "products",
                    localField: "ProductID",
                    foreignField: "ProductID",
                    as: "productDetails",
                }
            },
            {
                $unwind: {
                    path: "$productDetails",
                    preserveNullAndEmptyArrays: false,
                }
            },
            {
                $group: {
                    _id: { $ifNull: ["$productDetails.Category", "Uncategorized"] },
                    totalSales: { $sum: 1 },
                    totalRevenue: { $sum: "$TotalAmount" }
                }
            },
            {
                $project: {
                    _id: 0,
                    category: "$_id",
                    totalSales: 1,
                    totalRevenue: 1
                }
            },
            {
                $sort: { totalSales: -1 }
            }
        ];
        const categorySales = await sales_model_js_1.Sale.aggregate(pipeline);
        // Calculate total sales count for the given period
        const totalSalesQuery = matchStage
            ? [matchStage, { $count: "total" }]
            : [{ $count: "total" }];
        const totalSalesResult = await sales_model_js_1.Sale.aggregate(totalSalesQuery);
        const totalSalesCount = totalSalesResult[0]?.total || 0;
        const categorySalesWithPercentage = categorySales.map(category => ({
            category: category.category,
            totalSales: category.totalSales,
            totalRevenue: category.totalRevenue,
            percentage: ((category.totalSales / totalSalesCount) * 100).toFixed(2) + '%'
        }));
        return res.status(200).json({
            totalSalesCount,
            categorySales: categorySalesWithPercentage,
            dateRange: matchStage ? {
                from: new Date(startDate),
                to: new Date(endDate)
            } : 'all-time'
        });
    }
    catch (e) {
        console.error("Error retrieving sales data:", e);
        return res.status(500).json({ message: "Server error while retrieving sales data." });
    }
});
router.get("/analytics/products_sells", async (req, res) => {
    try {
        const productName = req.query.productName;
        if (!productName) {
            return res.status(400).json({ error: "productName is required" });
        }
        const productSells = await sales_model_js_1.Sale.aggregate([
            {
                $addFields: {
                    ProductID: { $toString: "$ProductID" },
                    Quantity: { $toInt: "$Quantity" }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "ProductID",
                    foreignField: "ProductID",
                    as: "productDetails",
                },
            },
            {
                $unwind: "$productDetails",
            },
            {
                $match: {
                    "productDetails.ProductName": { $regex: new RegExp(productName, "i") },
                },
            },
            {
                $addFields: {
                    TotalAmount: { $multiply: ["$Quantity", "$productDetails.Price"] },
                }
            },
            {
                $group: {
                    _id: "$productDetails.ProductName",
                    totalSales: { $sum: "$Quantity" },
                    totalRevenue: { $sum: "$TotalAmount" },
                },
            },
            {
                $project: {
                    _id: 0,
                    ProductName: "$_id",
                    totalSales: 1,
                    totalRevenue: 1,
                },
            },
        ]);
        const totalSalesCount = await sales_model_js_1.Sale.countDocuments();
        let selesPerProduct = productSells.map(product => ({
            ProductName: product.ProductName,
            totalSales: product.totalSales,
            totalRevenue: product.totalRevenue,
        }));
        return res.status(200).json({ selesPerProduct, totalSalesCount });
    }
    catch (e) {
        console.error("Error retrieving sales data:", e);
        return res.status(500).json({ message: "Server error while retrieving sales data." });
    }
});
//# sourceMappingURL=analytics.router.js.map