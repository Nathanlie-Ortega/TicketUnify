const request = require('supertest');
const app = require('../server');
const admin = require('firebase-admin');

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      get: jest.fn(),
      doc: jest.fn(() => ({
        get: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        set: jest.fn()
      })),
      where: jest.fn(() => ({
        get: jest.fn(),
        where: jest.fn(() => ({
          get: jest.fn()
        }))
      })),
      orderBy: jest.fn(() => ({
        get: jest.fn(),
        limit: jest.fn(() => ({
          get: jest.fn()
        }))
      }))
    }))
  })),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
    createUser: jest.fn(),
    setCustomUserClaims: jest.fn()
  }))
}));

// Mock analytics service
jest.mock('../services/analyticsService', () => ({
  getTicketStats: jest.fn(),
  getCheckInStats: jest.fn(),
  getRevenueStats: jest.fn(),
  getEventStats: jest.fn()
}));

describe('Admin API', () => {
  let mockDb;
  let mockAuth;
  let adminToken;
  let userToken;

  beforeAll(() => {
    mockDb = admin.firestore();
    mockAuth = admin.auth();
    adminToken = 'admin-jwt-token';
    userToken = 'user-jwt-token';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup admin auth mock
    mockAuth.verifyIdToken.mockImplementation((token) => {
      if (token === adminToken) {
        return Promise.resolve({
          uid: 'admin-123',
          email: 'admin@ticketunify.com',
          admin: true
        });
      } else if (token === userToken) {
        return Promise.resolve({
          uid: 'user-123',
          email: 'user@example.com',
          admin: false
        });
      }
      return Promise.reject(new Error('Invalid token'));
    });
  });

  describe('GET /api/admin/tickets', () => {
    it('should retrieve all tickets for admin', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          fullName: 'John Doe',
          email: 'john@example.com',
          eventName: 'Conference A',
          status: 'active',
          checkedIn: false,
          createdAt: { seconds: 1640995200 }
        },
        {
          id: 'ticket-2',
          fullName: 'Jane Smith',
          email: 'jane@example.com',
          eventName: 'Conference B',
          status: 'active',
          checkedIn: true,
          createdAt: { seconds: 1640995200 }
        }
      ];

      mockDb.collection().orderBy().get.mockResolvedValue({
        docs: mockTickets.map(ticket => ({
          id: ticket.id,
          data: () => ticket
        }))
      });

      const response = await request(app)
        .get('/api/admin/tickets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tickets).toHaveLength(2);
      expect(response.body.tickets[0]).toMatchObject(mockTickets[0]);
    });

    it('should filter tickets by status', async () => {
      const activeTickets = [
        {
          id: 'ticket-1',
          fullName: 'John Doe',
          status: 'active',
          checkedIn: false
        }
      ];

      mockDb.collection().where().orderBy().get.mockResolvedValue({
        docs: activeTickets.map(ticket => ({
          id: ticket.id,
          data: () => ticket
        }))
      });

      const response = await request(app)
        .get('/api/admin/tickets?status=active')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tickets).toHaveLength(1);
      expect(mockDb.collection().where).toHaveBeenCalledWith('status', '==', 'active');
    });

    it('should filter tickets by event name', async () => {
      const eventTickets = [
        {
          id: 'ticket-1',
          fullName: 'John Doe',
          eventName: 'Tech Conference 2025'
        }
      ];

      mockDb.collection().where().orderBy().get.mockResolvedValue({
        docs: eventTickets.map(ticket => ({
          id: ticket.id,
          data: () => ticket
        }))
      });

      const response = await request(app)
        .get('/api/admin/tickets?eventName=Tech Conference 2025')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockDb.collection().where).toHaveBeenCalledWith('eventName', '==', 'Tech Conference 2025');
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/tickets')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('admin');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/tickets');

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/admin/tickets/:id', () => {
    it('should update ticket status as admin', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        id: 'ticket-123',
        data: () => ({
          fullName: 'John Doe',
          status: 'active'
        })
      });

      mockDb.collection().doc().update.mockResolvedValue();

      const response = await request(app)
        .patch('/api/admin/tickets/ticket-123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated');

      expect(mockDb.collection().doc().update).toHaveBeenCalledWith({
        status: 'cancelled',
        updatedAt: expect.any(Object)
      });
    });

    it('should manually check in a ticket', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        id: 'ticket-123',
        data: () => ({
          fullName: 'John Doe',
          checkedIn: false
        })
      });

      mockDb.collection().doc().update.mockResolvedValue();

      const response = await request(app)
        .patch('/api/admin/tickets/ticket-123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ checkedIn: true });

      expect(response.status).toBe(200);
      expect(mockDb.collection().doc().update).toHaveBeenCalledWith(
        expect.objectContaining({
          checkedIn: true,
          checkedInAt: expect.any(Object)
        })
      );
    });

    it('should return 404 for non-existent ticket', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false
      });

      const response = await request(app)
        .patch('/api/admin/tickets/non-existent')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .patch('/api/admin/tickets/ticket-123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'cancelled' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/admin/tickets/:id', () => {
    it('should delete ticket as admin', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        id: 'ticket-123',
        data: () => ({
          fullName: 'John Doe',
          status: 'active'
        })
      });

      mockDb.collection().doc().delete.mockResolvedValue();

      const response = await request(app)
        .delete('/api/admin/tickets/ticket-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      expect(mockDb.collection().doc().delete).toHaveBeenCalled();
    });

    it('should return 404 for non-existent ticket', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false
      });

      const response = await request(app)
        .delete('/api/admin/tickets/non-existent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .delete('/api/admin/tickets/ticket-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/analytics', () => {
    it('should return analytics data for admin', async () => {
      const analyticsService = require('../services/analyticsService');
      
      analyticsService.getTicketStats.mockResolvedValue({
        total: 150,
        active: 120,
        cancelled: 20,
        checkedIn: 80
      });

      analyticsService.getCheckInStats.mockResolvedValue({
        today: 25,
        thisWeek: 95,
        thisMonth: 120
      });

      analyticsService.getRevenueStats.mockResolvedValue({
        total: 15000,
        thisMonth: 3000,
        lastMonth: 2500
      });

      analyticsService.getEventStats.mockResolvedValue([
        { eventName: 'Tech Conference 2025', ticketCount: 75 },
        { eventName: 'Web Summit', ticketCount: 45 }
      ]);

      const response = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.analytics).toHaveProperty('ticketStats');
      expect(response.body.analytics).toHaveProperty('checkInStats');
      expect(response.body.analytics).toHaveProperty('revenueStats');
      expect(response.body.analytics).toHaveProperty('eventStats');
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/export/tickets', () => {
    it('should export tickets as CSV for admin', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          fullName: 'John Doe',
          email: 'john@example.com',
          eventName: 'Conference A',
          ticketType: 'Standard',
          status: 'active',
          checkedIn: false,
          createdAt: { seconds: 1640995200 }
        },
        {
          id: 'ticket-2',
          fullName: 'Jane Smith',
          email: 'jane@example.com',
          eventName: 'Conference B',
          ticketType: 'VIP',
          status: 'active',
          checkedIn: true,
          createdAt: { seconds: 1640995200 }
        }
      ];

      mockDb.collection().get.mockResolvedValue({
        docs: mockTickets.map(ticket => ({
          id: ticket.id,
          data: () => ticket
        }))
      });

      const response = await request(app)
        .get('/api/admin/export/tickets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('Full Name,Email,Event Name');
      expect(response.text).toContain('John Doe,john@example.com');
    });

    it('should filter exported tickets by event', async () => {
      const eventTickets = [
        {
          id: 'ticket-1',
          fullName: 'John Doe',
          email: 'john@example.com',
          eventName: 'Tech Conference 2025'
        }
      ];

      mockDb.collection().where().get.mockResolvedValue({
        docs: eventTickets.map(ticket => ({
          id: ticket.id,
          data: () => ticket
        }))
      });

      const response = await request(app)
        .get('/api/admin/export/tickets?eventName=Tech Conference 2025')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(mockDb.collection().where).toHaveBeenCalledWith('eventName', '==', 'Tech Conference 2025');
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/export/tickets')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/users', () => {
    it('should create a new admin user', async () => {
      const newAdminData = {
        email: 'newadmin@ticketunify.com',
        password: 'securePassword123',
        displayName: 'New Admin',
        role: 'admin'
      };

      mockAuth.createUser.mockResolvedValue({
        uid: 'new-admin-456'
      });

      mockAuth.setCustomUserClaims.mockResolvedValue();

      mockDb.collection().doc().set.mockResolvedValue();

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newAdminData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('created');

      expect(mockAuth.createUser).toHaveBeenCalledWith({
        email: newAdminData.email,
        password: newAdminData.password,
        displayName: newAdminData.displayName
      });

      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith('new-admin-456', {
        admin: true,
        role: 'admin'
      });
    });

    it('should create a regular user', async () => {
      const newUserData = {
        email: 'newuser@example.com',
        password: 'userPassword123',
        displayName: 'New User',
        role: 'user'
      };

      mockAuth.createUser.mockResolvedValue({
        uid: 'new-user-789'
      });

      mockAuth.setCustomUserClaims.mockResolvedValue();
      mockDb.collection().doc().set.mockResolvedValue();

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUserData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith('new-user-789', {
        admin: false,
        role: 'user'
      });
    });

    it('should return 400 for invalid user data', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123', // too short
        displayName: ''
      };

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });

    it('should handle Firebase auth errors', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
        role: 'user'
      };

      mockAuth.createUser.mockRejectedValue(new Error('Email already exists'));

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Email already exists');
    });

    it('should return 403 for non-admin users', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
        role: 'user'
      };

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send(userData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/events', () => {
    it('should retrieve all unique events for admin', async () => {
      const mockTickets = [
        {
          eventName: 'Tech Conference 2025',
          eventDate: '2025-12-31',
          location: 'Dallas, TX'
        },
        {
          eventName: 'Tech Conference 2025',
          eventDate: '2025-12-31',
          location: 'Dallas, TX'
        },
        {
          eventName: 'Web Summit',
          eventDate: '2025-06-15',
          location: 'Austin, TX'
        }
      ];

      mockDb.collection().get.mockResolvedValue({
        docs: mockTickets.map((ticket, index) => ({
          id: `ticket-${index}`,
          data: () => ticket
        }))
      });

      const response = await request(app)
        .get('/api/admin/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.events).toHaveLength(2); // Should deduplicate
      expect(response.body.events[0]).toHaveProperty('eventName');
      expect(response.body.events[0]).toHaveProperty('ticketCount');
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/events')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/bulk-checkin', () => {
    it('should bulk check-in multiple tickets', async () => {
      const ticketIds = ['ticket-1', 'ticket-2', 'ticket-3'];

      // Mock each ticket exists and is not checked in
      mockDb.collection().doc().get
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ checkedIn: false, status: 'active' })
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ checkedIn: false, status: 'active' })
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ checkedIn: true, status: 'active' }) // Already checked in
        });

      mockDb.collection().doc().update.mockResolvedValue();

      const response = await request(app)
        .post('/api/admin/bulk-checkin')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ticketIds });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveProperty('successful');
      expect(response.body.results).toHaveProperty('failed');
      expect(response.body.results.successful).toHaveLength(2);
      expect(response.body.results.failed).toHaveLength(1);
    });

    it('should return 400 for empty ticket IDs', async () => {
      const response = await request(app)
        .post('/api/admin/bulk-checkin')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ticketIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ticket IDs');
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post('/api/admin/bulk-checkin')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ticketIds: ['ticket-1'] });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/search/tickets', () => {
    it('should search tickets by name', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          fullName: 'John Doe',
          email: 'john@example.com',
          eventName: 'Tech Conference'
        }
      ];

      mockDb.collection().where().get.mockResolvedValue({
        docs: mockTickets.map(ticket => ({
          id: ticket.id,
          data: () => ticket
        }))
      });

      const response = await request(app)
        .get('/api/admin/search/tickets?q=John')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tickets).toHaveLength(1);
      expect(response.body.tickets[0].fullName).toContain('John');
    });

    it('should search tickets by email', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          fullName: 'John Doe',
          email: 'john@example.com',
          eventName: 'Tech Conference'
        }
      ];

      mockDb.collection().where().get.mockResolvedValue({
        docs: mockTickets.map(ticket => ({
          id: ticket.id,
          data: () => ticket
        }))
      });

      const response = await request(app)
        .get('/api/admin/search/tickets?q=john@example.com')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tickets).toHaveLength(1);
    });

    it('should return 400 for empty search query', async () => {
      const response = await request(app)
        .get('/api/admin/search/tickets?q=')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('search query');
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/search/tickets?q=John')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle database connection errors', async () => {
      mockDb.collection().get.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/admin/tickets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('error');
    });

    it('should handle invalid Firebase tokens', async () => {
      mockAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

      const response = await request(app)
        .get('/api/admin/tickets')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});