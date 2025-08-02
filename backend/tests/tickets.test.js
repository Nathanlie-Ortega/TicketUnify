const request = require('supertest');
const app = require('../server');
const admin = require('firebase-admin');

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      add: jest.fn(),
      doc: jest.fn(() => ({
        get: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      })),
      where: jest.fn(() => ({
        get: jest.fn()
      })),
      orderBy: jest.fn(() => ({
        get: jest.fn()
      }))
    }))
  })),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn()
  }))
}));

// Mock email service
jest.mock('../services/emailService', () => ({
  sendTicketEmail: jest.fn().mockResolvedValue(true)
}));

// Mock PDF service
jest.mock('../services/pdfService', () => ({
  generateTicketPDF: jest.fn().mockResolvedValue(Buffer.from('fake-pdf'))
}));

// Mock QR service
jest.mock('../services/qrService', () => ({
  generateQRCode: jest.fn().mockResolvedValue('data:image/png;base64,fake-qr')
}));

describe('Tickets API', () => {
  let mockDb;
  let mockAuth;
  let validAuthToken;

  beforeAll(() => {
    // Setup mocks
    mockDb = admin.firestore();
    mockAuth = admin.auth();
    validAuthToken = 'valid-jwt-token';
    
    // Mock auth verification
    mockAuth.verifyIdToken.mockResolvedValue({
      uid: 'test-user-123',
      email: 'test@example.com'
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/tickets', () => {
    const validTicketData = {
      fullName: 'John Doe',
      email: 'john@example.com',
      eventName: 'Tech Conference 2025',
      eventDate: '2025-12-31',
      ticketType: 'Standard',
      location: 'Dallas, TX'
    };

    it('should create a new ticket successfully', async () => {
      // Mock Firestore add
      const mockTicketRef = { id: 'ticket-123' };
      mockDb.collection().add.mockResolvedValue(mockTicketRef);

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(validTicketData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        ticketId: 'ticket-123',
        message: 'Ticket created successfully'
      });

      expect(mockDb.collection).toHaveBeenCalledWith('tickets');
      expect(mockDb.collection().add).toHaveBeenCalledWith(
        expect.objectContaining({
          ...validTicketData,
          ticketId: expect.any(String),
          qrCode: expect.any(String),
          status: 'active',
          checkedIn: false,
          createdAt: expect.any(Object),
          userId: 'test-user-123'
        })
      );
    });

    it('should return 400 for invalid ticket data', async () => {
      const invalidData = {
        fullName: '',
        email: 'invalid-email',
        eventName: '',
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/tickets')
        .send(validTicketData);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('unauthorized');
    });

    it('should handle database errors gracefully', async () => {
      mockDb.collection().add.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(validTicketData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('error');
    });
  });

  describe('GET /api/tickets/:id', () => {
    it('should retrieve a ticket by ID', async () => {
      const mockTicketData = {
        id: 'ticket-123',
        fullName: 'John Doe',
        email: 'john@example.com',
        eventName: 'Tech Conference 2025',
        status: 'active',
        checkedIn: false
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        id: 'ticket-123',
        data: () => mockTicketData
      });

      const response = await request(app)
        .get('/api/tickets/ticket-123')
        .set('Authorization', `Bearer ${validAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.ticket).toMatchObject(mockTicketData);
    });

    it('should return 404 for non-existent ticket', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false
      });

      const response = await request(app)
        .get('/api/tickets/non-existent')
        .set('Authorization', `Bearer ${validAuthToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/tickets/ticket-123');

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/tickets/:id/checkin', () => {
    it('should check in a ticket successfully', async () => {
      // Mock ticket exists and is not already checked in
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        id: 'ticket-123',
        data: () => ({
          fullName: 'John Doe',
          checkedIn: false,
          status: 'active'
        })
      });

      mockDb.collection().doc().update.mockResolvedValue();

      const response = await request(app)
        .patch('/api/tickets/ticket-123/checkin')
        .set('Authorization', `Bearer ${validAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('checked in');

      expect(mockDb.collection().doc().update).toHaveBeenCalledWith({
        checkedIn: true,
        checkedInAt: expect.any(Object)
      });
    });

    it('should return 400 if ticket is already checked in', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        id: 'ticket-123',
        data: () => ({
          fullName: 'John Doe',
          checkedIn: true,
          status: 'active'
        })
      });

      const response = await request(app)
        .patch('/api/tickets/ticket-123/checkin')
        .set('Authorization', `Bearer ${validAuthToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already checked in');
    });

    it('should return 404 for non-existent ticket', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false
      });

      const response = await request(app)
        .patch('/api/tickets/non-existent/checkin')
        .set('Authorization', `Bearer ${validAuthToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/tickets/user/:userId', () => {
    it('should retrieve all tickets for a user', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          fullName: 'John Doe',
          eventName: 'Conference A',
          status: 'active'
        },
        {
          id: 'ticket-2',
          fullName: 'John Doe',
          eventName: 'Conference B',
          status: 'active'
        }
      ];

      mockDb.collection().where().get.mockResolvedValue({
        docs: mockTickets.map(ticket => ({
          id: ticket.id,
          data: () => ticket
        }))
      });

      const response = await request(app)
        .get('/api/tickets/user/test-user-123')
        .set('Authorization', `Bearer ${validAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tickets).toHaveLength(2);
      expect(response.body.tickets[0]).toMatchObject(mockTickets[0]);
    });

    it('should return empty array for user with no tickets', async () => {
      mockDb.collection().where().get.mockResolvedValue({
        docs: []
      });

      const response = await request(app)
        .get('/api/tickets/user/test-user-123')
        .set('Authorization', `Bearer ${validAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tickets).toHaveLength(0);
    });
  });

  describe('DELETE /api/tickets/:id', () => {
    it('should delete a ticket successfully', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        id: 'ticket-123',
        data: () => ({
          fullName: 'John Doe',
          userId: 'test-user-123'
        })
      });

      mockDb.collection().doc().delete.mockResolvedValue();

      const response = await request(app)
        .delete('/api/tickets/ticket-123')
        .set('Authorization', `Bearer ${validAuthToken}`);

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
        .delete('/api/tickets/non-existent')
        .set('Authorization', `Bearer ${validAuthToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 if user tries to delete another user\'s ticket', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        id: 'ticket-123',
        data: () => ({
          fullName: 'John Doe',
          userId: 'different-user-456'
        })
      });

      const response = await request(app)
        .delete('/api/tickets/ticket-123')
        .set('Authorization', `Bearer ${validAuthToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('permission');
    });
  });

  describe('POST /api/tickets/:id/resend', () => {
    it('should resend ticket email successfully', async () => {
      const mockTicketData = {
        fullName: 'John Doe',
        email: 'john@example.com',
        eventName: 'Tech Conference 2025',
        userId: 'test-user-123'
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        id: 'ticket-123',
        data: () => mockTicketData
      });

      const emailService = require('../services/emailService');
      emailService.sendTicketEmail.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/tickets/ticket-123/resend')
        .set('Authorization', `Bearer ${validAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('resent');

      expect(emailService.sendTicketEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockTicketData,
          id: 'ticket-123'
        })
      );
    });

    it('should handle email service failures', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        id: 'ticket-123',
        data: () => ({
          fullName: 'John Doe',
          email: 'john@example.com',
          userId: 'test-user-123'
        })
      });

      const emailService = require('../services/emailService');
      emailService.sendTicketEmail.mockRejectedValue(new Error('Email failed'));

      const response = await request(app)
        .post('/api/tickets/ticket-123/resend')
        .set('Authorization', `Bearer ${validAuthToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('email');
    });
  });
});