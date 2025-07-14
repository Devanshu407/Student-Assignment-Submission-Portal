# 📚 Student Assignment Submission Portal

A modern web application for managing student assignment submissions with real-time notifications, built with Node.js, Express, MongoDB, and Socket.io.

## ✨ Features

### 🎓 Student Features
- **User Registration & Authentication**: Secure login/register system with password hashing
- **Assignment Upload**: Drag-and-drop file upload with validation
- **Submission History**: View all your submitted assignments
- **Real-time Status**: Track submission status and timestamps
- **Modern UI**: Beautiful, responsive interface

### 👨‍🏫 Admin Features
- **Real-time Dashboard**: Live updates when new assignments are submitted
- **File Management**: Download and delete assignment files
- **Student Overview**: View all submissions with student details
- **Email Notifications**: Automatic email alerts for new submissions
- **Statistics**: View submission statistics and trends
- **Assignment Upload**: Create and upload official assignments for students
- **Assignment Management**: Set deadlines, descriptions, and course-specific assignments

### 🔧 Technical Features
- **File Validation**: Supports PDF, DOC, DOCX, TXT files (max 10MB)
- **Session Management**: Secure user sessions with express-session
- **Real-time Updates**: Socket.io for instant notifications
- **Email Integration**: Nodemailer for email notifications
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (running locally or MongoDB Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd student-assignment-portal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   
   # Or use MongoDB Atlas (cloud)
   ```

4. **Start the application**
   ```bash
   npm start
   ```

5. **Setup Admin User**
   - Visit: `http://localhost:3000/setup-admin`
   - Default admin credentials:
     - Email: `admin@example.com`
     - Password: `admin123`

6. **Access the application**
   - Student Portal: `http://localhost:3000`
   - Admin Dashboard: `http://localhost:3000/admin` (after login)

## 📁 Project Structure

```
student-assignment-portal/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── views/                 # EJS templates
│   ├── login.ejs         # Login page
│   ├── register.ejs      # Registration page
│   ├── student-dashboard.ejs  # Student dashboard
│   ├── upload.ejs        # File upload page
│   ├── admin.ejs         # Admin dashboard
│   └── error.ejs         # Error page
├── uploads/              # Uploaded files storage
└── README.md            # This file
```

## 🔐 User Roles

### Student
- Register/Login with email and password
- Upload assignment files
- View submission history
- Track submission status

### Admin
- Login with admin credentials
- View all student submissions
- Download assignment files
- Delete submissions
- Receive real-time notifications

## 📧 Email Configuration

The application uses Gmail for sending notifications. Update the email configuration in `server.js`:

```javascript
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: { 
    user: 'your-email@gmail.com', 
    pass: 'your-app-password' 
  },
});
```

**Note**: Use Gmail App Passwords for better security.

## 🛠️ Configuration

### Environment Variables (Optional)
Create a `.env` file for configuration:

```env
PORT=3000
MONGODB_URI=mongodb://localhost/assignmentPortal
SESSION_SECRET=your-session-secret
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### File Upload Settings
- **Max file size**: 10MB
- **Allowed formats**: PDF, DOC, DOCX, TXT
- **Storage**: Local file system (`/uploads` directory)

## 🔒 Security Features

- **Password Hashing**: bcryptjs for secure password storage
- **Session Management**: Express-session with secure cookies
- **File Validation**: Server-side file type and size validation
- **Authentication Middleware**: Protected routes for users and admins
- **CSRF Protection**: Built-in protection against CSRF attacks

## 📱 Responsive Design

The application is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones
- All modern browsers

## 🚀 Deployment

### Local Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Production
```bash
npm start
```

### Docker (Optional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in `server.js`

2. **File Upload Fails**
   - Check file size (max 10MB)
   - Verify file format (PDF, DOC, DOCX, TXT)
   - Ensure `/uploads` directory exists

3. **Email Notifications Not Working**
   - Verify Gmail credentials
   - Check if admin user exists
   - Ensure internet connection

4. **Port Already in Use**
   - Change port in `server.js` or use environment variable
   - Kill existing process on port 3000

## 📈 Future Enhancements

- [ ] File preview functionality
- [ ] Assignment deadlines and late submissions
- [ ] Grade management system
- [ ] Student feedback system
- [ ] Bulk file operations
- [ ] Advanced search and filtering
- [ ] Export functionality (CSV/Excel)
- [ ] Mobile app version

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 👨‍💻 Author

Created with ❤️ for educational purposes.

---

**Happy Coding! 🎉** 

### 🎯 Assignment Management
- **Admin Assignment Upload**: Upload official assignments with:
  - Assignment title and course name
  - Optional description and deadline
  - File attachments (PDF, DOC, DOCX, TXT, ZIP)
- **Student Assignment Viewing**: Students can:
  - View all available assignments
  - See assignment details and deadlines
  - Download assignment files
  - Access assignments from their dashboard 