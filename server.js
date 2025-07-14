const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/assignmentPortal';

// MongoDB connection options
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
};

mongoose.connect(MONGODB_URI, mongooseOptions)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
    console.log('📊 Database:', MONGODB_URI.includes('localhost') ? 'Local MongoDB' : 'MongoDB Atlas');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('');
    console.log('💡 SOLUTIONS:');
    console.log('1. If using local MongoDB:');
    console.log('   - Install MongoDB: https://www.mongodb.com/try/download/community');
    console.log('   - Start MongoDB service');
    console.log('');
    console.log('2. If using MongoDB Atlas (Recommended):');
    console.log('   - Go to: https://www.mongodb.com/atlas');
    console.log('   - Create free account');
    console.log('   - Create cluster and get connection string');
    console.log('   - Replace MONGODB_URI in server.js');
    console.log('');
    console.log('3. Set environment variable:');
    console.log('   MONGODB_URI=your_connection_string node server.js');
    console.log('');
    process.exit(1);
  });

// User Schema
const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  createdAt: { type: Date, default: Date.now },
  lastAssignmentsSeenAt: { type: Date, default: Date.now },
  profilePicture: { type: String, default: '' }
}));

// Assignment Schema
const Assignment = mongoose.model('Assignment', new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  course: { type: String, required: true },
  title: { type: String, required: true },
  filePath: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  // Grading fields
  grade: { type: Number, min: 0, max: 10, default: null },
  feedback: { type: String, default: '' },
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  gradedAt: { type: Date, default: null },
  // Assignment metadata
  assignmentType: { type: String, enum: ['Homework', 'Project', 'Quiz', 'Exam'], default: 'Homework' },
  priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignmentTemplate' }
}));

// Official Assignment Schema (for admin uploads)
const OfficialAssignment = mongoose.model('OfficialAssignment', new mongoose.Schema({
  title: { type: String, required: true },
  course: { type: String, required: true },
  description: { type: String },
  deadline: { type: Date },
  filePath: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  // Assignment categorization
  assignmentType: { type: String, enum: ['Homework', 'Project', 'Quiz', 'Exam'], default: 'Homework' },
  priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignmentTemplate' }
}));

// Assignment Template Schema
const AssignmentTemplate = mongoose.model('AssignmentTemplate', new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  assignmentType: { type: String, enum: ['Homework', 'Project', 'Quiz', 'Exam'], required: true },
  priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  defaultDeadline: { type: Number, default: 7 }, // days from creation
  instructions: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPublic: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}));

// Student Performance Schema
const StudentPerformance = mongoose.model('StudentPerformance', new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: String, required: true },
  totalSubmissions: { type: Number, default: 0 },
  totalGraded: { type: Number, default: 0 },
  averageGrade: { type: Number, default: 0 },
  highestGrade: { type: Number, default: 0 },
  lowestGrade: { type: Number, default: 0 },
  lastSubmissionDate: { type: Date },
  lastLoginDate: { type: Date },
  activeDays: { type: Number, default: 0 },
  streakDays: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
}));

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({ 
  secret: 'assignment-portal-secret-key', 
  resave: false, 
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Authentication Middleware
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

const requireAdmin = async (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  try {
    const user = await User.findById(req.session.userId);
    if (user && user.role === 'admin') {
      return next();
    }
    res.status(403).render('error', { message: 'Access denied. Admin privileges required.' });
  } catch (error) {
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Multer Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'), false);
  }
};

const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter
});

// Multer config for profile picture uploads
const profilePicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/profile-pictures/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, req.session.userId + '-' + Date.now() + ext);
  }
});
const uploadProfilePic = multer({
  storage: profilePicStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed!'));
  }
});

// Routes

// Home page
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

// Login page
app.get('/login', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: null });
  }
});

// Register page
app.get('/register', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.render('register', { error: null });
  }
});

// Login POST
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('login', { error: 'Invalid email or password' });
    }
    
    req.session.userId = user._id;
    req.session.userRole = user.role;
    console.log('User logged in successfully:', user.username, 'Role:', user.role);
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'Server error. Please try again.' });
  }
});

// Register POST
app.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
      return res.render('register', { error: 'Passwords do not match' });
    }
    
    if (password.length < 6) {
      return res.render('register', { error: 'Password must be at least 6 characters long' });
    }
    
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.render('register', { error: 'User already exists with this email or username' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: 'student'
    });
    
    await user.save();
    console.log('User registered successfully:', username);
    res.redirect('/login');
  } catch (error) {
    console.error('Registration error:', error);
    res.render('register', { error: 'Server error. Please try again.' });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Dashboard
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (user.role === 'admin') {
      res.redirect('/admin');
    } else {
      const assignments = await Assignment.find({ studentId: user._id }).sort({ createdAt: -1 });
      const officialAssignments = await OfficialAssignment.find().populate('uploadedBy', 'username').sort({ createdAt: -1 });
      // Track new assignments (not yet viewed by student)
      let newAssignmentsCount = 0;
      if (!user.lastAssignmentsSeenAt) user.lastAssignmentsSeenAt = new Date(0);
      newAssignmentsCount = await OfficialAssignment.countDocuments({ createdAt: { $gt: user.lastAssignmentsSeenAt } });
      res.render('student-dashboard', { user, assignments, officialAssignments, newAssignmentsCount });
    }
  } catch (error) {
    res.status(500).render('error', { message: 'Server error' });
  }
});

// Upload assignment page
app.get('/upload', requireAuth, (req, res) => {
  res.render('upload', { error: null, success: null });
});

// Upload assignment POST
app.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { course, title } = req.body;
    const user = await User.findById(req.session.userId);
    
    if (!req.file) {
      return res.render('upload', { error: 'Please select a file to upload', success: null });
    }
    
    const assignment = new Assignment({
      studentId: user._id,
      studentName: user.username,
      course,
      title,
      filePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
    
  await assignment.save();

  // Real-time Notification
    io.emit('newUpload', { 
      studentName: user.username, 
      course, 
      title,
      timestamp: new Date()
    });
    
    // Email Notification (only if admin exists)
    try {
      const adminUser = await User.findOne({ role: 'admin' });
      if (adminUser) {
        const transporter = nodemailer.createTransporter({
    service: 'gmail',
          auth: { 
            user: 'devanshusheladiya407@gmail.com', 
            pass: 'swcn wczw otuc vfml' 
          },
  });

  await transporter.sendMail({
    from: 'devanshusheladiya407@gmail.com',
          to: adminUser.email,
    subject: 'New Assignment Submitted',
          html: `
            <h3>New Assignment Submission</h3>
            <p><strong>Student:</strong> ${user.username}</p>
            <p><strong>Course:</strong> ${course}</p>
            <p><strong>Assignment:</strong> ${title}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          `
        });
      }
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
    }
    
    res.render('upload', { error: null, success: 'Assignment uploaded successfully!' });
  } catch (error) {
    console.error('Upload error:', error);
    res.render('upload', { error: 'Upload failed. Please try again.', success: null });
  }
});

// Admin dashboard
app.get('/admin', requireAdmin, async (req, res) => {
  try {
    const uploads = await Assignment.find().populate('studentId', 'username email').sort({ createdAt: -1 });
    const user = await User.findById(req.session.userId);
    res.render('admin', { uploads, user });
  } catch (error) {
    res.status(500).render('error', { message: 'Server error' });
  }
});

// Admin assignment upload page
app.get('/admin/upload-assignment', requireAdmin, (req, res) => {
  res.render('admin-upload-assignment', { error: null, success: null });
});

// Admin assignment upload POST
app.post('/admin/upload-assignment', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const { title, course, description, deadline, assignmentType } = req.body;
    const user = await User.findById(req.session.userId);
    
    if (!req.file) {
      return res.render('admin-upload-assignment', { error: 'Please select a file to upload', success: null });
    }
    if (!assignmentType) {
      return res.render('admin-upload-assignment', { error: 'Please select an assignment type', success: null });
    }
    
    const assignment = new OfficialAssignment({
      title,
      course,
      description: description || '',
      deadline: deadline ? new Date(deadline) : null,
      filePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      uploadedBy: user._id,
      assignmentType
    });
    
    await assignment.save();
    
    res.render('admin-upload-assignment', { error: null, success: 'Assignment uploaded successfully!' });
  } catch (error) {
    console.error('Assignment upload error:', error);
    res.render('admin-upload-assignment', { error: 'Upload failed. Please try again.', success: null });
  }
});

// View official assignments (for students)
app.get('/assignments', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    // Mark all assignments as seen
    user.lastAssignmentsSeenAt = new Date();
    await user.save();
    const assignments = await OfficialAssignment.find().populate('uploadedBy', 'username').sort({ createdAt: -1 });
    res.render('assignments', { assignments, user });
  } catch (error) {
    res.status(500).render('error', { message: 'Server error' });
  }
});

// Download official assignment
app.get('/download-assignment/:id', requireAuth, async (req, res) => {
  try {
    const assignment = await OfficialAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).render('error', { message: 'Assignment not found' });
    }
    
    if (!fs.existsSync(assignment.filePath)) {
      return res.status(404).render('error', { message: 'File not found' });
    }
    
    res.download(assignment.filePath, assignment.fileName);
  } catch (error) {
    res.status(500).render('error', { message: 'Download failed' });
  }
});

// Download file
app.get('/download/:id', requireAdmin, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).render('error', { message: 'Assignment not found' });
    }
    
    if (!fs.existsSync(assignment.filePath)) {
      return res.status(404).render('error', { message: 'File not found' });
    }
    
    res.download(assignment.filePath, assignment.fileName);
  } catch (error) {
    res.status(500).render('error', { message: 'Download failed' });
  }
});

// Delete submission
app.post('/delete/:id', requireAdmin, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    // Delete file from filesystem
    if (fs.existsSync(assignment.filePath)) {
      fs.unlinkSync(assignment.filePath);
    }
    
    await Assignment.findByIdAndDelete(req.params.id);
    
    // Update student performance
    await updateStudentPerformance(assignment.studentId, assignment.course);
    
    res.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Create admin user (for initial setup)
app.get('/setup-admin', async (req, res) => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      return res.status(400).render('error', { message: 'Admin user already exists' });
    }
    
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const admin = new User({
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin'
    });
    
    await admin.save();
    res.render('error', { message: 'Admin user created successfully.<br>Email: <b>admin@example.com</b><br>Password: <b>admin123</b>' });
  } catch (error) {
    res.status(500).send('Failed to create admin user');
  }
});

// Grade assignment (Admin only)
app.post('/admin/grade/:id', requireAdmin, async (req, res) => {
  try {
    const { grade, feedback } = req.body;
    const assignment = await Assignment.findById(req.params.id);
    
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    assignment.grade = parseFloat(grade);
    assignment.feedback = feedback || '';
    assignment.gradedBy = req.session.userId;
    assignment.gradedAt = new Date();
    
    await assignment.save();
    
    // Update student performance
    await updateStudentPerformance(assignment.studentId, assignment.course);
    
    res.json({ success: true, message: 'Assignment graded successfully' });
  } catch (error) {
    console.error('Grading error:', error);
    res.status(500).json({ error: 'Grading failed' });
  }
});

// Get assignment templates
app.get('/admin/templates', requireAdmin, async (req, res) => {
  try {
    const templates = await AssignmentTemplate.find().populate('createdBy', 'username').sort({ createdAt: -1 });
    res.render('admin-templates', { templates, error: null, success: null });
  } catch (error) {
    res.status(500).render('error', { message: 'Server error' });
  }
});

// Create assignment template
app.post('/admin/templates', requireAdmin, async (req, res) => {
  try {
    const { name, description, assignmentType, priority, defaultDeadline, instructions } = req.body;
    
    const template = new AssignmentTemplate({
      name,
      description,
      assignmentType,
      priority,
      defaultDeadline: parseInt(defaultDeadline) || 7,
      instructions,
      createdBy: req.session.userId
    });
    
    await template.save();
    res.redirect('/admin/templates');
  } catch (error) {
    console.error('Template creation error:', error);
    res.status(500).render('error', { message: 'Template creation failed' });
  }
});

// Student performance dashboard
app.get('/performance', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (user.role === 'admin') {
      return res.redirect('/admin/analytics');
    }
    
    const assignments = await Assignment.find({ studentId: user._id }).sort({ createdAt: -1 });
    const performance = await StudentPerformance.find({ studentId: user._id });
    
    // Calculate analytics
    const analytics = calculateStudentAnalytics(assignments, performance);
    
    res.render('student-performance', { user, assignments, performance, analytics });
  } catch (error) {
    res.status(500).render('error', { message: 'Server error' });
  }
});

// Admin analytics dashboard
app.get('/admin/analytics', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    
    // Get all data for analytics
    const assignments = await Assignment.find().populate('studentId', 'username email');
    const officialAssignments = await OfficialAssignment.find().populate('uploadedBy', 'username');
    const students = await User.find({ role: 'student' });
    const performance = await StudentPerformance.find().populate('studentId', 'username');
    
    // Calculate analytics
    const analytics = calculateAdminAnalytics(assignments, officialAssignments, students, performance);
    
    res.render('admin-analytics', { user, analytics });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).render('error', { message: 'Server error' });
  }
});

// Export analytics report
app.get('/admin/export-report', requireAdmin, async (req, res) => {
  try {
    const { format } = req.query; // 'pdf' or 'excel'
    const assignments = await Assignment.find().populate('studentId', 'username email');
    const performance = await StudentPerformance.find().populate('studentId', 'username');
    
    if (format === 'excel') {
      // Generate Excel report
      const reportData = generateExcelReport(assignments, performance);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics-report.xlsx');
      res.send(reportData);
    } else {
      // Generate PDF report
      const reportData = generatePDFReport(assignments, performance);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics-report.pdf');
      res.send(reportData);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).render('error', { message: 'Export failed' });
  }
});

// Helper function to update student performance
async function updateStudentPerformance(studentId, course) {
  try {
    const assignments = await Assignment.find({ studentId, course });
    const gradedAssignments = assignments.filter(a => a.grade !== null);
    
    const totalSubmissions = assignments.length;
    const totalGraded = gradedAssignments.length;
    const grades = gradedAssignments.map(a => a.grade);
    
    const averageGrade = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;
    const highestGrade = grades.length > 0 ? Math.max(...grades) : 0;
    const lowestGrade = grades.length > 0 ? Math.min(...grades) : 0;
    
    await StudentPerformance.findOneAndUpdate(
      { studentId, course },
      {
        totalSubmissions,
        totalGraded,
        averageGrade: Math.round(averageGrade * 100) / 100,
        highestGrade,
        lowestGrade,
        lastSubmissionDate: new Date(),
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Performance update error:', error);
  }
}

// Helper function to calculate student analytics
function calculateStudentAnalytics(assignments, performance) {
  const totalSubmissions = assignments.length;
  const gradedAssignments = assignments.filter(a => a.grade !== null);
  const totalGraded = gradedAssignments.length;
  const grades = gradedAssignments.map(a => a.grade);
  
  const averageGrade = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;
  const highestGrade = grades.length > 0 ? Math.max(...grades) : 0;
  const lowestGrade = grades.length > 0 ? Math.min(...grades) : 0;
  
  // Calculate submission trends (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSubmissions = assignments.filter(a => a.createdAt >= thirtyDaysAgo);
  
  // Group by assignment type
  const byType = assignments.reduce((acc, assignment) => {
    const type = assignment.assignmentType || 'Homework';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  
  return {
    totalSubmissions,
    totalGraded,
    averageGrade: Math.round(averageGrade * 100) / 100,
    highestGrade,
    lowestGrade,
    recentSubmissions: recentSubmissions.length,
    byType,
    performance: performance[0] || {}
  };
}

// Helper function to calculate admin analytics
function calculateAdminAnalytics(assignments, officialAssignments, students, performance) {
  const totalStudents = students.length;
  const totalSubmissions = assignments.length;
  const totalGraded = assignments.filter(a => a.grade !== null).length;
  const totalOfficialAssignments = officialAssignments.length;
  
  // Calculate average grades
  const gradedAssignments = assignments.filter(a => a.grade !== null);
  const averageGrade = gradedAssignments.length > 0 
    ? gradedAssignments.reduce((sum, a) => sum + a.grade, 0) / gradedAssignments.length 
    : 0;
  
  // Recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSubmissions = assignments.filter(a => a.createdAt >= sevenDaysAgo);
  const recentOfficialAssignments = officialAssignments.filter(a => a.createdAt >= sevenDaysAgo);
  
  // Group by course
  const byCourse = assignments.reduce((acc, assignment) => {
    const course = assignment.course;
    if (!acc[course]) {
      acc[course] = { submissions: 0, graded: 0, averageGrade: 0 };
    }
    acc[course].submissions++;
    if (assignment.grade !== null) {
      acc[course].graded++;
      acc[course].averageGrade += assignment.grade;
    }
    return acc;
  }, {});
  
  // Calculate averages for each course
  Object.keys(byCourse).forEach(course => {
    if (byCourse[course].graded > 0) {
      byCourse[course].averageGrade = Math.round((byCourse[course].averageGrade / byCourse[course].graded) * 100) / 100;
    }
  });
  
  return {
    totalStudents,
    totalSubmissions,
    totalGraded,
    totalOfficialAssignments,
    averageGrade: Math.round(averageGrade * 100) / 100,
    recentSubmissions: recentSubmissions.length,
    recentOfficialAssignments: recentOfficialAssignments.length,
    byCourse,
    performance
  };
}

// Helper functions for report generation (placeholder implementations)
function generateExcelReport(assignments, performance) {
  // This would use a library like exceljs to generate Excel files
  // For now, return a simple text representation
  return Buffer.from('Excel report placeholder');
}

function generatePDFReport(assignments, performance) {
  // This would use a library like puppeteer or jsPDF to generate PDF files
  // For now, return a simple text representation
  return Buffer.from('PDF report placeholder');
}

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.render('upload', { error: 'File size too large. Maximum size is 10MB.', success: null });
    }
  }
  console.error(error);
  res.status(500).render('error', { message: 'Something went wrong!' });
});

// Socket.io setup
io.on('connection', (socket) => {
  console.log('User connected to real-time updates');
  
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// GET /profile - Show profile page
app.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    res.render('profile', { user, error: null, success: null });
  } catch (error) {
    res.status(500).render('error', { message: 'Failed to load profile.' });
  }
});

// POST /profile/update - Update name, email, profile picture
app.post('/profile/update', requireAuth, uploadProfilePic.single('profilePicture'), async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const { username, email } = req.body;
    // Check for email uniqueness
    if (email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.render('profile', { user, error: 'Email already in use.', success: null });
      }
    }
    user.username = username;
    user.email = email;
    if (req.file) {
      user.profilePicture = req.file.path;
    }
    await user.save();
    res.render('profile', { user, error: null, success: 'Profile updated successfully.' });
  } catch (error) {
    const user = await User.findById(req.session.userId);
    res.render('profile', { user, error: 'Failed to update profile.', success: null });
  }
});

// POST /profile/change-password - Change password securely
app.post('/profile/change-password', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const { oldPassword, newPassword, confirmPassword } = req.body;
    if (!(await bcrypt.compare(oldPassword, user.password))) {
      return res.render('profile', { user, error: 'Old password is incorrect.', success: null });
    }
    if (newPassword !== confirmPassword) {
      return res.render('profile', { user, error: 'New passwords do not match.', success: null });
    }
    if (newPassword.length < 6) {
      return res.render('profile', { user, error: 'Password must be at least 6 characters.', success: null });
    }
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.render('profile', { user, error: null, success: 'Password changed successfully.' });
  } catch (error) {
    const user = await User.findById(req.session.userId);
    res.render('profile', { user, error: 'Failed to change password.', success: null });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Setup admin user: http://localhost:3001/setup-admin');
});