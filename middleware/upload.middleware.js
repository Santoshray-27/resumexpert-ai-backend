/**
 * Multer Upload Middleware
 * Handles resume file uploads (PDF, DOCX)
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists

const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ========================
// Storage Configuration
// ========================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create user-specific subdirectory
    const userDir = path.join(uploadDir, req.user ? req.user._id.toString() : 'temp');
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },

  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-originalname

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
    cb(null, `resume-${uniqueSuffix}${ext}`);
  }
});

// ========================
// File Filter
// ========================

const fileFilter = (req, file, cb) => {
  const allowedMimetypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const allowedExtensions = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimetypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and DOCX files are allowed.'), false);
  }
};

// ========================
// Multer Instance
// ========================

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 1 // Only one file at a time
  }
});

// ========================
// Export Middleware Functions
// ========================

// Single resume upload
const uploadResume = upload.single('resume');

// Wrapped upload with error handling
const handleResumeUpload = (req, res, next) => {
  uploadResume(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File too large. Maximum allowed size is ${Math.round((parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024) / 1024 / 1024)}MB`
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message
        });
      } else {
        // Custom file filter errors
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error'
        });
      }
    }

    // No file uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a resume file (PDF or DOCX)'
      });
    }

    next();
  });
};

module.exports = { handleResumeUpload };
