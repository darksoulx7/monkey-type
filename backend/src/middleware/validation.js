const { body, param, query, validationResult } = require('express-validator');
const { AppError, formatValidationErrors } = require('./error');

// Middleware to handle validation results
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = formatValidationErrors(errors);
    return next(new AppError(
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      { errors: formattedErrors }
    ));
  }
  
  next();
};

// User validation rules
const validateUserRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
    
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
    
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    
  handleValidationErrors
];

const validateUserLogin = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Username or email is required'),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
    
  handleValidationErrors
];

const validateUserProfileUpdate = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
    
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark'])
    .withMessage('Theme must be either light or dark'),
    
  body('preferences.soundEnabled')
    .optional()
    .isBoolean()
    .withMessage('Sound enabled must be a boolean'),
    
  body('preferences.blindMode')
    .optional()
    .isBoolean()
    .withMessage('Blind mode must be a boolean'),
    
  body('preferences.smoothCaret')
    .optional()
    .isBoolean()
    .withMessage('Smooth caret must be a boolean'),
    
  body('preferences.confidenceMode')
    .optional()
    .isIn(['off', 'on', 'max'])
    .withMessage('Confidence mode must be off, on, or max'),
    
  handleValidationErrors
];

// Test validation rules
const validateTestStart = [
  body('mode')
    .isIn(['time', 'words'])
    .withMessage('Mode must be either time or words'),
    
  body('duration')
    .optional()
    .isInt({ min: 15, max: 120 })
    .withMessage('Duration must be 15, 30, 60, or 120 seconds')
    .custom((value, { req }) => {
      if (req.body.mode === 'time' && ![15, 30, 60, 120].includes(value)) {
        throw new Error('Duration must be 15, 30, 60, or 120 seconds for time mode');
      }
      return true;
    }),
    
  body('wordCount')
    .optional()
    .isInt({ min: 10, max: 100 })
    .withMessage('Word count must be 10, 25, 50, or 100 words')
    .custom((value, { req }) => {
      if (req.body.mode === 'words' && ![10, 25, 50, 100].includes(value)) {
        throw new Error('Word count must be 10, 25, 50, or 100 words for words mode');
      }
      return true;
    }),
    
  body('wordListId')
    .optional()
    .isUUID()
    .withMessage('Word list ID must be a valid UUID'),
    
  body('language')
    .optional()
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Language must be between 2 and 20 characters'),
    
  // Custom validation to ensure required fields are present
  body()
    .custom((value, { req }) => {
      if (req.body.mode === 'time' && !req.body.duration) {
        throw new Error('Duration is required for time mode');
      }
      if (req.body.mode === 'words' && !req.body.wordCount) {
        throw new Error('Word count is required for words mode');
      }
      return true;
    }),
    
  handleValidationErrors
];

const validateTestSubmission = [
  param('testId')
    .isUUID()
    .withMessage('Test ID must be a valid UUID'),
    
  body('completedText')
    .trim()
    .notEmpty()
    .withMessage('Completed text is required')
    .isLength({ max: 10000 })
    .withMessage('Completed text too long'),
    
  body('keystrokes')
    .isArray()
    .withMessage('Keystrokes must be an array'),
    
  body('keystrokes.*.timestamp')
    .isInt({ min: 0 })
    .withMessage('Keystroke timestamp must be a non-negative integer'),
    
  body('keystrokes.*.key')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Keystroke key must be between 1 and 10 characters'),
    
  body('keystrokes.*.correct')
    .isBoolean()
    .withMessage('Keystroke correct must be a boolean'),
    
  body('keystrokes.*.position')
    .isInt({ min: 0 })
    .withMessage('Keystroke position must be a non-negative integer'),
    
  body('duration')
    .isInt({ min: 0 })
    .withMessage('Duration must be a non-negative integer'),
    
  body('wpm')
    .isFloat({ min: 0 })
    .withMessage('WPM must be a non-negative number'),
    
  body('accuracy')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Accuracy must be between 0 and 100'),
    
  body('consistency')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Consistency must be between 0 and 100'),
    
  body('errors')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Errors must be a non-negative integer'),
    
  handleValidationErrors
];

const validateKeystroke = [
  param('testId')
    .isUUID()
    .withMessage('Test ID must be a valid UUID'),
    
  body('timestamp')
    .isInt({ min: 0 })
    .withMessage('Timestamp must be a non-negative integer'),
    
  body('key')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Key must be between 1 and 10 characters'),
    
  body('correct')
    .isBoolean()
    .withMessage('Correct must be a boolean'),
    
  body('position')
    .isInt({ min: 0 })
    .withMessage('Position must be a non-negative integer'),
    
  handleValidationErrors
];

// WordList validation rules
const validateWordListCreate = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
    
  body('words')
    .isArray({ min: 10, max: 1000 })
    .withMessage('Words must be an array with 10-1000 items'),
    
  body('words.*')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each word must be between 1 and 50 characters'),
    
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),
    
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
    
  handleValidationErrors
];

const validateWordListUpdate = [
  param('listId')
    .isUUID()
    .withMessage('List ID must be a valid UUID'),
    
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
    
  body('words')
    .optional()
    .isArray({ min: 10, max: 1000 })
    .withMessage('Words must be an array with 10-1000 items'),
    
  body('words.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each word must be between 1 and 50 characters'),
    
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),
    
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
    
  handleValidationErrors
];

// Race validation rules
const validateRaceCreate = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
    
  body('mode')
    .isIn(['time', 'words'])
    .withMessage('Mode must be either time or words'),
    
  body('duration')
    .optional()
    .isInt()
    .withMessage('Duration must be an integer')
    .custom((value, { req }) => {
      if (req.body.mode === 'time' && ![15, 30, 60, 120].includes(value)) {
        throw new Error('Duration must be 15, 30, 60, or 120 seconds for time mode');
      }
      return true;
    }),
    
  body('wordCount')
    .optional()
    .isInt()
    .withMessage('Word count must be an integer')
    .custom((value, { req }) => {
      if (req.body.mode === 'words' && ![10, 25, 50, 100].includes(value)) {
        throw new Error('Word count must be 10, 25, 50, or 100 words for words mode');
      }
      return true;
    }),
    
  body('maxPlayers')
    .optional()
    .isInt({ min: 2, max: 10 })
    .withMessage('Max players must be between 2 and 10'),
    
  body('wordListId')
    .optional()
    .isUUID()
    .withMessage('Word list ID must be a valid UUID'),
    
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
    
  // Custom validation for required fields
  body()
    .custom((value, { req }) => {
      if (req.body.mode === 'time' && !req.body.duration) {
        throw new Error('Duration is required for time mode');
      }
      if (req.body.mode === 'words' && !req.body.wordCount) {
        throw new Error('Word count is required for words mode');
      }
      return true;
    }),
    
  handleValidationErrors
];

// Query parameter validation
const validatePagination = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
    
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be non-negative')
    .toInt(),
    
  handleValidationErrors
];

const validateLeaderboardQuery = [
  query('mode')
    .optional()
    .isIn(['time', 'words'])
    .withMessage('Mode must be either time or words'),
    
  query('duration')
    .optional()
    .isInt()
    .withMessage('Duration must be an integer')
    .custom((value) => {
      if (![15, 30, 60, 120].includes(parseInt(value))) {
        throw new Error('Duration must be 15, 30, 60, or 120 seconds');
      }
      return true;
    })
    .toInt(),
    
  query('wordCount')
    .optional()
    .isInt()
    .withMessage('Word count must be an integer')
    .custom((value) => {
      if (![10, 25, 50, 100].includes(parseInt(value))) {
        throw new Error('Word count must be 10, 25, 50, or 100 words');
      }
      return true;
    })
    .toInt(),
    
  query('period')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'allTime'])
    .withMessage('Period must be daily, weekly, monthly, or allTime'),
    
  ...validatePagination
];

const validateStatsQuery = [
  query('period')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'allTime'])
    .withMessage('Period must be daily, weekly, monthly, or allTime'),
    
  query('metric')
    .optional()
    .isIn(['wpm', 'accuracy', 'consistency'])
    .withMessage('Metric must be wpm, accuracy, or consistency'),
    
  handleValidationErrors
];

const validateExportRequest = [
  body('format')
    .isIn(['csv', 'json'])
    .withMessage('Format must be csv or json'),
    
  body('period')
    .optional()
    .isIn(['week', 'month', 'year', 'all'])
    .withMessage('Period must be week, month, year, or all'),
    
  body('includeKeystrokes')
    .optional()
    .isBoolean()
    .withMessage('includeKeystrokes must be a boolean'),
    
  handleValidationErrors
];

// Generic UUID parameter validation
const validateUUIDParam = (paramName) => [
  param(paramName)
    .isUUID()
    .withMessage(`${paramName} must be a valid UUID`),
    
  handleValidationErrors
];

// Friend request validation
const validateFriendRequest = [
  body('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
    
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateUserProfileUpdate,
  validateTestStart,
  validateTestSubmission,
  validateKeystroke,
  validateWordListCreate,
  validateWordListUpdate,
  validateRaceCreate,
  validatePagination,
  validateLeaderboardQuery,
  validateStatsQuery,
  validateExportRequest,
  validateUUIDParam,
  validateFriendRequest
};