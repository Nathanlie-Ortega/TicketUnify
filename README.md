# TicketUnify

A professional full-stack web application for generating, managing, and validating event tickets with QR codes, email delivery, and real-time analytics.

## Features

- **Ticket Generation**: Create professional conference tickets with custom branding
- **QR Code Integration**: Secure ticket validation with QR codes
- **Email Delivery**: Automated PDF ticket delivery via email
- **Real-time Validation**: Instant QR code scanning and check-in system
- **Admin Dashboard**: Complete event management with analytics
- **Payment Integration**: Stripe integration for paid tickets
- **Export Functionality**: CSV exports for attendee data
- **Responsive Design**: Mobile-first, accessible interface

## Tech Stack

### Frontend
- **React 18** - Modern UI library
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **React Hook Form** - Form handling with validation
- **Firebase SDK** - Authentication and Firestore

### Backend
- **Node.js & Express** - Server framework
- **Firebase Admin** - Server-side Firebase integration
- **Stripe** - Payment processing

### Database & Storage
- **Firebase Firestore** - NoSQL database
- **Firebase Storage** - File storage for avatars
- **Firebase Auth** - Authentication system

### Deployment
- **Vercel** - Frontend hosting
- **Railway/Render** - Backend hosting



## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase project
- Stripe account (optional)

### 1. Clone Repository
```bash
git clone https://github.com/Nathanlie-Ortega/TicketUnify.git
cd TicketUnify
```


### 5. Run Development Servers

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
cd backend
npm run dev
```

Visit `http://localhost:3000` to see the application.

## API Endpoints

### Tickets
- `POST /api/tickets` - Create new ticket
- `GET /api/tickets/:id` - Get ticket details
- `PATCH /api/tickets/:id/checkin` - Check-in ticket
- `GET /api/tickets/user/:userId` - Get user's tickets


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

