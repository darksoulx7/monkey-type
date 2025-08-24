const express = require('express');
const User = require('../models/User');
const { 
  createSendToken, 
  protect, 
  refreshToken, 
  logout 
} = require('../middleware/auth');
const { 
  validateUserRegistration, 
  validateUserLogin 
} = require('../middleware/validation');
const { AppError, asyncHandler } = require('../middleware/error');
const logger = require('../config/logger');

const router = express.Router();

// @route   POST /api/v1/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validateUserRegistration, asyncHandler(async (req, res, next) => {
  const { username, email, password } = req.body;
  
  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [
      { email: email.toLowerCase() },
      { username: username }
    ]
  });
  
  if (existingUser) {
    const field = existingUser.email === email.toLowerCase() ? 'email' : 'username';
    logger.security('registration_attempt_duplicate', {
      field,
      value: field === 'email' ? email : username,
      ip: req.ip
    });
    return next(new AppError(`User with this ${field} already exists`, 409, 'DUPLICATE_USER'));
  }
  
  // Create new user
  const newUser = await User.create({
    username,
    email: email.toLowerCase(),
    password
  });
  
  // Log successful registration
  logger.auth('user_registered', newUser._id, req.ip, req.get('User-Agent'));
  logger.info(`👤 New user registered: ${username} (${email})`);
  
  // Send token response
  createSendToken(newUser, 201, res, 'User registered successfully');
}));

// @route   POST /api/v1/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateUserLogin, asyncHandler(async (req, res, next) => {
  const { identifier, password } = req.body;
  
  // Find user by email or username and include password
  const user = await User.findByIdentifier(identifier).select('+password');
  
  if (!user) {
    logger.security('login_attempt_invalid_user', {
      identifier,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return next(new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS'));
  }
  
  // Check if user account is active
  if (!user.isActive) {
    logger.security('login_attempt_inactive_user', {
      userId: user._id,
      ip: req.ip
    });
    return next(new AppError('Account has been deactivated. Please contact support.', 401, 'ACCOUNT_DEACTIVATED'));
  }
  
  // Check password
  const isPasswordCorrect = await user.comparePassword(password);
  
  if (!isPasswordCorrect) {
    logger.security('login_attempt_wrong_password', {
      userId: user._id,
      identifier,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return next(new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS'));
  }
  
  // Update last login
  await user.updateLastLogin();
  
  // Log successful login
  logger.auth('login_success', user._id, req.ip, req.get('User-Agent'));
  
  // Send token response
  createSendToken(user, 200, res, 'Login successful');
}));

// @route   POST /api/v1/auth/refresh
// @desc    Refresh access token using refresh token
// @access  Public
router.post('/refresh', refreshToken);

// @route   POST /api/v1/auth/logout
// @desc    Logout user (invalidate refresh token)
// @access  Private
router.post('/logout', protect, logout);

// @route   POST /api/v1/auth/logout-all
// @desc    Logout from all devices (invalidate all refresh tokens)
// @access  Private
router.post('/logout-all', protect, asyncHandler(async (req, res, next) => {
  // Clear all refresh tokens
  req.user.refreshTokens = [];
  await req.user.save({ validateBeforeSave: false });
  
  logger.auth('logout_all_devices', req.user._id, req.ip, req.get('User-Agent'));
  
  res.json({
    status: 'success',
    message: 'Logged out from all devices successfully'
  });
}));

// @route   POST /api/v1/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', protect, [
  require('express-validator').body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  require('express-validator').body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  require('../middleware/validation').handleValidationErrors
], asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  
  // Get user with password
  const user = await User.findById(req.user._id).select('+password');
  
  // Check current password
  const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);
  
  if (!isCurrentPasswordCorrect) {
    logger.security('password_change_wrong_current', {
      userId: user._id,
      ip: req.ip
    });
    return next(new AppError('Current password is incorrect', 401, 'INCORRECT_PASSWORD'));
  }
  
  // Check if new password is different from current
  const isSamePassword = await user.comparePassword(newPassword);
  if (isSamePassword) {
    return next(new AppError('New password must be different from current password', 400, 'SAME_PASSWORD'));
  }
  
  // Update password
  user.password = newPassword;
  await user.save();
  
  // Clear all refresh tokens to force re-login on all devices
  user.refreshTokens = [];
  await user.save({ validateBeforeSave: false });
  
  logger.auth('password_changed', user._id, req.ip, req.get('User-Agent'));
  
  res.json({
    status: 'success',
    message: 'Password changed successfully. Please log in again on all devices.'
  });
}));

// @route   POST /api/v1/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', [
  require('express-validator').body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  require('../middleware/validation').handleValidationErrors
], asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  
  // Find user by email
  const user = await User.findOne({ 
    email: email.toLowerCase(), 
    isActive: true 
  });
  
  if (!user) {
    // Don't reveal whether user exists or not
    logger.security('password_reset_request_invalid_email', {
      email,
      ip: req.ip
    });
    
    return res.json({
      status: 'success',
      message: 'If a user with that email exists, a password reset link has been sent.'
    });
  }
  
  // Generate reset token (in production, implement proper token generation and email sending)
  const resetToken = require('crypto').randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  // Save reset token to user (you'd hash this in production)
  user.passwordResetToken = resetToken;
  user.passwordResetExpires = resetTokenExpiry;
  await user.save({ validateBeforeSave: false });
  
  logger.auth('password_reset_requested', user._id, req.ip, req.get('User-Agent'));
  
  // In production, send email with reset link
  // For now, just log it (REMOVE IN PRODUCTION)
  if (process.env.NODE_ENV === 'development') {
    logger.info(`Password reset token for ${email}: ${resetToken}`);
  }
  
  res.json({
    status: 'success',
    message: 'If a user with that email exists, a password reset link has been sent.',
    // REMOVE IN PRODUCTION - only for development
    ...(process.env.NODE_ENV === 'development' && { resetToken })
  });
}));

// @route   POST /api/v1/auth/reset-password/:token
// @desc    Reset password with token
// @access  Public
router.post('/reset-password/:token', [
  require('express-validator').param('token')
    .isLength({ min: 64, max: 64 })
    .withMessage('Invalid reset token'),
  require('express-validator').body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  require('../middleware/validation').handleValidationErrors
], asyncHandler(async (req, res, next) => {
  const { token } = req.params;
  const { password } = req.body;
  
  // Find user with valid reset token
  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() },
    isActive: true
  }).select('+passwordResetToken +passwordResetExpires');
  
  if (!user) {
    logger.security('password_reset_invalid_token', {
      token: token.substring(0, 8) + '...',
      ip: req.ip
    });
    return next(new AppError('Password reset token is invalid or has expired', 400, 'INVALID_RESET_TOKEN'));
  }
  
  // Set new password
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  
  // Clear all refresh tokens
  user.refreshTokens = [];
  
  await user.save();
  
  logger.auth('password_reset_completed', user._id, req.ip, req.get('User-Agent'));
  
  res.json({
    status: 'success',
    message: 'Password has been reset successfully. Please log in with your new password.'
  });
}));

// @route   GET /api/v1/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, asyncHandler(async (req, res, next) => {
  res.json({
    status: 'success',
    data: {
      user: req.user.toJSON()
    }
  });
}));

// @route   POST /api/v1/auth/verify-token
// @desc    Verify if token is valid
// @access  Private
router.post('/verify-token', protect, asyncHandler(async (req, res, next) => {
  res.json({
    status: 'success',
    message: 'Token is valid',
    data: {
      user: {
        id: req.user._id,
        username: req.user.username,
        role: req.user.role
      }
    }
  });
}));

// @route   GET /api/v1/auth/sessions
// @desc    Get user's active sessions
// @access  Private
router.get('/sessions', protect, asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('refreshTokens');
  
  const sessions = user.refreshTokens.map(tokenObj => ({
    createdAt: tokenObj.createdAt,
    isCurrentSession: req.headers.authorization?.includes(tokenObj.token) // This is simplified
  }));
  
  res.json({
    status: 'success',
    data: {
      sessions,
      totalSessions: sessions.length
    }
  });
}));

module.exports = router;