import Lead from '../models/Lead.js';
import Quotation from '../models/Quotation.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import mongoose from 'mongoose';

const getMonthlyLicenseExpiry = async (req, res) => {
  try {
    const { year = new Date().getFullYear(), months = 12 } = req.query;
    
    const startDate = new Date(year, 0, 1); 
    const endDate = new Date(year, 11, 31); 

    const licenseExpiryReport = await PurchaseOrder.aggregate([
      { $unwind: '$items' },

      {
        $match: {
          'items.licenseExpiryDate': {
            $gte: startDate,
            $lte: endDate
          },
          'items.licenseType': { $ne: 'perpetual' } 
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

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
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

    const leadsPipeline = [
      ...(Object.keys(dateFilter).length ? [{ $match: { createdAt: dateFilter } }] : []),
      { $group: { _id: groupByFormat, count: { $sum: 1 } } }
    ];

    const quotationsPipeline = [
      ...(Object.keys(dateFilter).length ? [{ $match: { createdAt: dateFilter } }] : []),
      { $match: { status: { $in: ['sent', 'accepted', 'viewed'] } } },
      { $group: { _id: groupByFormat, count: { $sum: 1 } } }
    ];

    const ordersPipeline = [
      ...(Object.keys(dateFilter).length ? [{ $match: { createdAt: dateFilter } }] : []),
      { $match: { status: { $in: ['acknowledged', 'in_progress', 'completed'] } } },
      { $group: { _id: groupByFormat, count: { $sum: 1 } } }
    ];

    const [leadsData, quotationsData, ordersData] = await Promise.all([
      Lead.aggregate(leadsPipeline),
      Quotation.aggregate(quotationsPipeline),
      PurchaseOrder.aggregate(ordersPipeline)
    ]);

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
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    const lastMonthStart = new Date(currentYear, currentMonth - 2, 1);
    const lastMonthEnd = new Date(currentYear, currentMonth - 1, 0, 23, 59, 59);
    const [
      currentMonthLeads,
      currentMonthQuotations,
      currentMonthOrders,
      lastMonthLeads,
      lastMonthQuotations,
      lastMonthOrders,
      totalLeads,
      totalQuotations,
      totalOrders,
      expiringThisMonth
    ] = await Promise.all([

      Lead.countDocuments({ createdAt: { $gte: monthStart, $lte: monthEnd } }),
      Quotation.countDocuments({ 
        createdAt: { $gte: monthStart, $lte: monthEnd },
        status: { $in: ['sent', 'accepted', 'viewed'] }
      }),
      PurchaseOrder.countDocuments({ 
        createdAt: { $gte: monthStart, $lte: monthEnd },
        status: { $in: ['acknowledged', 'in_progress', 'completed'] }
      }),
      
      Lead.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
      Quotation.countDocuments({ 
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
        status: { $in: ['sent', 'accepted', 'viewed'] }
      }),
      PurchaseOrder.countDocuments({ 
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
        status: { $in: ['acknowledged', 'in_progress', 'completed'] }
      }),
      
      Lead.countDocuments(),
      Quotation.countDocuments({ status: { $in: ['sent', 'accepted', 'viewed'] } }),
      PurchaseOrder.countDocuments({ status: { $in: ['acknowledged', 'in_progress', 'completed'] } }),
      
      PurchaseOrder.countDocuments({
        'items.licenseExpiryDate': {
          $gte: monthStart,
          $lte: monthEnd
        },
        'items.licenseType': { $ne: 'perpetual' }
      })
    ]);

    const calculateGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 100) / 100;
    };

    res.json({
      success: true,
      data: {
        currentMonth: {
          month: currentMonth,
          year: currentYear,
          leads: {
            count: currentMonthLeads,
            growth: calculateGrowth(currentMonthLeads, lastMonthLeads)
          },
          quotations: {
            count: currentMonthQuotations,
            growth: calculateGrowth(currentMonthQuotations, lastMonthQuotations)
          },
          orders: {
            count: currentMonthOrders,
            growth: calculateGrowth(currentMonthOrders, lastMonthOrders)
          },
          expiringLicenses: expiringThisMonth
        },
        totals: {
          leads: totalLeads,
          quotations: totalQuotations,
          orders: totalOrders
        },
        conversionRates: {
          leadToQuote: totalLeads > 0 ? Math.round((totalQuotations / totalLeads) * 100 * 100) / 100 : 0,
          quoteToOrder: totalQuotations > 0 ? Math.round((totalOrders / totalQuotations) * 100 * 100) / 100 : 0,
          overall: totalLeads > 0 ? Math.round((totalOrders / totalLeads) * 100 * 100) / 100 : 0
        }
      }
    });
  } catch (error) {
    console.error('❌ Dashboard reports error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const getAllExpireLicense = async (req, res) => {
  try {
    const today = new Date();

    const next1Month = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const next2Month = new Date(today.getFullYear(), today.getMonth() + 2, 1);
    const next3Month = new Date(today.getFullYear(), today.getMonth() + 3, 1);

    const next1MonthEnd = new Date(next1Month.getFullYear(), next1Month.getMonth() + 1, 0, 23, 59, 59);
    const next2MonthEnd = new Date(next2Month.getFullYear(), next2Month.getMonth() + 1, 0, 23, 59, 59);
    const next3MonthEnd = new Date(next3Month.getFullYear(), next3Month.getMonth() + 1, 0, 23, 59, 59);

    const licenseData = await PurchaseOrder.aggregate([
      { $unwind: "$items" },

      {
        $match: {
          "items.licenseType": { $ne: "perpetual" },
          "items.licenseExpiryDate": { $gte: today }
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
          productId: "$items.productId",
          description: "$items.description",
          customerName: "$leadInfo.customerName",
          expiryDate: "$items.licenseExpiryDate",
          totalPrice: "$items.totalPrice"
        }
      }
    ]);

    const expiringIn1 = [];
    const expiringIn2 = [];
    const expiringIn3 = [];

    licenseData.forEach(item => {
      const exp = new Date(item.expiryDate);

      if (exp >= next1Month && exp <= next1MonthEnd) {
        expiringIn1.push(item);
      } else if (exp >= next2Month && exp <= next2MonthEnd) {
        expiringIn2.push(item);
      } else if (exp >= next3Month && exp <= next3MonthEnd) {
        expiringIn3.push(item);
      }
    });

    res.json({
      success: true,
      data: {
        currentDate: today,
        expiringIn: {
          "1_month": {
            month: next1Month.getMonth() + 1,
            year: next1Month.getFullYear(),
            count: expiringIn1.length,
            licenses: expiringIn1
          },
          "2_months": {
            month: next2Month.getMonth() + 1,
            year: next2Month.getFullYear(),
            count: expiringIn2.length,
            licenses: expiringIn2
          },
          "3_months": {
            month: next3Month.getMonth() + 1,
            year: next3Month.getFullYear(),
            count: expiringIn3.length,
            licenses: expiringIn3
          }
        }
      }
    });

  } catch (error) {
    console.error("❌ Expiring license report error:", error);
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