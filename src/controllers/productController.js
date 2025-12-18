import Product from "../models/Product.js";
import { getSuperAdminId } from "../utils/superAdmin.js";

const buildFilter = ({ search, category, oem, minPrice, maxPrice }) => {
  const filter = {};

  if (category) {
    filter.category = category;
  }

  if (oem) {
    filter.oem = oem;
  }

  if (minPrice || maxPrice) {
    filter.sellingPrice = {};
    if (minPrice) {
      filter.sellingPrice.$gte = Number(minPrice);
    }
    if (maxPrice) {
      filter.sellingPrice.$lte = Number(maxPrice);
    }
  }

  if (search) {
    const regex = { $regex: search, $options: "i" };
    filter.$or = [
      { productName: regex },
      { productCode: regex },
      { productId: regex },
      { category: regex },
      { oem: regex },
      { description: regex },
    ];
  }

  return filter;
};

const createProduct = async (req, res) => {
  try {
    const {
      productId,
      productName,
      productCode,
      category,
      oem,
      description,
      oemPrice,
      sellingPrice,
    } = req.body;

    if (!productId || !productName || !productCode) {
      return res.status(400).json({
        success: false,
        error: "Product ID, name, and code are required",
      });
    }

    const [idTaken, codeTaken] = await Promise.all([
      Product.findOne({ productId, superAdminId: getSuperAdminId(req) }),
      Product.findOne({ productCode, superAdminId: getSuperAdminId(req) }),
    ]);

    if (idTaken || codeTaken) {
      return res.status(400).json({
        success: false,
        error: "Product already exists",
      });
    }

    // if (codeTaken) {
    //   return res.status(400).json({
    //     success: false,
    //     error: "Product already exists",
    //   });
    // }

    const product = await Product.create({
      productId,
      productName,
      productCode,
      category,
      oem,
      description,
      oemPrice,
      sellingPrice,
      superAdminId: getSuperAdminId(req),
      createdBy: req.admin.id,
      updatedBy: req.admin.id,
    });

    await product.populate([
      { path: "createdBy", select: "name email" },
      { path: "updatedBy", select: "name email" },
    ]);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(", "),
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
      category,
      oem,
      minPrice,
      maxPrice,
    } = req.query;

    const filter = buildFilter({
      search,
      category,
      oem,
      minPrice,
      maxPrice,
    });

    filter.superAdminId = getSuperAdminId(req);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate([{ path: "createdBy", select: "name email" }]),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    res.json({
      success: true,
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      superAdminId: getSuperAdminId(req),
    }).populate([
      { path: "createdBy", select: "name email" },
      { path: "updatedBy", select: "name email" },
    ]);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const {
      productId,
      productName,
      productCode,
      category,
      oem,
      description,
      oemPrice,
      sellingPrice,
    } = req.body;

    const product = await Product.findOne({
      _id: req.params.id,
      superAdminId: getSuperAdminId(req),
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    if (productCode && productCode !== product.productCode) {
      const isTaken = await Product.findOne({
        productCode,
        superAdminId: getSuperAdminId(req),
        _id: { $ne: req.params.id },
      });
      if (isTaken) {
        return res.status(400).json({
          success: false,
          error: "Product code already exists",
        });
      }
      product.productCode = productCode;
    }

    if (productId && productId !== product.productId) {
      const idTaken = await Product.findOne({
        productId,
        superAdminId: getSuperAdminId(req),
        _id: { $ne: req.params.id },
      });
      if (idTaken) {
        return res.status(400).json({
          success: false,
          error: "Product ID already exists",
        });
      }
      product.productId = productId;
    }

    const updateFields = {
      productName,
      category,
      oem,
      description,
      oemPrice,
      sellingPrice,
    };

    Object.keys(updateFields).forEach((key) => {
      if (updateFields[key] !== undefined) {
        product[key] = updateFields[key];
      }
    });

    product.updatedBy = req.admin.id;
    await product.save();
    await product.populate([
      { path: "createdBy", select: "name email" },
      { path: "updatedBy", select: "name email" },
    ]);

    res.json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(", "),
      });
    }
    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      superAdminId: getSuperAdminId(req),
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    await Product.deleteOne({
      _id: req.params.id,
      superAdminId: getSuperAdminId(req),
    });

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
