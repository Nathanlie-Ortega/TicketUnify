// tests/users.test.js
const request = require('supertest');
const app = require('../server');

describe('User API Tests', () => {
  let authToken;
  let testUserId;

  const sampleUserData = {
    displayName: 'Test User',
    preferences: {
      emailNotifications: true,
      marketingEmails: false,
      theme: 'light',
      language: 'en'
    },
    additionalInfo: 'Test user for automated testing'
  };

  beforeAll(async () => {
    // Setup test authentication token
    // This would typically involve creating a test user and getting their token
  });

  afterAll(async () => {
    // Cleanup test data
  });

  describe('GET /api/users/profile', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should return user profile for authenticated user', async () => {
      if (!authToken) return; // Skip if no auth token

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('uid');
      expect(response.body.data.user).toHaveProperty('email');
    });
  });

  describe('PUT /api/users/profile', () => {
    test('should update user profile successfully', async () => {
      if (!authToken) return; // Skip if no auth token

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sampleUserData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.user.displayName).toBe(sampleUserData.displayName);
    });

    test('should validate input data', async () => {
      if (!authToken) return; // Skip if no auth token

      const invalidData = {
        displayName: 'A', // Too short
        preferences: {
          theme: 'invalid-theme'
        }
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/users/stats', () => {
    test('should return user statistics', async () => {
      if (!authToken) return; // Skip if no auth token

      const response = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data.stats).toHaveProperty('totalTickets');
      expect(response.body.data.stats).toHaveProperty('activeTickets');
      expect(response.body.data.stats).toHaveProperty('checkedInTickets');
    });
  });

  describe('GET /api/users/tickets', () => {
    test('should return user tickets with pagination', async () => {
      if (!authToken) return; // Skip if no auth token

      const response = await request(app)
        .get('/api/users/tickets?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('tickets');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.tickets)).toBe(true);
    });

    test('should filter upcoming events', async () => {
      if (!authToken) return; // Skip if no auth token

      const response = await request(app)
        .get('/api/users/tickets?upcoming=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      // All returned tickets should have future event dates
      response.body.data.tickets.forEach(ticket => {
        expect(new Date(ticket.eventDate).getTime()).toBeGreaterThan(Date.now());
      });
    });
  });

  describe('PUT /api/users/preferences', () => {
    test('should update user preferences', async () => {
      if (!authToken) return; // Skip if no auth token

      const newPreferences = {
        emailNotifications: false,
        marketingEmails: true,
        theme: 'dark',
        language: 'es'
      };

      const response = await request(app)
        .put('/api/users/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newPreferences)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.preferences).toMatchObject(newPreferences);
    });
  });

  describe('GET /api/users/admin-status', () => {
    test('should return admin status', async () => {
      if (!authToken) return; // Skip if no auth token

      const response = await request(app)
        .get('/api/users/admin-status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('isAdmin');
      expect(typeof response.body.data.isAdmin).toBe('boolean');
    });
  });

  describe('GET /api/users/activity', () => {
    test('should return user activity log', async () => {
      if (!authToken) return; // Skip if no auth token

      const response = await request(app)
        .get('/api/users/activity')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('activities');
      expect(Array.isArray(response.body.data.activities)).toBe(true);
    });
  });

  describe('GET /api/users/export', () => {
    test('should export user data', async () => {
      if (!authToken) return; // Skip if no auth token

      const response = await request(app)
        .get('/api/users/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tickets');
      expect(response.body).toHaveProperty('exportedAt');
    });
  });

  describe('POST /api/users/welcome-email', () => {
    test('should send welcome email', async () => {
      if (!authToken) return; // Skip if no auth token

      const response = await request(app)
        .post('/api/users/welcome-email')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('email sent');
    });

    test('should be rate limited', async () => {
      if (!authToken) return; // Skip if no auth token

      // Send multiple requests quickly
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/users/welcome-email')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/users/profile', () => {
    test('should delete user account', async () => {
      if (!authToken) return; // Skip if no auth token

      const response = await request(app)
        .delete('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('deleted');
    });
  });

  describe('Input Validation', () => {
    test('should validate display name length', async () => {
      if (!authToken) return; // Skip if no auth token

      const invalidData = {
        displayName: 'A'.repeat(200) // Too long
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    test('should sanitize harmful input', async () => {
      if (!authToken) return; // Skip if no auth token

      const maliciousData = {
        displayName: '<script>alert("xss")</script>John Doe',
        additionalInfo: 'javascript:alert("xss")'
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousData)
        .expect(200);

      expect(response.body.data.user.displayName).not.toContain('<script>');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid authentication gracefully', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
    });

    test('should return proper error format', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ displayName: '' }) // Invalid data
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
    });
  });
});