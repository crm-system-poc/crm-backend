import Lead from '../models/Lead.js';
import Quotation from '../models/Quotation.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import mongoose from 'mongoose';
import { getSuperAdminId } from '../utils/superAdmin.js';

const getMonthlyLicenseExpiry = async (req, res) => {
  try {
    const { year = new Date().getFullYear(), months = 12 } = req.query;
    const AdminId = getSuperAdminId(req);
    const startDate = new Date(year, 0, 1); 
    const endDate = new Date(year, 11, 31); 

    const licenseExpiryReport = await PurchaseOrder.aggregate([
      { $unwind: '$items' },
      {
        $match: {
          "items.licenseExpiryDate": {
            $gte: startDate,
            $lte: endDate
          },
          "items.licenseType": { $ne: "perpetual" },
          superAdminId: new mongoose.Types.ObjectId(AdminId),
        }
      },
      {
        $group: {
          _id: {
            month: { $month: '$items.licenseExpiryDate' },
            year: { $year: '$items.licenseExpiryDate' },
            licenseType: '$items.licenseType'
          },
          count: { $sum: 1 },
          products: { 
            $addToSet: {
              productId: '$items.productId',
              description: '$items.description',
              customerName: '$customerDetails.customerName',
              expiryDate: '$items.licenseExpiryDate'
            }
          },
          totalValue: { $sum: '$items.totalPrice' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const monthlyReport = {};
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];

    licenseExpiryReport.forEach(item => {
      const monthKey = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      
      if (!monthlyReport[monthKey]) {
        monthlyReport[monthKey] = {
          month: item._id.month,
          year: item._id.year,
          monthName: monthNames[item._id.month - 1],
          totalExpiring: 0,
          totalValue: 0,
          byLicenseType: {},
          products: []
        };
      }
      
      monthlyReport[monthKey].totalExpiring += item.count;
      monthlyReport[monthKey].totalValue += item.totalValue;
      monthlyReport[monthKey].byLicenseType[item._id.licenseType] = {
        count: item.count,
        value: item.totalValue
      };
      monthlyReport[monthKey].products.push(...item.products);
    });

    const reportArray = Object.values(monthlyReport).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    res.json({
      success: true,
      data: {
        year: parseInt(year),
        summary: {
          totalExpiringLicenses: reportArray.reduce((sum, month) => sum + month.totalExpiring, 0),
          totalValue: reportArray.reduce((sum, month) => sum + month.totalValue, 0),
          monthsCovered: reportArray.length
        },
        monthlyBreakdown: reportArray
      }
    });
  } catch (error) {
    console.error('❌ License expiry report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const getSalesFunnelReport = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate,
      groupBy = 'month' 
    } = req.query;

    const AdminId = getSuperAdminId(req);

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    const isSuperAdmin = req.admin.systemrole === "SuperAdmin";
    let groupByFormat;
    let dateField;
    
    switch (groupBy) {
      case 'quarter':
        groupByFormat = {
          year: { $year: '$createdAt' },
          quarter: { $ceil: { $divide: [{ $month: '$createdAt' }, 3] } }
        };
        dateField = { $concat: ['Q', { $toString: '$quarter' }, ' ', { $toString: '$year' }] };
        break;
      case 'year':
        groupByFormat = { year: { $year: '$createdAt' } };
        dateField = '$year';
        break;
      default: 
        groupByFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        dateField = {
          $concat: [
            { $arrayElemAt: [['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], { $subtract: ['$month', 1] }] },
            ' ',
            { $toString: '$year' }
          ]
        };
    }

    // Filter all data using superAdminId for full correctness!
    const leadsPipeline = [
      { $match: { superAdminId: new mongoose.Types.ObjectId(AdminId) } },
      ...(Object.keys(dateFilter).length ? [{ $match: { createdAt: dateFilter } }] : []),
      { $group: { _id: groupByFormat, count: { $sum: 1 } } },
    ];

    const quotationsPipeline = [
      { $match: { superAdminId: new mongoose.Types.ObjectId(AdminId) } },
      ...(Object.keys(dateFilter).length ? [{ $match: { createdAt: dateFilter } }] : []),
      { $match: { status: { $in: ['sent', 'accepted', 'viewed'] } } },
      { $group: { _id: groupByFormat, count: { $sum: 1 } } },
    ];

    // --- FIX: ordersPipeline must also filter by superAdminId ---
    const ordersPipeline = [
      { $match: { superAdminId: new mongoose.Types.ObjectId(AdminId) } },
      ...(Object.keys(dateFilter).length ? [{ $match: { createdAt: dateFilter } }] : []),
      { $match: { status: { $in: ['acknowledged', 'in_progress', 'completed'] } } },
      { $group: { _id: groupByFormat, count: { $sum: 1 } } },
    ];

    // Fetch the data
    const [leadsData, quotationsData, ordersData] = await Promise.all([
      Lead.aggregate(leadsPipeline),
      Quotation.aggregate(quotationsPipeline),
      PurchaseOrder.aggregate(ordersPipeline)
    ]);

    // Set of all period keys for merging
    const allPeriods = new Set();
    [...leadsData, ...quotationsData, ...ordersData].forEach(item => {
      const periodKey = JSON.stringify(item._id);
      allPeriods.add(periodKey);
    });

    const salesFunnelReport = Array.from(allPeriods).map(periodKey => {
      const period = JSON.parse(periodKey);
      const leads = leadsData.find(item => JSON.stringify(item._id) === periodKey) || { count: 0 };
      const quotations = quotationsData.find(item => JSON.stringify(item._id) === periodKey) || { count: 0 };
      const orders = ordersData.find(item => JSON.stringify(item._id) === periodKey) || { count: 0 };

      const leadToQuoteRate = leads.count > 0 ? (quotations.count / leads.count) * 100 : 0;
      const quoteToOrderRate = quotations.count > 0 ? (orders.count / quotations.count) * 100 : 0;
      const overallConversionRate = leads.count > 0 ? (orders.count / leads.count) * 100 : 0;

      return {
        period: period,
        displayPeriod: groupBy === 'month' 
          ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][period.month - 1]} ${period.year}`
          : groupBy === 'quarter'
          ? `Q${period.quarter} ${period.year}`
          : `${period.year}`,
        leads: leads.count,
        quotations: quotations.count,
        orders: orders.count,
        conversionRates: {
          leadToQuote: Math.round(leadToQuoteRate * 100) / 100,
          quoteToOrder: Math.round(quoteToOrderRate * 100) / 100,
          overall: Math.round(overallConversionRate * 100) / 100
        }
      };
    });

    salesFunnelReport.sort((a, b) => {
      if (a.period.year !== b.period.year) return a.period.year - b.period.year;
      if (groupBy === 'month' && a.period.month !== b.period.month) return a.period.month - b.period.month;
      if (groupBy === 'quarter' && a.period.quarter !== b.period.quarter) return a.period.quarter - b.period.quarter;
      return 0;
    });

    const totals = salesFunnelReport.reduce((acc, period) => ({
      leads: acc.leads + period.leads,
      quotations: acc.quotations + period.quotations,
      orders: acc.orders + period.orders
    }), { leads: 0, quotations: 0, orders: 0 });

    const overallConversionRates = {
      leadToQuote: totals.leads > 0 ? Math.round((totals.quotations / totals.leads) * 100 * 100) / 100 : 0,
      quoteToOrder: totals.quotations > 0 ? Math.round((totals.orders / totals.quotations) * 100 * 100) / 100 : 0,
      overall: totals.leads > 0 ? Math.round((totals.orders / totals.leads) * 100 * 100) / 100 : 0
    };

    res.json({
      success: true,
      data: {
        groupBy,
        dateRange: {
          startDate: startDate || 'Beginning',
          endDate: endDate || 'Current'
        },
        summary: {
          totals,
          conversionRates: overallConversionRates
        },
        periodBreakdown: salesFunnelReport
      }
    });
  } catch (error) {
    console.error('❌ Sales funnel report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const getDashboardReports = async (req, res) => {
  try {
    const AdminId = getSuperAdminId(req);
    const now = new Date();

    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    const lastMonthStart = new Date(year, month - 2, 1);
    const lastMonthEnd = new Date(year, month - 1, 0, 23, 59, 59);

    const [
      currentLeads,
      lastLeads,
      totalLeads,

      currentQuotes,
      lastQuotes,
      totalQuotes,

      currentOrders,
      lastOrders,
      totalOrders,
    ] = await Promise.all([
      Lead.countDocuments({
        createdAt: { $gte: monthStart, $lte: monthEnd },
        superAdminId: AdminId,
      }),
      Lead.countDocuments({
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
        superAdminId: AdminId,
      }),
      Lead.countDocuments({ superAdminId: AdminId }),

      Quotation.countDocuments({
        createdAt: { $gte: monthStart, $lte: monthEnd },
        status: { $in: ["sent", "accepted", "viewed"] },
        superAdminId: AdminId,
      }),
      Quotation.countDocuments({
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
        status: { $in: ["sent", "accepted", "viewed"] },
        superAdminId: AdminId,
      }),
      Quotation.countDocuments({
        status: { $in: ["sent", "accepted", "viewed"] },
        superAdminId: AdminId,
      }),

      // ✅ ONLY BASE POs COUNTED
      PurchaseOrder.countDocuments({
        createdAt: { $gte: monthStart, $lte: monthEnd },
        superAdminId: AdminId,
        poType: "base",
      }),
      PurchaseOrder.countDocuments({
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
        superAdminId: AdminId,
        poType: "base",
      }),
      PurchaseOrder.countDocuments({
        superAdminId: AdminId,
        poType: "base",
      }),
    ]);

    const growth = (c, p) =>
      p === 0 ? (c > 0 ? 100 : 0) : +(((c - p) / p) * 100).toFixed(2);

    res.json({
      success: true,
      data: {
        currentMonth: {
          month,
          year,
          leads: {
            count: currentLeads,
            growth: growth(currentLeads, lastLeads),
          },
          quotations: {
            count: currentQuotes,
            growth: growth(currentQuotes, lastQuotes),
          },
          orders: {
            count: currentOrders,
            growth: growth(currentOrders, lastOrders),
          },
        },
        totals: {
          leads: totalLeads,
          quotations: totalQuotes,
          orders: totalOrders,
        },
        conversionRates: {
          leadToQuote: totalLeads
            ? +((totalQuotes / totalLeads) * 100).toFixed(2)
            : 0,
          quoteToOrder: totalQuotes
            ? +((totalOrders / totalQuotes) * 100).toFixed(2)
            : 0,
          overall: totalLeads
            ? +((totalOrders / totalLeads) * 100).toFixed(2)
            : 0,
        },
      },
    });
  } catch (error) {
    console.error("❌ Dashboard error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getAllExpireLicense = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { filter = "monthly" } = req.query; 
    const isSuperAdmin = req.admin.systemrole === "SuperAdmin";
    const AdminId = getSuperAdminId(req);
    
    const past3MonthsStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    const next3MonthsEnd = new Date(today.getFullYear(), today.getMonth() + 4, 0, 23, 59, 59);

    // Filter by superAdminId for license expiry data
    const licenses = await PurchaseOrder.aggregate([
      { $unwind: "$items" },
      {
        $match: {
          "items.licenseType": { $ne: "perpetual" },
          "items.licenseExpiryDate": {
            $gte: past3MonthsStart,
            $lte: next3MonthsEnd
          },
          superAdminId: new mongoose.Types.ObjectId(AdminId)
        }
      },
      {
        $lookup: {
          from: "leads",
          localField: "leadId",
          foreignField: "_id",
          as: "leadInfo"
        }
      },
      { $unwind: "$leadInfo" },
      {
        $project: {
          _id: 0,
          purchaseOrderId: "$_id",
          productId: "$items.productId",
          ponumber: "$poNumber",
          description: "$items.description",
          licenseType: "$items.licenseType",
          expiryDate: "$items.licenseExpiryDate",
          totalPrice: "$items.totalPrice",
          customerName: "$leadInfo.customerName",
          customerId: "$leadInfo._id"
        }
      }
    ]);

    // Split into expired vs expiring soon
    const expired = [];
    const expiringSoon = [];
    licenses.forEach(item => {
      const exp = new Date(item.expiryDate);
      exp.setHours(0, 0, 0, 0); // use date only
      if (exp <= today) {
        expired.push(item);
      } else {
        expiringSoon.push(item);
      }
    });

    // Grouping functions
    const groupMonthly = (items) => {
      return items.reduce((acc, item) => {
        const d = new Date(item.expiryDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!acc[key]) acc[key] = {
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          label: d.toLocaleString("default", { month: "long", year: "numeric" }),
          count: 0,
          items: []
        };
        acc[key].count++;
        acc[key].items.push(item);
        return acc;
      }, {});
    };

    const groupQuarterly = (items) => {
      return items.reduce((acc, item) => {
        const d = new Date(item.expiryDate);
        const q = Math.ceil((d.getMonth() + 1) / 3);
        const key = `${d.getFullYear()}-Q${q}`;
        if (!acc[key]) acc[key] = {
          quarter: q,
          year: d.getFullYear(),
          label: `Q${q} ${d.getFullYear()}`,
          count: 0,
          items: []
        };
        acc[key].count++;
        acc[key].items.push(item);
        return acc;
      }, {});
    };

    const groupYearly = (items) => {
      return items.reduce((acc, item) => {
        const d = new Date(item.expiryDate);
        const key = `${d.getFullYear()}`;
        if (!acc[key]) acc[key] = {
          year: d.getFullYear(),
          label: `${d.getFullYear()}`,
          count: 0,
          items: []
        };
        acc[key].count++;
        acc[key].items.push(item);
        return acc;
      }, {});
    };

    // Apply filter (monthly/quarterly/yearly)
    const grouping = 
      filter === "yearly" ? groupYearly :
      filter === "quarterly" ? groupQuarterly :
      groupMonthly;

    const finalExpired = grouping(expired);
    const finalExpiringSoon = grouping(expiringSoon);

    res.json({
      success: true,
      data: {
        filterType: filter,
        dateRange: {
          fromPast3Months: past3MonthsStart,
          toNext3Months: next3MonthsEnd
        },
        summary: {
          totalExpired: expired.length,
          totalExpiringSoon: expiringSoon.length,
          totalLicenses: expired.length + expiringSoon.length
        },
        expired: finalExpired,
        expiringSoon: finalExpiringSoon
      }
    });

  } catch (error) {
    console.error("❌ getAllExpiredLicense Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export {
  getMonthlyLicenseExpiry,
  getSalesFunnelReport,
  getDashboardReports,
  getAllExpireLicense
};