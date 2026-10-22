# API Monitoring Sentinel

A comprehensive API monitoring solution built with Node.js, React, and PostgreSQL that provides real-time health checks, downtime alerts, and performance analytics.

## 🏗️ Architecture Overview

### Backend (Node.js/Express)
- **RESTful API** with JWT authentication
- **PostgreSQL** for persistent storage of monitors, checks, and user data
- **Redis + BullMQ** for job queuing and scheduled monitoring
- **Worker Architecture** decouples health check execution from API requests
- **Email Alerting** via Nodemailer with SMTP configuration (falls back to console logging in dev)
- **Modular Services** separating concerns (monitor service, alert service, queue service)

### Frontend (React/Vite)
- **Modern React** with hooks and functional components
- **Vite** for lightning-fast development and build
- **Lucide React** for lightweight, beautiful icons
- **CSS Custom Properties** for consistent theming
- **Real-time Updates** via polling (every 15 seconds)
- **Responsive Design** working on mobile and desktop
- **Modal-Based UX** for clean, focused interactions

### Infrastructure
- **Docker Compose** ready (mentioned in comments for Redis setup)
- **Environment Configuration** with `.env.example`
- **Graceful Shutdown** handling SIGTERM/SIGINT
- **Health Check Endpoint** at `/health`

## 🔧 Why This Architecture?

### Choice of Technologies

#### Backend: Node.js + Express + PostgreSQL
- **Node.js/Express**: Mature ecosystem, excellent for I/O-bound operations like HTTP health checks, vast npm package availability
- **PostgreSQL**: Robust relational database with excellent JSONB support, ACID compliance, and powerful querying capabilities needed for complex monitor statistics
- **Redis + BullMQ**: Provides reliable job queuing with built-in retry mechanisms, concurrency control, and monitoring - superior to simple setInterval/cron for distributed worker systems
- **Microservice-Ready Design**: Services are decoupled making it easy to scale worker nodes independently

#### Frontend: React + Vite
- **React**: Component-based architecture promotes reusability (MonitorCard, KpiCards, modals), large talent pool, excellent dev tools
- **Vite**: Near-instant startup and hot module replacement significantly improves developer experience over Create React App/Webpack
- **CSS Variables**: Centralized theming makes it easy to maintain visual consistency and implement dark/light mode alternatives
- **Lucide Icons**: Tree-shakable, consistent styling, actively maintained alternative to heavier icon libraries

#### Communication Pattern
- **REST API**: Simple, cacheable, language-agnostic, works well with React's data fetching patterns
- **JWT Authentication**: Stateless authentication suitable for SPA applications, easy to implement and scale
- **Polling (15s)**: Simpler than WebSockets for this use case, avoids connection management complexity while providing near real-time updates

### Design Decisions

#### Worker-Based Monitoring
Instead of running health checks in the main API process or using simple cron jobs, we use a dedicated worker system because:
1. **Scalability**: Workers can be scaled independently based on monitor load
2. **Fault Isolation**: If a health check fails or hangs, it doesn't block API requests
3. **Resource Efficiency**: Workers can be paused/scaled down during off-hours
4. **Retry Logic**: BullMQ provides built-in exponential backoff and retry mechanisms
5. **Monitoring**: Built-in events for completed/failed jobs provide visibility

#### Alerting System
Email alerts were chosen over SMS/push notifications because:
1. **Universality**: Email works everywhere without requiring additional apps or permissions
2. **Rich Content**: Can include formatted HTML with metrics, timestamps, and actionable information
3. **Cost Effective**: No per-message costs compared to SMS
4. **Reliability**: Email services have high deliverability and built-in retry mechanisms
5. **Audit Trail**: Email provides a natural audit trail for incident response

The alert system implements two key notifications:
- **Downtime Alerts**: When an API transitions from UP/PENDING to DOWN
- **Recovery Alerts**: When an API transitions from DOWN to UP

This prevents alert fatigue while ensuring critical issues are communicated promptly.

#### Database Schema Design
The schema separates concerns effectively:
- **monitors**: Stores configuration (user_id, name, url, interval, active status)
- **monitor_checks**: Time-series data of each check (status, response time, timestamps)
- **users**: Authentication and profile information
- **incident_alerts**: Record of sent notifications for audit/tracking

This normalization allows:
- Efficient querying of current status (via monitors table)
- Deep historical analysis (via monitor_checks)
- Flexible alerting rules without schema changes
- Easy aggregation for dashboard statistics

#### Frontend State Management
Local component state with React hooks was chosen over external state management (Redux/Zustand) because:
1. **Simplicity**: The application state is relatively flat and component-scoped
2. **Performance**: Minimizes re-renders by keeping state close to where it's used
3. **Maintainability**: Less boilerplate and indirection for a medium-sized app
4. **Sufficiency**: Context API handles the few global needs (auth token, user data)

Performance considerations like useCallback and memoization are applied where beneficial (e.g., in list rendering).

## 🚀 Features

### Core Monitoring
- ✅ Real-time health checks with configurable intervals
- ✅ Response time tracking and alerting
- ✅ HTTP status code monitoring (2xx-3xx = UP, else DOWN)
- ✅ Connection timeout detection (10s timeout)
- ✅ Automatic retry on transient failures

### Alerting & Notifications
- ✅ Email alerts on API downtime (configurable SMTP)
- ✅ Recovery notifications when service restored
- ✅ Console-based alert fallback for development
- ✅ Incident tracking in database for audit

### Dashboard & Analytics
- ✅ Real-time status overview (UP/DOWN/PAUSED counts)
- ✅ Average response latency across all monitors
- ✅ 24-hour uptime percentage calculation
- ✅ Per-monitor detailed analytics (trends, incidents)
- ✅ Historical check data visualization
- ✅ Manual "Check Now" capability

### User Experience
- ✅ Beautiful, modern dark-mode UI
- ✅ Responsive design (mobile to desktop)
- ✅ Intuitive keyboard-navigable interface
- ✅ Quick demo mode for instant evaluation
- ✅ Sample data generation for testing
- ✅ Filtering and search capabilities
- ✅ Modal-based workflows for focused actions

### Developer Experience
- ✅ Environment variable configuration
- ✅ Comprehensive error handling and logging
- ✅ Graceful shutdown procedures
- ✅ Health check endpoint (`/health`)
- ✅ Docker-compose friendly configuration
- ✅ Example environment file provided
- ✅ Modular, testable service architecture

## 📋 Prerequisites

- Node.js >= 18.x
- PostgreSQL >= 13.x
- Redis >= 6.x (for BullMQ workers)
- npm or yarn

## 🛠️ Setup & Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd APImonitoring
```

### 2. Configure Environment
```bash
# Copy example environment files
cp Backend/.env.example Backend/.env
# Edit .env with your actual configuration
# Particularly important: DATABASE_URL, SMTP settings (for email alerts)
```

### 3. Install Dependencies
```bash
# Backend
cd Backend
npm install

# Frontend
cd ../Frontend
npm install
```

### 4. Initialize Database
```bash
# From Backend directory
npm run init-db
# Or manually run the schema.sql if needed
```

### 5. Start Services
```bash
# In separate terminals:
# Terminal 1: Start Redis (if not running)
# redis-server
# OR: docker run -d -p 6379:6379 redis:7-alpine

# Terminal 2: Start Backend
cd Backend
npm start

# Terminal 3: Start Frontend
cd ../Frontend
npm run dev
```

### 6. Access the Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1
- Health Check: http://localhost:8000/health

## 📧 Email Alert Configuration

To enable real email alerts (instead of console logging):

1. Edit `Backend/.env` and uncomment/configure:
   ```env
   # SMTP_HOST=smtp.gmail.com
   # SMTP_PORT=587
   # SMTP_USER=your_email@gmail.com
   # SMTP_PASS=your_app_password
   # SMTP_SECURE=false
   # ALERT_EMAIL_FROM="API Sentinel" <alerts@apimonitor.dev>
   ```

2. For Gmail, you'll need to:
   - Enable 2-Factor Authentication
   - Generate an App Password
   - Use that as `SMTP_PASS`

3. Other SMTP providers (Outlook, Yahoo, custom servers) work similarly

## 🔐 Security Considerations

- **JWT Tokens**: Stored in httpOnly cookies or localStorage (frontend choice), transmitted via Authorization header
- **Environment Secrets**: Never commit `.env` files - uses `.gitignore` protection
- **Input Validation**: URL validation performed before storage/checking
- **Rate Limiting**: Could be added to API endpoints (planned enhancement)
- **CORS**: Configured to restrict origins in production
- **SQL Safety**: Uses parameterized queries throughout to prevent injection

## 🧪 Testing

### Backend Tests
```bash
# From Backend directory
npm test
# Runs Jest test suite covering services and models
```

### Frontend Testing
```bash
# From Frontend directory
npm run test
# Runs React Testing Library + Jest tests
```

## 📈 Future Enhancements

### Planned Features
- [ ] **WebSocket Integration**: Real-time updates instead of polling
- [ ] **SMS Alerts**: Twilio integration for critical alerts
- [ ] **Slack/Teams Notifications**: ChatOps integrations
- [ ] **API Rate Limiting**: Prevent abuse of monitoring endpoints
- [ ] **Advanced Analytics**: SLA reporting, percentiles, error budget tracking
- [ ] **Multi-tenancy**: Team/Organization support with role-based access
- [ ] **Synthetic Transactions**: Multi-step API workflow monitoring
- [ ] **SSL Certificate Expiry Monitoring**: For HTTPS endpoints
- [ ] **Pause Maintenance Windows**: Scheduled downtime suppression
- [ ] **Export/Import**: Monitor configurations as JSON/YAML
- [ ] **Audit Trail**: Detailed user action logging
- [ ] **Docker Compose**: One-command production setup
- [ ] **Kubernetes Helm Charts**: Cloud-native deployment

### Technical Improvements
- [ ] **Caching Layer**: Redis caching for frequent dashboard queries
- [ ] **Database Index Optimization**: Query performance tuning
- [ ] **Worker Auto-scaling**: Dynamic worker count based on queue depth
- [ ] **Circuit Breaker Pattern**: For external API dependencies
- [ ] **Structured Logging**: JSON logs for ELK/Datadog integration
- [ ] **Distributed Tracing**: OpenTelemetry integration
- [ ] **Feature Flags**: Safe rollout of new functionality
- [ ] **Canary Deployments**: Risk reduction for production releases

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the existing style and includes appropriate tests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Node.js Community**: For the incredible ecosystem of packages
- **React Team**: For building a library that makes UI development joyful
- **PostgreSQL & Redis**: For robust, performant data infrastructure
- ** BullMQ**: For excellent job queuing capabilities
- **Nodemailer**: For simple, reliable email sending
- **Lucide Icons**: For beautiful, lightweight icons
- **Vite**: For redefining frontend build tooling

Built with ❤️ for developers who care about their API reliability.

--- 
*Architecture Decision Record: This README explains the rationale behind key technical choices made during development to help future maintainers understand the "why" behind the implementation.*