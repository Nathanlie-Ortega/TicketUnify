// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTickets } from '../contexts/TicketContext';
import { TicketSalesChart, TicketTypesChart, CheckInRateChart } from '../components/AnalyticsChart';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Download, Users, Ticket, CheckCircle, DollarSign } from 'lucide-react';
import { formatDate, formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { userProfile } = useAuth();
  const { getAllTickets } = useTickets();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalTickets: 0,
    checkedIn: 0,
    revenue: 0,
    conversionRate: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const allTickets = await getAllTickets();
      setTickets(allTickets);
      calculateAnalytics(allTickets);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (ticketData) => {
    const total = ticketData.length;
    const checkedIn = ticketData.filter(t => t.checkedIn).length;
    const revenue = ticketData.reduce((sum, ticket) => {
      const prices = { Standard: 0, Premium: 49, VIP: 99 };
      return sum + (prices[ticket.ticketType] || 0);
    }, 0);

    setAnalytics({
      totalTickets: total,
      checkedIn,
      revenue,
      conversionRate: total > 0 ? (checkedIn / total * 100).toFixed(1) : 0
    });
  };

  const exportTickets = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "ID,Name,Email,Event,Date,Type,Status,Created\n"
      + tickets.map(ticket => 
        `${ticket.id},${ticket.userName},${ticket.userEmail},${ticket.eventName},${ticket.eventDate},${ticket.ticketType},${ticket.checkedIn ? 'Checked In' : 'Active'},${formatDate(ticket.createdAt)}`
      ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tickets-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Tickets exported successfully!');
  };

  // Mock chart data
  const salesData = [
    { name: 'Jan', value: 12 },
    { name: 'Feb', value: 19 },
    { name: 'Mar', value: 25 },
    { name: 'Apr', value: 32 },
    { name: 'May', value: 28 },
    { name: 'Jun', value: 35 },
  ];

  const ticketTypesData = [
    { name: 'Standard', value: tickets.filter(t => t.ticketType === 'Standard').length },
    { name: 'Premium', value: tickets.filter(t => t.ticketType === 'Premium').length },
    { name: 'VIP', value: tickets.filter(t => t.ticketType === 'VIP').length },
  ];

  if (userProfile?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-300">You don't have permission to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage events and view analytics</p>
        </div>
        <Button onClick={exportTickets} variant="outline" className="w-full sm:w-auto">
          <Download size={16} className="mr-2" />
          Export Data
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 border border-blue-600 dark:border-gray-700 p-6 rounded-xl shadow-lg transition-colors">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Ticket className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tickets</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.totalTickets}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-blue-600 dark:border-gray-700 p-6 rounded-xl shadow-lg transition-colors">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Checked In</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.checkedIn}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-blue-600 dark:border-gray-700 p-6 rounded-xl shadow-lg transition-colors">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(analytics.revenue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-blue-600 dark:border-gray-700 p-6 rounded-xl shadow-lg transition-colors">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <Users className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Check-in Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.conversionRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 border border-blue-600 dark:border-gray-700 rounded-xl shadow-lg p-6 transition-colors">
          <TicketSalesChart data={salesData} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-blue-600 dark:border-gray-700 rounded-xl shadow-lg p-6 transition-colors">
          <TicketTypesChart data={ticketTypesData} />
        </div>
      </div>

      {/* Recent Tickets Table */}
      <div className="bg-white dark:bg-gray-800 border border-blue-600 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Tickets</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Attendee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {tickets.slice(0, 10).map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {ticket.userName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {ticket.userEmail}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {ticket.eventName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {ticket.ticketType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      ticket.checkedIn 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                    }`}>
                      {ticket.checkedIn ? 'Checked In' : 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(ticket.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}